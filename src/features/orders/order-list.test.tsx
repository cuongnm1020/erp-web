import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE, makeOrders, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';

const replace = vi.fn();
let search = '';
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeOrders(1)[0]!;

describe('OrderListScreen — GET /sales-orders (P1-12)', () => {
  it('loading → bảng dữ liệu thật, tổng hiện trên tiêu đề', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByText('60 đơn khớp bộ lọc')).toBeInTheDocument();
    expect(screen.getByText('1–50 / 60 dòng')).toBeInTheDocument();
  });

  it('số đơn dẫn tới chi tiết theo id, không theo số chứng từ', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    const link = await screen.findByRole('link', { name: FIRST.docNumber });
    expect(link).toHaveAttribute('href', `/crm/orders/${FIRST.id}`);
  });

  it('tìm theo id đơn Pancake (q trên URL → server): ra đúng đơn, cột số đơn hiện "Pancake #id"', async () => {
    const pancake = makeOrders(60).find((o) => o.pancakeOrderId === '103')!;
    search = 'q=%23103';
    renderApp(<OrderListScreen />);
    await screen.findByText('1 đơn khớp bộ lọc');
    const link = screen.getByRole('link', { name: pancake.docNumber });
    expect(link).toHaveAttribute('href', `/crm/orders/${pancake.id}`);
    expect(screen.getByText('Pancake #103')).toBeInTheDocument();
  });

  it('tab theo luồng đơn đọc ?flow= từ URL, lọc phía server; mỗi tab có số đếm từ API (luật 8)', async () => {
    const all = makeOrders(60);
    const delivered = all.filter((o) => o.flow === 'DELIVERED').length;
    search = 'flow=DELIVERED';
    renderApp(<OrderListScreen />);
    await screen.findByText(`${delivered} đơn khớp bộ lọc`);
    const tab = screen.getByRole('tab', { name: new RegExp(`^Thành công\\s*${delivered}$`) });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    // Số đếm của tab khác + tab Tất cả cũng có (GET /sales-orders/flow-counts).
    const pending = all.filter((o) => o.flow === 'PENDING_APPROVAL').length;
    expect(
      await screen.findByRole('tab', { name: new RegExp(`^Chờ duyệt\\s*${pending}$`) }),
    ).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /^Tất cả\s*60$/ })).toBeInTheDocument();
    // Bấm tab → ghi ?flow= lên URL.
    replace.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: /^Sự cố hoàn/ }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls.at(-1)![0])).toContain('flow=RETURNED');
  });

  it('SĐT hiện đủ trên một dòng kèm nhà mạng rút gọn (Viettel / Vina / Mobi)', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    // i=0 → 0912345678 (Vinaphone), i=1 → 0386… (Viettel), i=2 → 0908… (Mobifone).
    expect(screen.getAllByText('0912 345 678').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vina').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Viettel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobi').length).toBeGreaterThan(0);
  });

  it('bấm vào dòng → xem nhanh bên phải (người nhận, sản phẩm, tiền, hãng); Đóng thì tắt', async () => {
    search = 'flow=DELIVERED';
    renderApp(<OrderListScreen />);
    const row = makeOrders(60).find((o) => o.flow === 'DELIVERED')!;
    fireEvent.click(await screen.findByText(row.shipment!.trackingNo!));
    const panel = await screen.findByRole('dialog');
    expect(panel).toHaveTextContent(row.docNumber);
    expect(panel).toHaveTextContent('Thành công');
    expect(panel).toHaveTextContent('Giao Hàng Tiết Kiệm');
    expect(panel).toHaveTextContent('170.000');
    expect(await screen.findByRole('link', { name: 'Mở đơn đầy đủ' })).toHaveAttribute(
      'href',
      `/crm/orders/${row.id}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem nhanh' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sale không có sales_order.create → nút tạo đơn ẩn (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, { me: { ...ME_SALE, permissions: ['sales_order.read'] } });
    await screen.findByText(FIRST.docNumber);
    expect(screen.queryByRole('link', { name: /Tạo đơn/ })).not.toBeInTheDocument();
  });

  it('empty: EmptyState kèm đúng một hành động', async () => {
    search = '';
    server.use(scenario.ordersEmpty);
    renderApp(<OrderListScreen />);
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    search = '';
    server.use(scenario.ordersError);
    renderApp(<OrderListScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText(FIRST.docNumber)).toBeInTheDocument());
  });

  it('403: màn không có quyền, không đá về đăng nhập (luật 6)', async () => {
    search = '';
    server.use(scenario.ordersForbidden);
    renderApp(<OrderListScreen />);
    expect(await screen.findByText('Bạn không có quyền xem mục này')).toBeInTheDocument();
  });
});

describe('OrderListScreen — cân nặng gửi hãng + gán hãng hàng loạt', () => {
  it('cột Cân nặng: đặt tay có dấu ✎ và tooltip Σ dòng; đơn tính từ dòng hiện kg thường', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    // i=0 → shippingWeightKg 1.0000 (đặt tay), lineWeightKg 0.3000
    const manual = screen.getAllByTitle(/Đặt tay · tính từ dòng: 0,3\skg/);
    expect(manual.length).toBeGreaterThan(0);
    expect(manual[0]).toHaveTextContent(/^1\skg/);
    // i=1 → tính từ dòng 0,6 kg
    expect(screen.getAllByTitle('Tính từ cân nặng SKU')[0]).toHaveTextContent(/^0,6\skg$/);
  });

  it('lọc cân nặng + chưa gán hãng đọc từ URL, gửi lên server (luật 8); ô nhập phản ánh URL', async () => {
    search = 'weightMin=1&weightMax=1.5&noCarrier=true';
    const expected = makeOrders(60).filter(
      (o) => Number(o.weightKg) >= 1 && Number(o.weightKg) <= 1.5 && o.carrierId === null,
    ).length;
    renderApp(<OrderListScreen />);
    await screen.findByText(`${expected} đơn khớp bộ lọc`);
    expect(screen.getByLabelText('Cân nặng từ (kg)')).toHaveValue('1');
    expect(screen.getByLabelText('Cân nặng đến (kg)')).toHaveValue('1.5');
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toHaveTextContent(
      'Chưa gán hãng',
    );
    // Gõ khoảng mới + Enter → chỉ khi Enter mới ghi URL (không bắn theo từng phím)
    replace.mockClear();
    const min = screen.getByLabelText('Cân nặng từ (kg)');
    fireEvent.change(min, { target: { value: '1,2' } });
    expect(replace).not.toHaveBeenCalled();
    fireEvent.keyDown(min, { key: 'Enter' });
    expect(replace).toHaveBeenCalledTimes(1);
    const url = String(replace.mock.calls[0]![0]);
    expect(url).toContain('weightMin=1.2');
    expect(url).toContain('weightMax=1.5');
    expect(url).toContain('noCarrier=true');
  });

  it('chọn 2 đơn → "Gán hãng / cân nặng" → POST /sales-orders/bulk-update đúng orderIds + cân nặng + hãng, bỏ chọn sau khi xong', async () => {
    search = '';
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/bulk-update', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const ids = body.orderIds as string[];
        return HttpResponse.json(
          {
            updated: ids.map((id) => ({
              orderId: id,
              docNumber: 'SO-X',
              status: 'APPROVED',
              carrierId: body.carrierId ?? null,
              warehouseId: null,
              shippingWeightKg: body.shippingWeightKg ?? null,
              changed: ['carrierId', 'shippingWeightKg'],
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    const rows = makeOrders(3);
    // i=0 DRAFT, i=1 PENDING_APPROVAL → đều sửa được. Bảng render lại sau mỗi lần chọn →
    // hỏi lại checkbox thay vì giữ tham chiếu cũ (node đã bị thay).
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gán hãng \/ cân nặng/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /Cập nhật 2 đơn/ });
    expect(submit).toBeDisabled(); // chưa chọn gì để áp

    fireEvent.change(screen.getByLabelText('Cân nặng gửi hãng (kg)'), { target: { value: '1' } });
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: /GHTK/ }));
    fireEvent.click(submit);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      orderIds: [rows[0]!.id, rows[1]!.id],
      shippingWeightKg: '1',
    });
    expect(typeof bodies[0]!.carrierId).toBe('string');
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã cập nhật 2 đơn', expect.anything()),
    );
    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('chọn 3 đơn (1 đã hủy) → "Hủy đơn" → POST /sales-orders/bulk-cancel chỉ 2 đơn còn hủy được + lý do, báo đơn lỗi, bỏ chọn', async () => {
    search = '';
    toastSuccess.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/bulk-cancel', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const [first, second] = body.orderIds as string[];
        return HttpResponse.json(
          {
            cancelled: [
              {
                orderId: first,
                docNumber: 'SO-A',
                status: 'CANCELLED',
                releasedReservationIds: [],
              },
            ],
            failed: [
              {
                orderId: second,
                docNumber: 'SO-B',
                code: 'ORDER_ALREADY_PACKED',
                message: 'đã đóng gói',
              },
            ],
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    const rows = makeOrders(5);
    expect(rows[4]!.status).toBe('CANCELLED');
    // i=0 DRAFT, i=1 PENDING_APPROVAL hủy được; i=4 đã hủy → bỏ qua ở client.
    for (const i of [0, 1, 4]) {
      fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[i]!);
    }
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hủy đơn/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Hủy 2 đơn đã chọn?');
    expect(dialog).toHaveTextContent('1 đơn đã hủy hoặc kho đã đóng gói sẽ bị bỏ qua');
    fireEvent.change(screen.getByLabelText('Lý do hủy (tùy chọn)'), {
      target: { value: ' Khách đổi ý ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy 2 đơn' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ orderIds: [rows[0]!.id, rows[1]!.id], reason: 'Khách đổi ý' });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Đã hủy 1 đơn',
        expect.objectContaining({ description: '1 đơn không hủy được: SO-B' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('không có quyền sales_order.cancel → thanh chọn không có nút "Hủy đơn" (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, {
      me: { ...ME_SALE, permissions: ['sales_order.read', 'sales_order.update'] },
    });
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gán hãng \/ cân nặng/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hủy đơn/ })).not.toBeInTheDocument();
  });
});

describe('OrderListScreen — lọc theo hãng + thời gian (2026-09-19)', () => {
  it('carrierId + from/to đọc từ URL → gửi lên server; ô hãng hiện tên hãng, ô ngày phản ánh URL', async () => {
    search = 'carrierId=c-ghtk&from=2026-08-20&to=2026-08-22';
    const expected = makeOrders(60).filter(
      (o) =>
        o.carrierId === 'c-ghtk' &&
        o.orderDate >= '2026-08-20T00:00:00.000Z' &&
        o.orderDate <= '2026-08-22T23:59:59.999Z',
    ).length;
    expect(expected).toBeGreaterThan(0);
    renderApp(<OrderListScreen />);
    await screen.findByText(`${expected} đơn khớp bộ lọc`);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toHaveTextContent(
        'Giao Hàng Tiết Kiệm',
      ),
    );
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('2026-08-20');
    expect(screen.getByLabelText('Đến ngày')).toHaveValue('2026-08-22');
  });

  it('lọc theo POS Pancake: ô Nguồn liệt kê từng POS; source=POS:<mã> → gửi source=PANCAKE + pancakeShopId cho danh sách và đếm tab', async () => {
    search = 'source=POS:715130909';
    const seen: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname.startsWith('/api/sales-orders')) seen.push(request.url);
    };
    server.events.on('request:start', onRequest);
    try {
      renderApp(<OrderListScreen />);
      const box = await screen.findByRole('combobox', { name: 'Nguồn' });
      await waitFor(() => expect(box).toHaveTextContent('Pancake · Thiên Nông chính'));
      await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(2));
      const list = seen.find((u) => new URL(u).pathname === '/api/sales-orders')!;
      const counts = seen.find((u) => new URL(u).pathname === '/api/sales-orders/flow-counts')!;
      for (const u of [list, counts]) {
        const p = new URL(u).searchParams;
        expect(p.get('source')).toBe('PANCAKE');
        expect(p.get('pancakeShopId')).toBe('715130909');
      }

      // Chọn POS khác (đã ngắt, chưa đặt tên) → URL đổi sang mã đó.
      replace.mockClear();
      fireEvent.click(box);
      fireEvent.click(
        await screen.findByRole('option', { name: 'Pancake · POS 407957969 (đã ngắt)' }),
      );
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(decodeURIComponent(String(replace.mock.calls.at(-1)![0]))).toContain(
        'source=POS:407957969',
      );
    } finally {
      server.events.removeListener('request:start', onRequest);
    }
  });

  it('chọn "Chưa gán hãng" → URL noCarrier=true và bỏ carrierId (hai key loại trừ nhau)', async () => {
    search = 'carrierId=c-ghtk';
    renderApp(<OrderListScreen />);
    const box = await screen.findByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(box).toHaveTextContent('Giao Hàng Tiết Kiệm'));
    replace.mockClear();
    fireEvent.click(box);
    fireEvent.click(await screen.findByRole('option', { name: 'Chưa gán hãng' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = String(replace.mock.calls.at(-1)![0]);
    expect(url).toContain('noCarrier=true');
    expect(url).not.toContain('carrierId=');
  });
});
