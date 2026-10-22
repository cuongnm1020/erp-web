import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { WarehouseProvider } from '@/lib/warehouse';
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

/** Menu "Khác" của thanh chọn nhiều — Radix mở bằng bàn phím trong jsdom. */
const openMoreMenu = () =>
  fireEvent.keyDown(screen.getByRole('button', { name: /^Khác/ }), { key: 'ArrowDown' });

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
    // Mã Pancake bấm được → mở đúng đơn trên POS ở tab mới (2026-10-19).
    const pos = screen.getByRole('link', { name: 'Pancake #103' });
    expect(pos).toHaveAttribute('href', pancake.pancakeOrderLink);
    expect(pos).toHaveAttribute('target', '_blank');
    expect(pos).toHaveAttribute('rel', 'noreferrer');
    // Bấm link không bật xem nhanh của dòng.
    fireEvent.click(pos);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('đơn trùng trong ngày: chip "Trùng · N đơn" ở cột trạng thái; ?duplicate=true gửi lên server', async () => {
    search = 'duplicate=true';
    const seen: URLSearchParams[] = [];
    const orders = makeOrders(2);
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          items: [
            { ...orders[0]!, sameDayCount: 2 },
            { ...orders[1]!, sameDayCount: 0 },
          ],
          total: 2,
        });
      }),
    );
    renderApp(<OrderListScreen />);
    expect(await screen.findByText('Trùng · 3 đơn')).toBeInTheDocument();
    expect(screen.getAllByText(/^Trùng ·/)).toHaveLength(1);
    expect(seen.at(-1)!.get('duplicate')).toBe('true');
  });

  it('SĐT hiện đủ trên một dòng kèm nhà mạng rút gọn (Viettel / Vina / Mobi)', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    // i=0 → 0912345678 (Vinaphone), i=1 → 0386… (Viettel), i=2 → 0908… (Mobifone).
    // Viết liền để dán thẳng (2026-10-13).
    expect(screen.getAllByText('0912345678').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vina').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Viettel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobi').length).toBeGreaterThan(0);
  });

  it('bấm vào dòng → xem nhanh bên phải (người nhận, sản phẩm, tiền, hãng); Đóng thì tắt', async () => {
    search = 'flow=DELIVERED';
    renderApp(<OrderListScreen />);
    const row = makeOrders(60).find((o) => o.flow === 'DELIVERED')!;
    // Mã vận đơn giờ là nút sao chép (không mở xem nhanh) → bấm vào chính dòng.
    fireEvent.click((await screen.findByText(row.shipment!.trackingNo!)).closest('tr')!);
    const panel = await screen.findByRole('dialog');
    expect(panel).toHaveTextContent(row.docNumber);
    expect(panel).toHaveTextContent('Thành công');
    expect(panel).toHaveTextContent('Giao Hàng Tiết Kiệm');
    expect(panel).toHaveTextContent('170.000');
    expect(await screen.findByRole('link', { name: 'Mở đơn đầy đủ' })).toHaveAttribute(
      'href',
      `/crm/orders/${row.id}`,
    );
    // Redesign 2026-10-22: chân ngăn kéo có Nhân bản đơn + tiến độ giao hàng.
    expect(screen.getByRole('link', { name: /Nhân bản đơn/ })).toHaveAttribute(
      'href',
      `/crm/orders/new?from=${row.id}`,
    );
    expect(screen.getByRole('list', { name: 'Tiến độ đơn hàng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sao chép mã đơn/ })).toBeInTheDocument();
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
    openMoreMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Gán hãng \/ cân nặng/ }));
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
    expect(toastError.mock.calls).toEqual([]);
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
    openMoreMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Hủy đơn/ }));
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

  it('"Đóng gói + in vận đơn": chỉ gửi đơn đã duyệt + có hãng → POST /sales-orders/bulk-fulfil, in tem đơn có mã, liệt kê đơn lỗi kèm lời hãng; bỏ chọn sau khi in + đóng hộp lỗi', async () => {
    search = '';
    toastSuccess.mockClear();
    window.print = vi.fn();
    const rows = makeOrders(3).map((o, i) => ({
      ...o,
      status: 'APPROVED' as const,
      carrierId: i < 2 ? 'c-ghtk' : null,
    }));
    const fulfilBodies: unknown[] = [];
    const labelBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: rows.length })),
      http.post('/api/sales-orders/bulk-fulfil', async ({ request }) => {
        fulfilBodies.push(await request.json());
        return HttpResponse.json(
          {
            done: [
              {
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                shipmentId: 'sh-1',
                outcome: 'ISSUED',
                trackingNo: 'S1.A1.123',
              },
            ],
            failed: [
              {
                orderId: rows[1]!.id,
                docNumber: rows[1]!.docNumber,
                code: 'CARRIER_REJECTED',
                message: 'raw',
                carrierMessage: 'Địa chỉ không hợp lệ',
                packed: true,
              },
            ],
          },
          { status: 201 },
        );
      }),
      http.post('/api/shipments/label-data', async ({ request }) => {
        labelBodies.push(await request.json());
        return HttpResponse.json([
          {
            shipmentId: 'sh-1',
            shipmentDocNumber: 'DN2610-00001',
            orderDocNumber: rows[0]!.docNumber,
            carrierCode: 'GHTK',
            carrierName: 'Giao Hàng Tiết Kiệm',
            trackingNo: 'S1.A1.123',
            codAmount: '100000.0000',
            weightKg: '0.5000',
            recipient: {
              name: 'Khách A',
              phone: '0901234567',
              address: 'Ấp 1, Xã A, Tỉnh B',
              street: 'Ấp 1',
              locality: 'Xã A, Tỉnh B',
              fromWard: 'Xã A, Tỉnh B',
              fromDistrict: 'Tỉnh B',
              province: 'Tỉnh B',
            },
            sender: {
              name: 'Shop',
              phone: '0339213208',
              address: 'Kho, Xã C, Hà Nội',
              street: 'Kho',
              locality: 'Xã C, Hà Nội',
              fromWard: 'Xã C, Hà Nội',
              fromDistrict: 'Hà Nội',
              province: 'Hà Nội',
              warehouseName: 'Kho Long An',
            },
            allowInspection: false,
            callShopOnFailure: null,
            items: [{ name: 'Phân bón A', qty: '1.000000' }],
            note: null,
          },
        ]);
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(rows[0]!.docNumber);
    for (const i of [0, 1, 2]) {
      fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[i]!);
    }
    fireEvent.click(await screen.findByRole('button', { name: /Đóng gói \+ in vận đơn/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Đóng gói và in vận đơn 2 đơn?');
    expect(dialog).toHaveTextContent('1 đơn chưa duyệt hoặc chưa gán hãng sẽ bị bỏ qua');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng gói + in 2 đơn' }));

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(fulfilBodies).toEqual([{ orderIds: [rows[0]!.id, rows[1]!.id] }]);
    expect(labelBodies).toEqual([{ shipmentIds: ['sh-1'] }]);
    expect(toastSuccess).toHaveBeenCalledWith('Đã đóng gói 1 đơn, in 1 tem', undefined);
    const failed = await screen.findByRole('list', { name: 'Danh sách đơn lỗi' });
    expect(failed).toHaveTextContent(rows[1]!.docNumber);
    expect(failed).toHaveTextContent('Đã đóng gói (đã trừ tồn) nhưng chưa có mã vận đơn');
    expect(failed).toHaveTextContent('Địa chỉ không hợp lệ');
    expect(failed).not.toHaveTextContent('raw');
    // Còn hộp lỗi → chưa bỏ chọn; đóng hộp → bỏ chọn.
    // (hộp thoại modal đang mở → phần nền aria-hidden)
    expect(screen.getByRole('toolbar', { hidden: true })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0]!);
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('"Đóng gói + in vận đơn" với đơn đã có vận đơn (gửi ngoài ERP) → báo chỉ in lại tem, không "đã đóng gói" (SOP2610-49238)', async () => {
    search = '';
    toastSuccess.mockClear();
    const rows = makeOrders(1).map((o) => ({
      ...o,
      status: 'APPROVED' as const,
      carrierId: 'c-ghtk',
    }));
    const labelBodies: unknown[] = [];
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: 1 })),
      http.post('/api/sales-orders/bulk-fulfil', () =>
        HttpResponse.json(
          {
            done: [
              {
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                shipmentId: 'sh-out',
                outcome: 'ALREADY_ISSUED',
                trackingNo: 'S23013020.MN7-18-E02.1882917107',
              },
            ],
            failed: [],
          },
          { status: 201 },
        ),
      ),
      http.post('/api/shipments/label-data', async ({ request }) => {
        labelBodies.push(await request.json());
        return HttpResponse.json([]);
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(rows[0]!.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: /Đóng gói \+ in vận đơn/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng gói + in 1 đơn' }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Không đơn nào cần đóng gói, in 1 tem', {
        description: '1 đơn đã có vận đơn — chỉ in lại tem, không đóng gói lại.',
      }),
    );
    expect(labelBodies).toEqual([{ shipmentIds: ['sh-out'] }]);
  });

  it('không có quyền sales_order.fulfil_manual → không có nút "Đóng gói + in vận đơn" (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, {
      me: { ...ME_SALE, permissions: ['sales_order.read', 'sales_order.update', 'shipment.pack'] },
    });
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    openMoreMenu();
    expect(await screen.findByRole('menuitem', { name: /In lại vận đơn/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Đóng gói \+ in vận đơn/ }),
    ).not.toBeInTheDocument();
  });

  it('không có quyền sales_order.cancel → thanh chọn không có nút "Hủy đơn" (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, {
      me: { ...ME_SALE, permissions: ['sales_order.read', 'sales_order.update'] },
    });
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    openMoreMenu();
    expect(
      await screen.findByRole('menuitem', { name: /Gán hãng \/ cân nặng/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Hủy đơn/ })).not.toBeInTheDocument();
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
    expect(
      screen.getByRole('button', { name: 'Ngày đặt: 20/08 – 22/08/2026' }),
    ).toBeInTheDocument();
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

  it('ô Nguồn có ô tìm theo tên POS, không phân biệt dấu (2026-10-22)', async () => {
    search = '';
    server.use(
      http.get('/api/pancake-sync/shops', () =>
        HttpResponse.json([
          { shopId: '111', shopName: 'CSKH - DƯƠNG NỘI', isActive: true },
          { shopId: '222', shopName: '71-TikTok Shop', isActive: true },
          { shopId: '333', shopName: 'PN - AMINO 500ml -T6', isActive: true },
        ]),
      ),
    );
    renderApp(<OrderListScreen />);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Nguồn' }));
    const input = await screen.findByPlaceholderText('Tìm nguồn…');
    await screen.findByRole('option', { name: 'Pancake · 71-TikTok Shop' });
    fireEvent.change(input, { target: { value: 'cskh duong noi' } });
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Pancake · 71-TikTok Shop' })).toBeNull(),
    );
    expect(screen.queryByRole('option', { name: 'Pancake · PN - AMINO 500ml -T6' })).toBeNull();
    replace.mockClear();
    fireEvent.click(screen.getByRole('option', { name: 'Pancake · CSKH - DƯƠNG NỘI' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(decodeURIComponent(String(replace.mock.calls.at(-1)![0]))).toContain('source=POS:111');
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

describe('OrderListScreen — sao chép SĐT / mã vận đơn, cột kho (2026-10-13)', () => {
  const writeText = vi.fn(() => Promise.resolve());
  const setup = () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    writeText.mockClear();
    toastSuccess.mockClear();
    const rows: Array<
      Omit<ReturnType<typeof makeOrders>[number], 'warehouseId'> & {
        warehouseId: string | null;
      }
    > = makeOrders(60)
      .filter((o) => o.flow === 'DELIVERED' && o.phone !== null)
      .slice(0, 2);
    rows[0] = { ...rows[0]!, warehouseId: 'wh-tt' };
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: rows.length })),
    );
    search = '';
    // Tên kho trên cột lấy từ kho được phép của phiên (/auth/me) — sale không cần stock.read.
    renderApp(
      <WarehouseProvider
        me={{
          ...ME_SALE,
          managesDepartments: false,
          managesCareTeam: false,
          warehouseIds: null,
          warehouses: [{ id: 'wh-tt', code: 'KHO-TT-01', name: 'Kho Thạch Thất' }],
          defaultWarehouseId: 'wh-tt',
          selectedWarehouseId: null,
        }}
      >
        <OrderListScreen />
      </WarehouseProvider>,
    );
    return rows;
  };

  it('icon sao chép cạnh SĐT (viết liền) → sao chép, không mở xem nhanh (2026-10-22)', async () => {
    const [row] = setup();
    expect((await screen.findAllByText(row!.phone!)).length).toBeGreaterThan(0);
    const copy = screen.getAllByRole('button', {
      name: `Sao chép số điện thoại ${row!.phone}`,
    })[0]!;
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(row!.phone));
    expect(await screen.findByText('Đã sao chép')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('icon sao chép cạnh mã đơn → chép đúng mã, không mở xem nhanh', async () => {
    const [row] = setup();
    const copy = await screen.findByRole('button', {
      name: `Sao chép mã đơn ${row!.docNumber}`,
    });
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(row!.docNumber));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hãng hiện viết tắt (GHTK, tên đầy đủ ở tooltip); bấm → sao chép mã vận đơn', async () => {
    const [row] = setup();
    const tracking = row!.shipment!.trackingNo!;
    const buttons = await screen.findAllByRole('button', {
      name: `Sao chép mã vận đơn ${tracking}`,
    });
    // Hai chỗ bấm: mã hãng viết tắt + dòng mã vận đơn.
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent(/^GHTK$/);
    expect(screen.getAllByTitle('Giao Hàng Tiết Kiệm').length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(tracking));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('không còn cột Kho — danh sách đã lọc theo kho làm việc (redesign 2026-10-22)', async () => {
    setup();
    await screen.findByRole('columnheader', { name: /Khách hàng/ });
    expect(screen.queryByRole('columnheader', { name: /^Kho$/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Kho Thạch Thất')).not.toBeInTheDocument();
  });
});

describe('OrderListScreen — chọn cột, sắp xếp theo cột, lọc SP ngoài ERP (2026-10-22)', () => {
  it('tuỳ chọn đã lưu của người dùng: cột ẩn không hiện, sắp xếp gửi sortBy/sortDir lên server', async () => {
    search = '';
    const seen: URLSearchParams[] = [];
    server.use(
      http.get('/api/me/preferences/:key', () =>
        HttpResponse.json({
          key: 'orders.list',
          value: { hidden: ['address'], sort: { id: 'total', desc: true } },
        }),
      ),
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: makeOrders(1), total: 1 });
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    await waitFor(() => expect(seen.at(-1)!.get('sortBy')).toBe('total'));
    expect(seen.at(-1)!.get('sortDir')).toBe('desc');
    expect(screen.queryByRole('columnheader', { name: /Địa chỉ nhận/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tổng tiền/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('bỏ tick cột trong "Cột" → cột ẩn + lưu lên server; bấm tiêu đề cột → sắp + lưu', async () => {
    search = '';
    const puts: unknown[] = [];
    server.use(
      http.put('/api/me/preferences/:key', async ({ request }) => {
        const body = (await request.json()) as { value: unknown };
        puts.push(body.value);
        return HttpResponse.json({ key: 'orders.list', value: body.value });
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    expect(screen.getByRole('columnheader', { name: /Sản phẩm/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cột/ }));
    const mã = await screen.findByRole('checkbox', { name: 'Mã đơn' });
    expect(mã).toBeDisabled();
    // Cột thao tác không nằm trong "Cột" (không ẩn được).
    expect(screen.queryByRole('checkbox', { name: 'Thao tác' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sản phẩm' }));
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /Sản phẩm/ })).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(puts.at(-1)).toEqual({ hidden: ['orderDate', 'collected', 'product'], sort: null }),
    );

    replace.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo Khách hàng' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(String(replace.mock.calls.at(-1)![0])).toContain('sort=customer');
    await waitFor(() =>
      expect(puts.at(-1)).toEqual({
        hidden: ['orderDate', 'collected', 'product'],
        sort: { id: 'customer', desc: false },
      }),
    );
  });

  it('?itemOrigin=NON_ERP từ URL → gửi lên server cho danh sách và đếm tab', async () => {
    search = 'itemOrigin=NON_ERP';
    const seen: string[] = [];
    server.use(
      http.get('/api/sales-orders', ({ request }) => {
        seen.push(`list:${new URL(request.url).searchParams.get('itemOrigin')}`);
        return HttpResponse.json({ items: makeOrders(1), total: 1 });
      }),
      http.get('/api/sales-orders/flow-counts', ({ request }) => {
        seen.push(`count:${new URL(request.url).searchParams.get('itemOrigin')}`);
        return HttpResponse.json({ total: 1 });
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    expect(seen).toContain('list:NON_ERP');
    expect(seen).toContain('count:NON_ERP');
  });
});

describe('OrderListScreen — redesign Bán hàng (2026-10-22)', () => {
  it('menu "⋯" của dòng có "Nhân bản đơn" → /crm/orders/new?from=<id>', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.keyDown(
      screen.getByRole('button', { name: `Thao tác khác cho đơn ${FIRST.docNumber}` }),
      { key: 'ArrowDown' },
    );
    const item = await screen.findByRole('menuitem', { name: /Nhân bản đơn/ });
    expect(item).toHaveAttribute('href', `/crm/orders/new?from=${FIRST.id}`);
    expect(screen.getByRole('menuitem', { name: /Mở chi tiết/ })).toHaveAttribute(
      'href',
      `/crm/orders/${FIRST.id}`,
    );
  });

  it('sale không có quyền tạo đơn → menu dòng không có "Nhân bản đơn" (luật 7)', async () => {
    search = '';
    renderApp(<OrderListScreen />, {
      me: { ...ME_SALE, permissions: ['sales_order.read'] },
    });
    await screen.findByText(FIRST.docNumber);
    fireEvent.keyDown(
      screen.getByRole('button', { name: `Thao tác khác cho đơn ${FIRST.docNumber}` }),
      { key: 'ArrowDown' },
    );
    await screen.findByRole('menuitem', { name: /Mở chi tiết/ });
    expect(screen.queryByRole('menuitem', { name: /Nhân bản đơn/ })).not.toBeInTheDocument();
  });

  it('lọc ít dùng nằm sau "Thêm lọc"; đang có giá trị trên URL thì tự hiện', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    expect(screen.queryByRole('combobox', { name: 'Trùng trong ngày' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: /Thêm lọc/ }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Trùng trong ngày/ }));
    expect(await screen.findByRole('combobox', { name: 'Trùng trong ngày' })).toBeInTheDocument();
  });

  it('?duplicate=true → ô "Trùng trong ngày" hiện sẵn', async () => {
    search = 'duplicate=true';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    expect(screen.getByRole('combobox', { name: 'Trùng trong ngày' })).toBeInTheDocument();
  });

  it('chọn dòng → thanh chọn nhiều thay thanh lọc, có tổng tiền; Esc / "Bỏ chọn" trả lại thanh lọc', async () => {
    search = '';
    renderApp(<OrderListScreen />);
    await screen.findByText(FIRST.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    const bar = await screen.findByRole('toolbar');
    expect(bar).toHaveTextContent('1 đơn đã chọn');
    expect(bar).toHaveTextContent('tổng');
    expect(screen.queryByRole('textbox', { name: 'Tìm nhanh' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(await screen.findByRole('textbox', { name: 'Tìm nhanh' })).toBeInTheDocument();
  });

  it('"Lưu bộ lọc hiện tại…" → PUT /me/preferences/orders.views với query đang lọc', async () => {
    search = 'flow=WAREHOUSE&noCarrier=true&page=3';
    const puts: Array<{ key: string; value: unknown }> = [];
    server.use(
      http.put('/api/me/preferences/:key', async ({ request, params }) => {
        const body = (await request.json()) as { value: unknown };
        puts.push({ key: String(params.key), value: body.value });
        return HttpResponse.json({ key: params.key, value: body.value });
      }),
      http.get('/api/sales-orders', () => HttpResponse.json({ items: makeOrders(1), total: 1 })),
    );
    renderApp(<OrderListScreen />);
    await screen.findByRole('columnheader', { name: /Khách hàng/ });
    fireEvent.keyDown(screen.getByRole('button', { name: /Bộ lọc đã lưu/ }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Lưu bộ lọc hiện tại/ }));
    fireEvent.change(await screen.findByLabelText('Tên bộ lọc'), {
      target: { value: 'Kho chưa gán hãng' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bộ lọc' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      key: 'orders.views',
      value: { views: [{ name: 'Kho chưa gán hãng', query: 'flow=WAREHOUSE&noCarrier=true' }] },
    });
  });
});
