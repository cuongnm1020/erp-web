import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeCustomers, makeOrderDetail, makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderCreateScreen } from './components/order-create-screen';
import { toCreateOrderBody } from './schema';

// Radix Select (team trong dialog Khách mới) cần ResizeObserver + scrollIntoView — jsdom không có.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/new',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const ORDER = makeOrders(1)[0]!;
const DETAIL = makeOrderDetail(ORDER.id)!;
const REAL_LINES = DETAIL.lines.filter((l) => !l.isGift);

/** GET /skus/:id trả baseUomId = uomId của dòng nguồn để form không phải đổi ĐVT. */
function skuHandlers() {
  return [
    http.get('/api/products', () => HttpResponse.json({ items: [], total: 0 })),
    http.get('/api/skus/:id', ({ params }) => {
      const line = DETAIL.lines.find((l) => l.skuId === params.id);
      if (!line) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({
        id: line.skuId,
        productId: 'p-1',
        code: line.skuCode,
        name: line.skuName,
        baseUomId: line.uomId,
        isActive: true,
        product: null,
        baseUom: { id: line.uomId, code: line.uomCode, name: line.uomCode, decimals: 0 },
        barcodes: [],
        uomConversions: [],
      });
    }),
    http.get('/api/stock', () =>
      HttpResponse.json({
        items: [],
        total: 0,
      }),
    ),
  ];
}

describe('toCreateOrderBody — CK% form → tỉ lệ API', () => {
  it('"5" → "0.05"; rỗng/0 → bỏ field; phí ship rỗng → bỏ field', () => {
    const body = toCreateOrderBody({
      customerId: 'c1',
      channel: 'DIRECT',
      shippingFee: '',
      lines: [
        { skuId: 's1', uomId: 'u1', qty: '2', discountPercent: '5' },
        { skuId: 's2', uomId: 'u2', qty: '10', discountPercent: '' },
        { skuId: 's3', uomId: 'u3', qty: '1', discountPercent: '0' },
      ],
    });
    expect(body).toEqual({
      customerId: 'c1',
      channel: 'DIRECT',
      lines: [
        { skuId: 's1', uomId: 'u1', qty: '2', discountPercent: '0.05' },
        { skuId: 's2', uomId: 'u2', qty: '10' },
        { skuId: 's3', uomId: 'u3', qty: '1' },
      ],
    });
    expect(
      toCreateOrderBody({
        customerId: 'c1',
        channel: 'POS',
        shippingFee: '30000',
        lines: [{ skuId: 's1', uomId: 'u1', qty: '1', discountPercent: '12.5' }],
      }).lines[0]!.discountPercent,
    ).toBe('0.125');
  });
});

describe('OrderCreateScreen — POST /sales-orders (D-01)', () => {
  it('chưa chọn khách / dòng trống → lỗi validate, KHÔNG gọi API', async () => {
    search = '';
    const posts: unknown[] = [];
    server.use(
      http.post('/api/sales-orders', () => {
        posts.push(1);
        return HttpResponse.json({});
      }),
    );
    renderApp(<OrderCreateScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Chốt đơn' }));
    expect(await screen.findByText('Chọn khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Chọn sản phẩm')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('?from=<đơn cũ> đổ sẵn dòng hàng (bỏ hàng tặng) → chốt gửi đúng body + Idempotency-Key, điều hướng về chi tiết', async () => {
    search = `from=${ORDER.id}`;
    const captured: Array<{ key: string | null; body: unknown }> = [];
    server.use(
      ...skuHandlers(),
      http.post('/api/sales-orders', async ({ request }) => {
        captured.push({
          key: request.headers.get('idempotency-key'),
          body: await request.json(),
        });
        return HttpResponse.json(
          {
            orderId: 'new-order-1',
            docNumber: 'SO2609-00099',
            status: 'APPROVED',
            subtotal: '1',
            discount: '0',
            taxAmount: '0',
            shippingFee: '0',
            total: '1',
            lines: [],
            reservations: [],
            appliedPromotionIds: [],
            approvalRuleId: null,
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderCreateScreen />);
    // Prefill xong: mô tả nêu số chứng từ đơn nguồn
    expect(
      await screen.findByText(`Từ đơn ${ORDER.docNumber} — kiểm tra lại rồi chốt`, undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chốt đơn' }));
    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0]!.key).toMatch(/[0-9a-f-]{36}/);
    expect(captured[0]!.body).toMatchObject({
      customerId: ORDER.customer.id,
      channel: ORDER.channel,
      lines: REAL_LINES.map((l) => ({ skuId: l.skuId, uomId: l.uomId, qty: l.qty })),
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/orders/new-order-1'));
  });

  it('xem trước giá: niêm yết + thành tiền từng dòng và Tạm tính cộng từ /prices/resolve', async () => {
    search = `from=${ORDER.id}`;
    server.use(
      ...skuHandlers(),
      http.get('/api/prices/resolve', () =>
        HttpResponse.json({ priceListId: 'pl-1', listPrice: '100000', maxDiscount: '0.15' }),
      ),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
    );
    // Mỗi dòng qty (i+1)*10 (bỏ dòng quà i=2) → thành tiền qty × 100.000
    const expectSubtotal = REAL_LINES.reduce((acc, l) => acc + Number(l.qty) * 100_000, 0);
    await waitFor(() => {
      expect(screen.getAllByText('100.000').length).toBeGreaterThan(0); // giá niêm yết hiện ra
    });
    // Tạm tính (và có thể trùng với thành tiền dòng khi chỉ 1 dòng) — chỉ cần xuất hiện
    await waitFor(() =>
      expect(
        screen.getAllByText(new Intl.NumberFormat('vi-VN').format(expectSubtotal)).length,
      ).toBeGreaterThan(0),
    );
  });

  it('CK% vượt trần bảng giá → cảnh báo đỏ ngay tại dòng', async () => {
    search = `from=${ORDER.id}`;
    server.use(
      ...skuHandlers(),
      http.get('/api/prices/resolve', () =>
        HttpResponse.json({ priceListId: 'pl-1', listPrice: '100000', maxDiscount: '0.15' }),
      ),
    );
    renderApp(<OrderCreateScreen />);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')).toHaveLength(REAL_LINES.length),
    );
    // Chờ prefill reset xong (qty của dòng nguồn đã đổ vào) rồi mới gõ CK
    await waitFor(() =>
      expect(screen.getAllByLabelText('Số lượng')[0]).toHaveValue(REAL_LINES[0]!.qty),
    );
    fireEvent.change(screen.getAllByLabelText('Chiết khấu %')[0]!, { target: { value: '18' } });
    expect(
      await screen.findByText('vượt trần 15% — hệ thống sẽ chặn khi chốt'),
    ).toBeInTheDocument();
  });

  it('?customerId=<id> chọn sẵn khách và hiện tên (nút Tạo đơn từ hồ sơ khách)', async () => {
    const CUST = makeCustomers(1)[0]!;
    search = `customerId=${CUST.id}`;
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    // combobox đầu tiên là picker khách hàng
    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveTextContent(CUST.name));
  });

  it('Khách mới: tạo nhanh trong form → POST /customers, picker chọn ngay khách vừa tạo', async () => {
    search = '';
    const posted: unknown[] = [];
    server.use(
      http.get('/api/teams', () =>
        HttpResponse.json([
          {
            id: '00000042-0000-4000-8000-000000000001',
            code: 'SALES-HN',
            name: 'Kinh doanh Hà Nội',
            type: 'SALES',
            parentId: null,
          },
        ]),
      ),
      http.post('/api/customers', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posted.push(body);
        return HttpResponse.json(
          { id: 'new-cust-1', code: body.code, name: body.name, isActive: true },
          { status: 201 },
        );
      }),
    );
    server.use(...skuHandlers());
    renderApp(<OrderCreateScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Khách mới' }));
    expect(await screen.findByText('Tạo nhanh khách hàng')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tên khách hàng'), {
      target: { value: 'Cửa hàng An Nhiên' },
    });
    fireEvent.change(screen.getByLabelText('Mã KH'), { target: { value: 'KH-TEST-01' } });
    // Radix Select: mở rồi chọn team
    fireEvent.click(screen.getByRole('combobox', { name: /Team chăm sóc/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kinh doanh Hà Nội' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      code: 'KH-TEST-01',
      name: 'Cửa hàng An Nhiên',
      teamId: '00000042-0000-4000-8000-000000000001',
    });
    // Dialog đóng, picker hiện khách vừa tạo
    await waitFor(() => expect(screen.queryByText('Tạo nhanh khách hàng')).not.toBeInTheDocument());
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Cửa hàng An Nhiên');
  });
});
