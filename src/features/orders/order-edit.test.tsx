import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  CARRIERS,
  ME_SALE,
  makeCustomerAddresses,
  makeOrderDetail,
  makeOrders,
  makeShippingQuote,
  ORDER_SHIPMENT_FIXTURE,
  PICKUP_WAREHOUSES,
  scenario,
} from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderEditScreen } from './components/order-edit-screen';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/orders/x/edit',
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ORDER = makeOrders(1)[0]!; // i=0 → DRAFT
const DETAIL = makeOrderDetail(ORDER.id)!;

describe('OrderEditScreen — trang sửa đơn (D-05, PATCH /sales-orders/{id})', () => {
  it('loading → hai cột: sản phẩm + giá trị đơn (chỉ đọc) và thông tin / khách hàng / vận chuyển', async () => {
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(screen.getByRole('status', { name: 'Đang tải chi tiết' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      `Sửa đơn ${ORDER.docNumber}`,
    );
    // 2026-10-22: bố cục chép màn tạo đơn.
    for (const t of [
      'Thông tin đơn',
      'Sản phẩm',
      'Giá trị đơn hàng',
      'Ghi chú',
      'Khách hàng',
      'Nhận hàng',
      'Vận chuyển',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeInTheDocument();
    }
    expect(screen.getByText('Tiền cần thu')).toBeInTheDocument();
    // Dòng hàng chỉ đọc: có mã SKU, không có ô nhập số lượng
    expect(screen.getByText(DETAIL.lines[0]!.skuCode)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('Thu hộ (COD)')).toBeInTheDocument();
    // Lối đổi dòng hàng: Nhân bản đơn (giữ đơn) hoặc hủy & tạo lại.
    expect(screen.getByRole('link', { name: 'Nhân bản đơn' })).toHaveAttribute(
      'href',
      `/crm/orders/new?from=${ORDER.id}`,
    );
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Hủy bỏ/ })).toHaveAttribute(
      'href',
      `/crm/orders/${ORDER.id}`,
    );
  });

  it('DRAFT + admin: chỉ đích Đã duyệt / Đã hủy; chọn Đã duyệt + giao thủ công → PATCH 2 trường → về chi tiết', async () => {
    push.mockClear();
    const calls: Array<{ id: string; body: Record<string, unknown> }> = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.push({ id: params.id as string, body });
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: body.status ?? ORDER.status,
          carrierId: body.carrierId ?? null,
          changed: Object.keys(body),
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });

    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Đơn mới (hiện tại)',
      'Đã duyệt',
      'Đã hủy',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Đã duyệt' }));

    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      // Ô chọn hãng dùng chung: chỉ hãng đã cấu hình (GHN chưa cấu hình ẩn), mỗi tài khoản một
      // dòng "<MÃ HÃNG> <tên>"; hãng không tài khoản (giao thủ công) hiện tên hãng.
      '— Chưa chọn —',
      CARRIERS[0]!.name,
      `GHTK ${CARRIERS[3]!.name}`,
      `VTP ${CARRIERS[4]!.name}`,
    ]);
    fireEvent.click(screen.getByRole('option', { name: CARRIERS[0]!.name }));

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() =>
      expect(calls).toEqual([
        { id: ORDER.id, body: { status: 'APPROVED', carrierId: 'c-manual' } },
      ]),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('sửa ghi chú nội bộ + ngày hẹn nhận → ô tô vàng, PATCH gửi đúng 2 trường (API 2026-10-22)', async () => {
    push.mockClear();
    const calls: Array<Record<string, unknown>> = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: ORDER.status,
          carrierId: null,
          changed: Object.keys(body),
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.change(screen.getByLabelText('Ghi chú nội bộ'), {
      target: { value: '  Gọi trước 30 phút ' },
    });
    fireEvent.change(screen.getByLabelText('Hẹn nhận hàng'), { target: { value: '2026-11-01' } });
    expect(screen.getAllByText('2 thay đổi chưa lưu').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() =>
      expect(calls).toEqual([
        { internalNote: 'Gọi trước 30 phút', expectedDeliveryDate: '2026-11-01' },
      ]),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('chọn hãng có bảng cước (GHTK) → hỏi GET shipping-quote?carrierId và hiện cước; hãng không có quote → không hỏi', async () => {
    const asked: string[] = [];
    server.use(
      http.get('/api/sales-orders/:id/shipping-quote', ({ params, request }) => {
        const carrierId = new URL(request.url).searchParams.get('carrierId') ?? '';
        asked.push(`${params.id as string}?${carrierId}`);
        return HttpResponse.json(makeShippingQuote(params.id as string, carrierId));
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('Cước hãng báo')).not.toBeInTheDocument();

    // Select hãng khoá tới khi GET /carriers về.
    const picker = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', { name: `GHTK ${CARRIERS[3]!.name}` }));
    expect(await screen.findByText('Cước hãng báo')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/0\.7500 kg · Lấy hàng tại Hồ Chí Minh · Phường Tân Tạo A/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('Cước hãng báo').nextElementSibling).toHaveTextContent('28.000');
    expect(asked).toEqual([`${ORDER.id}?c-ghtk`]);

    // Giao thủ công không có `quote` → dòng cước biến mất, không gọi thêm.
    fireEvent.click(screen.getByRole('combobox', { name: 'Hãng vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: CARRIERS[0]!.name }));
    await waitFor(() => expect(screen.queryByText('Cước hãng báo')).not.toBeInTheDocument());
    expect(asked).toEqual([`${ORDER.id}?c-ghtk`]);
  });

  it('chọn kho lấy hàng → hỏi cước kèm warehouseId, hiện địa chỉ điểm lấy; lưu → chuyển kho (move-warehouse) rồi PATCH phần còn lại', async () => {
    push.mockClear();
    const asked: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    const moves: unknown[] = [];
    server.use(
      http.post('/api/sales-orders/move-warehouse', async ({ request }) => {
        const body = (await request.json()) as { orderIds: string[]; warehouseId: string };
        moves.push(body);
        return HttpResponse.json({
          moved: [
            {
              orderId: body.orderIds[0],
              docNumber: ORDER.docNumber,
              fromWarehouseId: null,
              outcome: 'MOVED',
              pick: 'replanned',
              awaitingStock: false,
            },
          ],
          failed: [],
        });
      }),
      http.get('/api/sales-orders/:id/shipping-quote', ({ params, request }) => {
        const q = new URL(request.url).searchParams;
        asked.push(`${q.get('carrierId')}@${q.get('warehouseId') ?? '-'}`);
        return HttpResponse.json(makeShippingQuote(params.id as string, q.get('carrierId') ?? ''));
      }),
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: ORDER.status,
          carrierId: body.carrierId ?? null,
          warehouseId: body.warehouseId ?? null,
          changed: Object.keys(body),
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });

    const whPicker = screen.getByRole('combobox', { name: 'Kho lấy hàng' });
    await waitFor(() => expect(whPicker).toBeEnabled());
    fireEvent.click(whPicker);
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      '— Chưa chọn —',
      `${PICKUP_WAREHOUSES[0]!.name} (WH01)`,
      `${PICKUP_WAREHOUSES[1]!.name} (WH02) — chưa khai địa chỉ`,
    ]);
    fireEvent.click(screen.getByRole('option', { name: `${PICKUP_WAREHOUSES[0]!.name} (WH01)` }));
    expect(
      screen.getByText(/Điểm lấy hàng gửi hãng: Lô A1 KCN Tân Tạo, Phường Tân Tạo A/),
    ).toBeInTheDocument();

    const carrierPicker = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(carrierPicker).toBeEnabled());
    fireEvent.click(carrierPicker);
    fireEvent.click(await screen.findByRole('option', { name: `GHTK ${CARRIERS[3]!.name}` }));
    await waitFor(() => expect(asked).toEqual(['c-ghtk@wh-hcm']));

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(moves).toEqual([{ orderIds: [ORDER.id], warehouseId: 'wh-hcm' }]));
    await waitFor(() => expect(bodies).toEqual([{ carrierId: 'c-ghtk' }]));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('địa chỉ giao: hiện địa chỉ hiệu lực (mặc định của khách); chọn địa chỉ khác → hỏi cước kèm addressId; lưu → PATCH addressId', async () => {
    push.mockClear();
    const asked: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    const addrs = makeCustomerAddresses(ORDER.customer.id);
    server.use(
      http.get('/api/sales-orders/:id', () =>
        HttpResponse.json({
          ...DETAIL,
          addressId: null,
          shippingAddress: { ...addrs[0]!, source: 'CUSTOMER_DEFAULT' },
        }),
      ),
      http.get('/api/sales-orders/:id/shipping-quote', ({ params, request }) => {
        const q = new URL(request.url).searchParams;
        asked.push(`${q.get('carrierId')}@${q.get('addressId') ?? '-'}`);
        return HttpResponse.json(makeShippingQuote(params.id as string, q.get('carrierId') ?? ''));
      }),
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: ORDER.status,
          carrierId: null,
          warehouseId: null,
          addressId: body.addressId ?? null,
          changed: Object.keys(body),
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    // Địa chỉ hiệu lực server trả (mặc định của khách) hiện ngay, trước cả khi tải danh sách.
    expect(await screen.findByText(/Nguyễn Thị Thu Hà · 0903112233/)).toBeInTheDocument();

    const picker = screen.getByRole('combobox', { name: 'Địa chỉ giao' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options[0]).toBe('— Mặc định của khách —');
    expect(options).toHaveLength(3);
    fireEvent.click(screen.getByRole('option', { name: /Trần Văn Bình/ }));
    expect(screen.getByText(/Trần Văn Bình · 0912345678/)).toBeInTheDocument();

    const carrierPicker = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(carrierPicker).toBeEnabled());
    fireEvent.click(carrierPicker);
    fireEvent.click(await screen.findByRole('option', { name: `GHTK ${CARRIERS[3]!.name}` }));
    await waitFor(() => expect(asked).toEqual([`c-ghtk@${addrs[1]!.id}`]));

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(bodies).toEqual([{ carrierId: 'c-ghtk', addressId: addrs[1]!.id }]));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('không có customer.read (kho mở đơn bằng read_all) → không ô chọn địa chỉ, vẫn hiện địa chỉ hiệu lực', async () => {
    const addrs = makeCustomerAddresses(ORDER.customer.id);
    server.use(
      http.get('/api/sales-orders/:id', () =>
        HttpResponse.json({
          ...DETAIL,
          addressId: addrs[0]!.id,
          shippingAddress: { ...addrs[0]!, source: 'ORDER' },
        }),
      ),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />, {
      me: {
        ...ME_SALE,
        permissions: ['sales_order.read', 'sales_order.read_all', 'sales_order.update'],
      },
    });
    await screen.findByRole('heading', { level: 1 });
    expect(await screen.findByText(/Nguyễn Thị Thu Hà/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Địa chỉ giao' })).not.toBeInTheDocument();
  });

  it('hỏi cước lỗi (đơn chưa có địa chỉ giao, 422) → hiện thông điệp lỗi tại chỗ, vẫn lưu được hãng', async () => {
    server.use(
      http.get('/api/sales-orders/:id/shipping-quote', () =>
        HttpResponse.json(
          {
            code: 'CARRIER_WAYBILL_DATA',
            message:
              'GHTK: đơn SO-1 chưa có địa chỉ giao đủ tỉnh/thành — chọn địa chỉ giao rồi tra cước lại',
            statusCode: 422,
          },
          { status: 422 },
        ),
      ),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    const picker = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', { name: `GHTK ${CARRIERS[3]!.name}` }));
    // Luật 6: không render message thô của server — câu từ bộ dịch lỗi theo `code`.
    await waitFor(() =>
      expect(screen.getByText(/Đơn chưa có địa chỉ giao đủ tỉnh\/thành/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeEnabled();
  });

  it('chọn Đã hủy → hiện ô lý do, lý do đi vào body; Ctrl+S lưu', async () => {
    push.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: 'CANCELLED',
          carrierId: null,
          changed: ['status'],
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Lý do hủy')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Đã hủy' }));
    fireEvent.change(await screen.findByLabelText('Lý do hủy'), {
      target: { value: 'Khách bom hàng' },
    });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() =>
      expect(bodies).toEqual([{ status: 'CANCELLED', reason: 'Khách bom hàng' }]),
    );
  });

  it('không đổi gì → Lưu không gọi API, về chi tiết; Esc cũng về chi tiết', async () => {
    push.mockClear();
    let calls = 0;
    server.use(
      http.patch('/api/sales-orders/:id', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
    expect(calls).toBe(0);
    push.mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`);
  });

  it('không có sales_order.update → chỉ đọc: banner, không nút Lưu, hai select bị khóa (luật 7 + trạng thái chỉ đọc)', async () => {
    renderApp(<OrderEditScreen orderId={ORDER.id} />, { me: ME_SALE });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('Bạn chỉ có quyền xem đơn này');
    expect(screen.queryByRole('button', { name: /Lưu thay đổi/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toBeDisabled();
    // Sale không chọn hãng (2026-10-31): không có ô chọn, chỉ dòng chữ.
    expect(screen.queryByRole('combobox', { name: 'Hãng vận chuyển' })).not.toBeInTheDocument();
    expect(screen.getByText('Kho chọn hãng vận chuyển khi gửi sang ĐVVC.')).toBeInTheDocument();
  });

  it('đơn POSTED: hãng khóa, chỉ còn Đã hủy; đơn CANCELLED: banner trạng thái cuối, nút Lưu bị khóa', async () => {
    const posted = makeOrders(60).find((o) => o.status === 'POSTED')!;
    server.use(
      http.get('/api/sales-orders/:id', () =>
        HttpResponse.json({
          ...makeOrderDetail(posted.id)!,
          carrierId: 'c-ghn',
          carrier: { id: 'c-ghn', code: 'GHN', name: CARRIERS[1]!.name },
        }),
      ),
    );
    const { unmount } = renderApp(<OrderEditScreen orderId={posted.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('combobox', { name: 'Hãng vận chuyển' })).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Đã chốt (hiện tại)',
      'Đã hủy',
    ]);
    unmount();

    const cancelled = makeOrders(60).find((o) => o.status === 'CANCELLED')!;
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(makeOrderDetail(cancelled.id))),
    );
    renderApp(<OrderEditScreen orderId={cancelled.id} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('Đơn đã hủy');
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeDisabled();
  });

  it('404: lối về danh sách; 500: ErrorState có traceId', async () => {
    server.use(scenario.orderNotFound);
    const { unmount } = renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(await screen.findByText('Không có đơn hàng này')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách Đơn hàng' })).toBeInTheDocument();
    unmount();
    server.use(scenario.orderError);
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
  });
});

describe('OrderEditScreen — "Trạng thái kho" đặt tay (POST /sales-orders/{id}/fulfil)', () => {
  const APPROVED = { ...DETAIL, status: 'APPROVED' as const };

  it('chọn "Chờ chuyển hàng" (đóng gói tay) + hãng GHTK → PATCH carrierId rồi POST fulfil PACKED; vận đơn ISSUED → về chi tiết kèm ?printLabel=1', async () => {
    push.mockClear();
    const patched: Record<string, unknown>[] = [];
    const fulfilled: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(APPROVED)),
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patched.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: 'APPROVED',
          carrierId: body.carrierId ?? null,
          warehouseId: null,
          addressId: null,
          changed: Object.keys(body),
        });
      }),
      http.post('/api/sales-orders/:id/fulfil', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        fulfilled.push(body);
        return HttpResponse.json(
          {
            orderId: params.id,
            docNumber: ORDER.docNumber,
            target: body.target,
            pickTaskId: 'pick-1',
            pickTaskDocNumber: 'PICK2609-00001',
            pickForced: true,
            shipmentId: 'ship-1',
            shipmentDocNumber: 'DN2609-00001',
            packTaskId: 'pack-1',
            packed: true,
            alreadyPacked: false,
            waybill: {
              shipmentId: 'ship-1',
              shipmentDocNumber: 'DN2609-00001',
              carrierCode: 'GHTK',
              outcome: 'ISSUED',
              trackingNo: 'S1.A1',
              reason: null,
            },
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });

    const kho = screen.getByRole('combobox', { name: 'Trạng thái kho' });
    fireEvent.click(kho);
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Chờ pick (hiện tại)',
      'Đã pick xong',
      'Chờ chuyển hàng',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Chờ chuyển hàng' }));
    expect(screen.getByText(/Đóng gói KHÔNG quét/)).toBeInTheDocument();

    // Chưa chọn hãng → chặn tại chỗ, không gọi API nào.
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    expect(patched).toHaveLength(0);
    expect(fulfilled).toHaveLength(0);

    const carrierPicker = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(carrierPicker).toBeEnabled());
    fireEvent.click(carrierPicker);
    fireEvent.click(await screen.findByRole('option', { name: `GHTK ${CARRIERS[3]!.name}` }));
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(fulfilled).toEqual([{ target: 'PACKED' }]));
    expect(patched).toEqual([{ carrierId: 'c-ghtk' }]);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}?printLabel=1`));
  });

  it('"Đã pick xong" không cần hãng, không PATCH gì → chỉ POST fulfil PICKED rồi về chi tiết', async () => {
    push.mockClear();
    const fulfilled: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(APPROVED)),
      http.post('/api/sales-orders/:id/fulfil', async ({ params, request }) => {
        fulfilled.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          {
            orderId: params.id,
            docNumber: ORDER.docNumber,
            target: 'PICKED',
            pickTaskId: 'pick-1',
            pickTaskDocNumber: 'PICK2609-00001',
            pickForced: true,
            shipmentId: 'ship-1',
            shipmentDocNumber: 'DN2609-00001',
            packTaskId: 'pack-1',
            packed: false,
            alreadyPacked: false,
            waybill: null,
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái kho' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Đã pick xong' }));
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(fulfilled).toEqual([{ target: 'PICKED' }]));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });

  it('không có sales_order.fulfil_manual → chỉ nhãn trạng thái kho, không ô chọn; đơn DRAFT cũng không có đích', async () => {
    server.use(http.get('/api/sales-orders/:id', () => HttpResponse.json(APPROVED)));
    renderApp(<OrderEditScreen orderId={ORDER.id} />, {
      me: { ...ME_SALE, permissions: ['sales_order.read', 'sales_order.update'] },
    });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('combobox', { name: 'Trạng thái kho' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Chờ pick').length).toBeGreaterThan(0);
  });
});

describe('OrderEditScreen — Lỗi vận đơn + SĐT người nhận riêng cho đơn (2026-10-28)', () => {
  const WAYBILL_ERROR = {
    ...DETAIL,
    status: 'APPROVED' as const,
    marketplace: 'TIKTOK' as const,
    recipientPhoneMasked: true,
    shipment: {
      ...ORDER_SHIPMENT_FIXTURE,
      docNumber: 'DN2610-68638',
      trackingNo: null,
      lastCarrierEvent: null,
      waybillError: 'Số điện thoại khách hàng không hợp lệ.',
      waybillErrorCode: 'CARRIER_REJECTED',
      waybillErrorAt: '2026-10-27T21:47:00.946Z',
    },
  };

  it('hộp đỏ nêu lời hãng; ô SĐT tô đỏ khi số bị che; nhập số thật → "Lưu và xin lại vận đơn" PATCH recipientPhone rồi POST /shipments/:id/waybill → về chi tiết in tem', async () => {
    push.mockClear();
    const patched: Record<string, unknown>[] = [];
    const waybill: unknown[] = [];
    server.use(
      http.get('/api/sales-orders/:id', () => HttpResponse.json(WAYBILL_ERROR)),
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patched.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: 'APPROVED',
          carrierId: null,
          carrierAccountId: null,
          warehouseId: null,
          addressId: null,
          shippingWeightKg: null,
          shippingOptions: null,
          changed: ['recipientPhone'],
        });
      }),
      http.post('/api/shipments/:id/waybill', async ({ params, request }) => {
        waybill.push({ id: params.id, body: await request.json() });
        return HttpResponse.json(
          {
            shipmentId: params.id,
            shipmentDocNumber: 'DN2610-68638',
            carrierCode: 'GHTK',
            outcome: 'ISSUED',
            trackingNo: 'S23119447.BO.1',
            reason: null,
            jobId: null,
          },
          { status: 201 },
        );
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    const alert = await screen.findByText('GHTK không cấp được vận đơn');
    expect(alert.closest('[role="alert"]')).toHaveTextContent(
      'Hãng báo: “Số điện thoại khách hàng không hợp lệ.”',
    );
    expect(screen.getByText('TikTok')).toBeInTheDocument();
    const phone = screen.getByLabelText('SĐT người nhận cho đơn này');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/SĐT đang bị che — hãng sẽ từ chối/)).toBeInTheDocument();

    fireEvent.change(phone, { target: { value: '0387123430' } });
    expect(phone).not.toHaveAttribute('aria-invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và xin lại vận đơn' }));

    await waitFor(() => expect(patched).toEqual([{ recipientPhone: '0387123430' }]));
    await waitFor(() =>
      expect(waybill).toEqual([{ id: ORDER_SHIPMENT_FIXTURE.id, body: { carrierCode: 'GHTK' } }]),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}?printLabel=1`));
  });

  it('không quyền shipment.pack → vẫn thấy lỗi, không có nút xin lại vận đơn', async () => {
    server.use(http.get('/api/sales-orders/:id', () => HttpResponse.json(WAYBILL_ERROR)));
    renderApp(<OrderEditScreen orderId={ORDER.id} />, {
      me: { ...ME_SALE, permissions: ['sales_order.read', 'sales_order.update'] },
    });
    await screen.findByText('GHTK không cấp được vận đơn');
    expect(screen.queryByRole('button', { name: /xin lại vận đơn/i })).not.toBeInTheDocument();
  });
});

describe('OrderEditScreen — sửa sản phẩm / người nhận, quyền sửa, lịch sử (2026-10-29)', () => {
  const withDetail = (patch: Record<string, unknown>) =>
    server.use(
      http.get('/api/sales-orders/:id', ({ params }) =>
        HttpResponse.json({ ...makeOrderDetail(params.id as string)!, ...patch }),
      ),
    );

  it('đơn người khác (canEdit=false) → banner, ô ghi chú khóa, nút Sửa người nhận ẩn', async () => {
    withDetail({ canEdit: false, linesLockedReason: 'Chỉ người tạo đơn được sửa' });
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(await screen.findByText(/Đơn của người khác/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ghi chú nội bộ')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Sửa người nhận/ })).not.toBeInTheDocument();
  });

  it('Sửa người nhận → PATCH gửi address (tên, SĐT chuẩn hoá, địa chỉ), không gửi addressId', async () => {
    push.mockClear();
    const calls: Array<Record<string, unknown>> = [];
    server.use(
      http.patch('/api/sales-orders/:id', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.push(body);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          status: ORDER.status,
          carrierId: null,
          changed: ['addressId'],
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Sửa người nhận/ }));
    const set = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set('Tên người nhận', 'Chị Mai');
    set('SĐT', '0912 345 678');
    set('Địa chỉ (số nhà, đường, thôn)', '12 Lê Lợi');
    set('Phường / xã', '');
    set('Quận / huyện', '');
    set('Tỉnh / thành', 'Hà Nội');
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() =>
      expect(calls).toEqual([
        {
          address: {
            recipient: 'Chị Mai',
            phone: '0912345678',
            line1: '12 Lê Lợi',
            province: 'Hà Nội',
          },
        },
      ]),
    );
  });

  it('lịch sử sửa đơn: người sửa, giờ, từng thay đổi cũ → mới', async () => {
    server.use(
      http.get('/api/sales-orders/:id/edit-history', () =>
        HttpResponse.json([
          {
            id: 'log-1',
            at: '2026-10-29T03:00:00.000Z',
            userId: 'u1',
            userName: 'Nguyễn Thị Thu Hương',
            changes: [
              { field: 'lines', label: 'Thêm sản phẩm', from: null, to: 'SP-0112 ×2' },
              { field: 'total', label: 'Tổng tiền', from: '295.000', to: '595.000' },
            ],
          },
        ]),
      ),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Lịch sử sửa đơn' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Nguyễn Thị Thu Hương')).toBeInTheDocument();
    expect(screen.getByText('SP-0112 ×2')).toBeInTheDocument();
    expect(screen.getByText('295.000')).toBeInTheDocument();
  });

  it('giỏ sửa được: tăng SL dòng đầu → PUT /lines (giữ đơn giá cũ) rồi về chi tiết', async () => {
    push.mockClear();
    withDetail({ linesLockedReason: null });
    const puts: Array<Record<string, unknown>> = [];
    server.use(
      http.put('/api/sales-orders/:id/lines', async ({ params, request }) => {
        puts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          orderId: params.id,
          docNumber: ORDER.docNumber,
          subtotal: '0.0000',
          discount: '0.0000',
          total: '100000.0000',
          awaitingStock: false,
          pick: 'replanned',
        });
      }),
    );
    renderApp(<OrderEditScreen orderId={ORDER.id} />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Tăng số lượng' }))[0]!);
    expect(screen.getAllByText(/thay đổi chưa lưu/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(puts).toHaveLength(1));
    const first = DETAIL.lines.find((l) => !l.combo)!;
    const sent = (puts[0]!.lines as Array<Record<string, string>>)[0]!;
    expect(sent.skuId).toBe(first.skuId);
    expect(sent.unitPrice).toBeDefined();
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/crm/orders/${ORDER.id}`));
  });
});
