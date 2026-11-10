import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { makeTestQueryClient, renderApp } from '@/test/render';
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

  it('Xác nhận hàng loạt (2026-11-06): chọn Đơn mới ERP + đơn Pancake + đơn đã xác nhận → "Xác nhận đơn (1)" → POST bulk-confirm chỉ đơn ERP chưa xác nhận', async () => {
    const [a, b, c] = makeOrders(3);
    const rows = [
      { ...a!, status: 'DRAFT' as const, pancakeOrderId: null },
      { ...b!, status: 'DRAFT' as const, pancakeOrderId: '555' },
      { ...c!, status: 'APPROVED' as const, pancakeOrderId: null },
    ];
    const bodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: rows.length })),
      http.post('/api/sales-orders/bulk-confirm', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          confirmed: [{ orderId: a!.id, docNumber: a!.docNumber }],
          failed: [],
        });
      }),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(a!.docNumber);
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn tất cả/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đơn (1)' }));
    await waitFor(() => expect(bodies).toEqual([{ orderIds: [a!.id] }]));
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

  it('dòng đã chọn rời bộ lọc khi nạp lại (Gửi ĐVVC xong đơn sang tab khác) → thanh chọn nhiều vẫn còn, không gỡ hộp thoại đang mở (2026-11-07)', async () => {
    const two = makeOrders(2);
    let calls = 0;
    server.use(
      http.get('/api/sales-orders', () => {
        calls += 1;
        return HttpResponse.json(
          calls === 1 ? { items: two, total: 2 } : { items: [two[1]], total: 1 },
        );
      }),
    );
    const queryClient = makeTestQueryClient();
    renderApp(<PrintOrdersScreen />, { queryClient });
    await screen.findByText(two[0]!.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(await screen.findByRole('toolbar')).toHaveTextContent('1 đơn đã chọn');

    await queryClient.invalidateQueries();
    await waitFor(() => expect(screen.queryByText(two[0]!.docNumber)).not.toBeInTheDocument());
    expect(calls).toBeGreaterThan(1);
    expect(screen.getByRole('toolbar')).toHaveTextContent('1 đơn đã chọn');

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
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
    // In tem đưa lại 2026-11-10 (test riêng bên dưới).
    search =
      'group=all&carrierId=c-1&noCarrier=true&creatorId=u-1&carrierSource=ERP&carrierStatus=x&duplicate=true&itemOrigin=CUSTOM&totalMin=100';
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
      // Hãng VC đưa lại 2026-11-10 dạng chọn nhiều (`carrier=`) — link cũ `carrierId=` vẫn bỏ qua.
      for (const label of ['NV lên đơn: tất cả', 'Giá trị đơn']) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Sắp xếp theo Cân nặng' })).toBeInTheDocument();
      const keys = [
        'carrierId',
        'noCarrier',
        'creatorId',
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

  it('Hãng VC chọn nhiều (2026-11-10): URL carrier=c:…,a:… → carrierIds / carrierAccountIds cho danh sách + đếm tab; doanh số dưới số đơn', async () => {
    const c = '11111111-1111-4111-8111-111111111111';
    const a = '22222222-2222-4222-8222-222222222222';
    search = `group=all&carrier=c:${c},a:${a}`;
    const seen: URLSearchParams[] = [];
    const counts: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        const p = new URL(request.url).searchParams;
        seen.push(p);
        return HttpResponse.json({
          items: [FIRST],
          total: 1,
          ...(p.get('withTotalAmount') === 'true' ? { totalAmount: '1250000.0000' } : {}),
        });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        counts.push(new URL(request.url).searchParams);
        return HttpResponse.json({ total: 1, NEW: 1 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await screen.findByText(FIRST.docNumber);
      await waitFor(() =>
        expect(
          seen.some((p) => p.get('carrierIds') === c && p.get('carrierAccountIds') === a),
        ).toBe(true),
      );
      await waitFor(() => expect(counts.some((p) => p.get('carrierIds') === c)).toBe(true));
      expect(screen.getByRole('combobox', { name: 'Hãng VC' })).toBeInTheDocument();
      expect(screen.getByTestId('order-amount')).toHaveTextContent(/Doanh số\s*1\.250\.000/);
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

  it('lọc loại trừ SP (2026-11-10): URL excludeSku → danh sách + số đếm gửi excludeSkuIds từng SP, chip có ×; giá trị lạ bỏ qua', async () => {
    const a = '00000000-0000-4000-8000-0000000000a1';
    const b = '00000000-0000-4000-8000-0000000000b2';
    search = `group=all&excludeSku=${a},khong-phai-id,${b}`;
    const list: URLSearchParams[] = [];
    const counts: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        list.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        counts.push(new URL(request.url).searchParams);
        return HttpResponse.json({ total: 0 });
      }),
      http.get('/api/skus/:id', ({ params }) =>
        HttpResponse.json({
          id: params.id,
          code: params.id === a ? 'SP-LION' : 'SP-B',
          name: params.id === a ? 'LION SUPER 450ML' : 'Sản phẩm B',
        }),
      ),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await waitFor(() =>
        expect(list.some((p) => p.getAll('excludeSkuIds').join(',') === `${a},${b}`)).toBe(true),
      );
      await waitFor(() =>
        expect(counts.some((p) => p.getAll('excludeSkuIds').join(',') === `${a},${b}`)).toBe(true),
      );
      expect(
        await screen.findByRole('button', { name: 'Bỏ loại trừ SP-LION · LION SUPER 450ML' }),
      ).toBeInTheDocument();
    } finally {
      search = 'group=all';
    }
  });

  it('lọc Lỗi đơn (2026-11-10): lựa chọn SP ngoài hệ thống + câu hãng; URL orderError → danh sách + số đếm gửi từng khoá', async () => {
    const msgKey =
      'msg:Lưu danh sách đơn hàng không thành công. Đơn hàng thiếu thông tin địa chỉ (Đường hoặc Phường).';
    search = `group=all&orderError=NON_ERP_ITEMS,${encodeURIComponent(encodeURIComponent(msgKey))}`;
    const list: URLSearchParams[] = [];
    const counts: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders/order-error-options', () =>
        HttpResponse.json([
          { key: msgKey, code: 'CARRIER_REJECTED', message: msgKey.slice(4) },
          { key: 'code:CARRIER_WAYBILL_DATA', code: 'CARRIER_WAYBILL_DATA', message: null },
        ]),
      ),
      http.get('/api/sales-orders', ({ request }) => {
        list.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        counts.push(new URL(request.url).searchParams);
        return HttpResponse.json({ total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await waitFor(() =>
        expect(
          list.some((p) => p.getAll('orderError').join('|') === `NON_ERP_ITEMS|${msgKey}`),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(
          counts.some((p) => p.getAll('orderError').join('|') === `NON_ERP_ITEMS|${msgKey}`),
        ).toBe(true),
      );
      // Hai lỗi đã chọn → ô hiện "Lỗi đơn: 2 lỗi".
      const box = await screen.findByRole('combobox', { name: 'Lỗi đơn' });
      expect(box).toHaveTextContent('2 lỗi');
      fireEvent.click(box);
      expect(await screen.findByText('Có SP ngoài hệ thống')).toBeInTheDocument();
      expect(screen.getAllByText(msgKey.slice(4)).length).toBeGreaterThan(0);
    } finally {
      search = 'group=all';
    }
  });

  it('lọc Hãng lấy hàng + In tem (2026-11-10): hiện hai ô; URL pickup / printStatus → danh sách + số đếm tab cùng gửi, giá trị lạ bỏ qua', async () => {
    search = 'flow=PACKED&pickup=AWAITING&printStatus=NOT_PRINTED';
    const list: URLSearchParams[] = [];
    const counts: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        list.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        counts.push(new URL(request.url).searchParams);
        return HttpResponse.json({ total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      expect(await screen.findByRole('combobox', { name: 'Hãng lấy hàng' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'In tem' })).toBeInTheDocument();
      await waitFor(() =>
        expect(
          list.some(
            (p) =>
              p.get('flow') === 'PACKED' &&
              p.get('pickupStatus') === 'AWAITING' &&
              p.get('printStatus') === 'NOT_PRINTED',
          ),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(
          counts.some(
            (p) => p.get('pickupStatus') === 'AWAITING' && p.get('printStatus') === 'NOT_PRINTED',
          ),
        ).toBe(true),
      );
    } finally {
      search = 'group=all';
    }
    search = 'group=all&pickup=XYZ&printStatus=ABC';
    const odd: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        odd.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await waitFor(() => expect(odd.length).toBeGreaterThan(0));
      for (const p of odd) {
        expect(p.has('pickupStatus')).toBe(false);
        expect(p.has('printStatus')).toBe(false);
      }
    } finally {
      search = 'group=all';
    }
  });

  it('tab Đã xác nhận bỏ đơn đã có mã vận đơn (2026-11-06): danh sách + số đếm tab gửi warehouseNoWaybill=true', async () => {
    search = 'flow=WAREHOUSE';
    const list: URLSearchParams[] = [];
    const counts: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        list.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        counts.push(new URL(request.url).searchParams);
        return HttpResponse.json({ total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      await waitFor(() =>
        expect(
          list.some((p) => p.get('flow') === 'WAREHOUSE' && p.get('warehouseNoWaybill') === 'true'),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(counts.some((p) => p.get('warehouseNoWaybill') === 'true')).toBe(true),
      );
    } finally {
      search = 'group=all';
    }
  });

  it('tab cha "Đơn hàng | Cần xử lý" (clone màn Đơn hàng, 2026-11-09): số đỏ trên tab cha, "Đơn hàng" giữ tab trạng thái cũ', async () => {
    server.use(
      http.get('/api/sales-orders/tab-counts', () =>
        HttpResponse.json({ total: 7, attention: 7, counts: { PICKUP_FAILED: 7 } }),
      ),
    );
    renderApp(<PrintOrdersScreen />);
    await screen.findByText(FIRST.docNumber);
    const parent = screen.getByRole('tablist', { name: 'Nhóm tab' });
    expect(parent).toHaveTextContent('Đơn hàng');
    await waitFor(() => expect(parent).toHaveTextContent(/Cần xử lý\s*7/));
    // Tab "Đơn hàng" giữ nguyên dãy trạng thái cũ.
    expect(screen.getByRole('tablist', { name: 'Trạng thái đơn' })).toBeInTheDocument();
  });

  it('URL view=issues&ci=PICKUP_FAILED → dãy chip Cần xử lý thay tab trạng thái, danh sách gửi carrierIssue', async () => {
    search = 'view=issues&ci=PICKUP_FAILED';
    const list: URLSearchParams[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        list.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    try {
      renderApp(<PrintOrdersScreen />);
      const chips = await screen.findByRole('tablist', { name: 'Đơn cần xử lý' });
      expect(chips).toHaveTextContent('Không lấy được hàng');
      expect(screen.queryByRole('tablist', { name: 'Trạng thái đơn' })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(
          list.some((p) => p.getAll('carrierIssue').includes('PICKUP_FAILED') && !p.get('flow')),
        ).toBe(true),
      );
    } finally {
      search = 'group=all';
    }
  });
});
