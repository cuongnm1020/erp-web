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
  it('tiêu đề + breadcrumb Kho › Đơn hàng (menu đổi tên 2026-11-05), bảng dữ liệu GET /sales-orders', async () => {
    renderApp(<PrintOrdersScreen />);
    expect(screen.getByRole('heading', { name: 'Đơn hàng' })).toBeInTheDocument();
    expect(await screen.findByText(FIRST.docNumber)).toBeInTheDocument();
    expect(screen.getByTestId('order-count')).toHaveTextContent('60');
  });

  it('không còn nút "Cột" / "Bộ lọc đã lưu" / "Bộ lọc khác"; luôn hiện hết cột dù đã lưu cột ẩn; tab một dãy chip liền (user 2026-11-04 tối)', async () => {
    server.use(
      http.get('/api/me/preferences/:key', ({ params }) =>
        HttpResponse.json({ key: params.key, value: { hidden: ['items'], sort: null } }),
      ),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    expect(screen.queryByRole('button', { name: /^Cột/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bộ lọc đã lưu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bộ lọc khác' })).not.toBeInTheDocument();
    // Cột Sản phẩm đã lưu ẩn vẫn hiện.
    expect(screen.getByRole('button', { name: /^Sắp xếp theo Sản phẩm/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('order-items').length).toBeGreaterThan(0);
    // Không chia khối giai đoạn: tablist chứa thẳng 14 chip, không role=group.
    const tablist = screen.getByRole('tablist', { name: 'Trạng thái đơn' });
    expect(tablist.querySelectorAll('[role="group"]')).toHaveLength(0);
    expect(tablist.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(14);
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

  it('cột Cân nặng (2026-11-06): bấm tiêu đề → GET /sales-orders?sortBy=weight', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [FIRST], total: 1 });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo Cân nặng' }));
    await waitFor(() => expect(seen.some((p) => p.get('sortBy') === 'weight')).toBe(true));
  });

  it('bỏ lọc Hãng VC / NV lên đơn / Vận chuyển / Đơn (2026-11-04): không hiện ô, link cũ không lọc ngầm', async () => {
    search =
      'group=all&carrierId=c-1&noCarrier=true&creatorId=u-1&printStatus=PRINTED&carrierSource=ERP&carrierStatus=x&duplicate=true&itemOrigin=CUSTOM&totalMin=100';
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
      for (const label of ['Hãng VC: tất cả', 'Giá trị đơn']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Sắp xếp theo Cân nặng' })).toBeInTheDocument();
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
      ];
      expect(seen.length).toBeGreaterThan(0);
      for (const p of seen) for (const k of keys) expect(p.has(k)).toBe(false);
    } finally {
      search = 'group=all';
    }
  });

  it('lọc Cân nặng (đưa lại 2026-11-06, như Bán hàng › Đơn hàng): URL weightMin/weightMax → gửi API, ô nhập phản ánh URL', async () => {
    search = 'group=all&weightMin=1&weightMax=1.5';
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
      expect(screen.getByLabelText('Cân nặng từ (kg)')).toHaveValue('1');
      expect(screen.getByLabelText('Cân nặng đến (kg)')).toHaveValue('1.5');
      expect(seen.some((p) => p.get('weightMin') === '1' && p.get('weightMax') === '1.5')).toBe(
        true,
      );
    } finally {
      search = 'group=all';
    }
  });

  it('ô POS chọn nhiều thay ô Nguồn, ghim trên thanh cùng Page / Phòng ban; URL pos=a,b → pancakeShopId=a,b (2026-11-04)', async () => {
    search = 'group=all&pos=715130909,715130910';
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
      await waitFor(() =>
        expect(seen.some((p) => p.get('pancakeShopId') === '715130909,715130910')).toBe(true),
      );
      for (const p of seen) expect(p.has('source')).toBe(false);
      // Bày thẳng trên thanh (không có panel "Bộ lọc khác"): nút combobox có sẵn; "Xóa lọc (n)"
      // đứng ngay trên thanh khi đang lọc (user 2026-11-04 tối).
      expect(screen.getByRole('combobox', { name: 'POS' })).toHaveTextContent('POS: 2 POS');
      expect(screen.getByRole('combobox', { name: 'Page' })).toBeInTheDocument();
      expect(screen.queryByText('Nguồn: tất cả')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Bộ lọc khác' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Xóa lọc \(\d+\)/ })).toBeInTheDocument();
    } finally {
      search = 'group=all';
    }
  });

  it('cột Sản phẩm sắp được → sortBy=items; đang tìm kiếm chưa chọn cột → mặc định sortBy=items asc (2026-11-04)', async () => {
    search = 'group=all&q=sherdoba';
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
      await waitFor(() => {
        const last = seen.at(-1)!;
        expect(last.get('sortBy')).toBe('items');
        expect(last.get('sortDir')).toBe('asc');
      });
      // Cột Sản phẩm sắp được: tiêu đề là nút "Sắp xếp theo Sản phẩm", đang tăng dần (bấm đổi
      // URL `sort=` — router mock nên không theo dõi tiếp ở đây).
      expect(
        screen.getByRole('button', { name: 'Sắp xếp theo Sản phẩm (đang tăng dần)' }),
      ).toBeInTheDocument();
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
