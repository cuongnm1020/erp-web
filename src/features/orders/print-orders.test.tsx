import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PrintOrdersScreen } from './components/print-orders-screen';

let search = 'group=all';
vi.mock('next/navigation', () => ({
  usePathname: () => '/wms/print-orders',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeOrders(1)[0]!;

describe('PrintOrdersScreen — In đơn (clone màn Đơn hàng, 2026-11-04)', () => {
  it('tiêu đề + breadcrumb Kho › In đơn, bảng dữ liệu GET /sales-orders', async () => {
    renderApp(<PrintOrdersScreen />);
    expect(screen.getByRole('heading', { name: 'In đơn' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByTestId('order-count')).toHaveTextContent('60');
  });

  it('ẩn cột lưu vào tuỳ chọn riêng orders.print, không đụng orders.list của màn Đơn hàng', async () => {
    const keys: string[] = [];
    server.use(
      http.put('/api/me/preferences/:key', async ({ params, request }) => {
        keys.push(String(params.key));
        const body = (await request.json()) as { value: unknown };
        return HttpResponse.json({ key: params.key, value: body.value });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getByRole('button', { name: /^Cột/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sản phẩm' }));
    await waitFor(() => expect(keys).toEqual(['orders.print']));
  });

  it('cột Sản phẩm hiện HẾT sản phẩm của đơn, không "+N sản phẩm khác" (2026-11-04)', async () => {
    renderApp(<PrintOrdersScreen />);
    const second = makeOrders(2)[1]!;
    await screen.findByText(second.docNumber);
    const cells = screen.getAllByTestId('order-items');
    const cell = cells.find((c) => c.textContent?.includes('Sản phẩm 2 × 10'));
    expect(cell).toBeDefined();
    expect(cell).toHaveTextContent('Sản phẩm 1 × 10');
    expect(screen.queryByText(/sản phẩm khác/)).not.toBeInTheDocument();
  });

  it('"Đóng gói + in vận đơn" bắt chọn NV đóng hàng cùng kho → bulk-update packerId TRƯỚC bulk-fulfil', async () => {
    const rows = makeOrders(2).map((o) => ({
      ...o,
      status: 'APPROVED' as const,
      carrierId: 'c-ghtk',
      warehouseId: 'wh-1',
    }));
    const calls: { url: string; body: unknown }[] = [];
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: rows.length })),
      http.get('/api/pda/packers', ({ request }) => {
        expect(new URL(request.url).searchParams.get('warehouseId')).toBe('wh-1');
        return HttpResponse.json([{ id: 'u-pack', code: 'pack.1', fullName: 'Nguyễn Đóng' }]);
      }),
      http.post('/api/sales-orders/bulk-update', async ({ request }) => {
        const body = (await request.json()) as { orderIds: string[] };
        calls.push({ url: 'bulk-update', body });
        return HttpResponse.json(
          {
            updated: body.orderIds.map((id) => ({
              orderId: id,
              docNumber: 'x',
              status: 'APPROVED',
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
      http.post('/api/sales-orders/bulk-fulfil', async ({ request }) => {
        calls.push({ url: 'bulk-fulfil', body: await request.json() });
        return HttpResponse.json({ done: [], failed: [] }, { status: 201 });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(rows[0]!.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
    fireEvent.click(await screen.findByRole('button', { name: /Đóng gói \+ in vận đơn/ }));
    const go = await screen.findByRole('button', { name: 'Đóng gói + in 2 đơn' });
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'NV đóng hàng' }));
    fireEvent.click(await screen.findByText('Nguyễn Đóng'));
    await waitFor(() => expect(go).toBeEnabled());
    fireEvent.click(go);
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual(['bulk-update', 'bulk-fulfil']));
    expect(calls[0]!.body).toEqual({ orderIds: [rows[0]!.id, rows[1]!.id], packerId: 'u-pack' });
  });

  it('ô tìm Sản phẩm chỉ liệt kê sản phẩm thường — GET /products?isCombo=false', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/products', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getAllByText('Sản phẩm: tất cả')[0]!);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((p) => p.get('isCombo') === 'false')).toBe(true);
    // Bỏ cả SP Pancake tự sinh dạng gói (2026-11-04).
    expect(seen.every((p) => p.get('erpOnly') === 'true')).toBe(true);
  });

  it('bỏ lọc Hãng VC / NV lên đơn / Vận chuyển / Đơn (2026-11-04): không hiện ô, link cũ không lọc ngầm', async () => {
    search =
      'group=all&carrierId=c-1&noCarrier=true&creatorId=u-1&printStatus=PRINTED&carrierSource=ERP&carrierStatus=x&duplicate=true&itemOrigin=CUSTOM&totalMin=100&weightMin=1';
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [FIRST], total: 1 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await screen.findByText(FIRST.docNumber);
      for (const label of ['Hãng VC: tất cả', 'Giá trị đơn', 'Cân nặng']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
      const keys = [
        'carrierId',
        'noCarrier',
        'creatorId',
        'printStatus',
        'carrierSource',
        'carrierStatusText',
        'duplicate',
        'itemOrigin',
        'totalMin',
        'weightMin',
      ];
      expect(seen.length).toBeGreaterThan(0);
      for (const p of seen) for (const k of keys) expect(p.has(k)).toBe(false);
    } finally {
      search = 'group=all';
    }
  });

  it('lọc "Chỉ sản phẩm này": URL skuOnly=true + skuId → gửi skuOnly=true lên API', async () => {
    const sku = '00000000-0000-4000-8000-0000000000aa';
    search = `group=all&skuId=${sku}&skuOnly=true`;
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await waitFor(() =>
        expect(seen.some((p) => p.get('skuId') === sku && p.get('skuOnly') === 'true')).toBe(true),
      );
    } finally {
      search = 'group=all';
    }
  });
});
