import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';
import { toShippingOptions, DEFAULT_SHIPPING_OPTIONS_FORM } from './shipping-options';

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

const selectTwoRows = async () => {
  renderApp(<OrderListScreen />);
  await screen.findByText(FIRST.docNumber);
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
  expect(await screen.findByRole('toolbar')).toBeInTheDocument();
};

/** Radix DropdownMenu mở bằng bàn phím trong jsdom (pointerdown không có `button`). */
const openMenu = () =>
  fireEvent.keyDown(screen.getByRole('button', { name: /Gửi sang ĐVVC/ }), { key: 'ArrowDown' });

const openFor = async (code: string) => {
  openMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name: `Sang ${code}` }));
  return screen.findByRole('dialog');
};

describe('Gửi sang ĐVVC — SendToCarrierMenu + SendToCarrierDialog', () => {
  it('menu dựng từ GET /carriers: chỉ hãng bật và có adapter (GHN chưa cấu hình → mờ, MANUAL/OLD ẩn)', async () => {
    search = '';
    toastSuccess.mockClear();
    await selectTwoRows();
    openMenu();
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Sang GHN',
      'Sang GHTK',
      'Sang VTP',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'Sang GHN' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(menu).queryByText(/MANUAL|OLD/)).not.toBeInTheDocument();
  });

  it('GHTK: dialog hai cột — trái liệt kê đơn đã chọn (✕ bỏ đơn), phải có tuỳ chọn đường bay / ca lấy; Cập nhật → POST đúng orderIds + options, bỏ chọn sau khi xong', async () => {
    search = '';
    toastSuccess.mockClear();
    toastError.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const ids = body.orderIds as string[];
        return HttpResponse.json(
          {
            sent: ids.map((id, i) => ({
              orderId: id,
              docNumber: `SO-${i}`,
              carrierId: body.carrierId,
              carrierCode: 'GHTK',
              outcome: i === 0 ? 'ISSUED' : 'SAVED',
              shipmentId: null,
              shipmentDocNumber: null,
              trackingNo: i === 0 ? 'S1.A1' : null,
              reason: null,
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    const rows = makeOrders(3);
    const list = within(dialog).getByRole('list', { name: 'Danh sách đơn' });
    expect(within(list).getByText(rows[0]!.docNumber)).toBeInTheDocument();
    expect(within(list).getByText(rows[1]!.docNumber)).toBeInTheDocument();
    expect(within(dialog).getByText('2 đơn được chọn')).toBeInTheDocument();
    // GHTK có các ô riêng
    expect(within(dialog).getByLabelText('Vận chuyển bằng đường bay')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radiogroup', { name: 'Thời điểm lấy hàng' }),
    ).toBeInTheDocument();

    // ✕ bỏ đơn thứ hai → còn 1 đơn, nút submit đếm lại.
    fireEvent.click(within(dialog).getByRole('button', { name: `Bỏ đơn ${rows[1]!.docNumber}` }));
    expect(within(dialog).getByText('1 đơn được chọn')).toBeInTheDocument();
    const submit = within(dialog).getByRole('button', { name: 'Cập nhật 1 đơn' });

    fireEvent.click(within(dialog).getByLabelText('Vận chuyển bằng đường bay'));
    fireEvent.click(within(dialog).getByLabelText('Cửa hàng trả phí vận chuyển cho GHTK')); // bỏ tick
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Chiều' }));
    fireEvent.change(within(dialog).getByLabelText('Khối lượng tối đa (kg)'), {
      target: { value: '1,5' },
    });
    fireEvent.change(within(dialog).getByLabelText('Ghi chú để in'), {
      target: { value: 'Giao giờ hành chính' },
    });
    fireEvent.change(within(dialog).getByLabelText('Dài (cm)'), { target: { value: '20' } });
    fireEvent.click(submit);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      orderIds: [rows[0]!.id],
      carrierId: 'c-ghtk',
      options: {
        shopPaysFee: false,
        transport: 'fly',
        dropAtPostOffice: false,
        allowInspection: true,
        callShopOnFailure: true,
        pickWorkShift: 2,
        maxWeightKg: '1.5',
        lengthCm: 20,
        note: 'Giao giờ hành chính',
      },
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã gửi 1 đơn sang GHTK', expect.anything()),
    );
    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('VTP: không có ô đường bay / ca lấy; chọn dịch vụ VTK; gõ số đơn + Enter thêm đơn ngoài lựa chọn; kết quả gộp ISSUED/SAVED vào toast', async () => {
    search = '';
    toastSuccess.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const ids = body.orderIds as string[];
        return HttpResponse.json(
          {
            sent: ids.map((id, i) => ({
              orderId: id,
              docNumber: `SO-${i}`,
              carrierId: body.carrierId,
              carrierCode: 'VTP',
              outcome: i === 0 ? 'QUEUED' : 'SAVED',
              shipmentId: null,
              shipmentDocNumber: null,
              trackingNo: null,
              reason: i === 0 ? 'timeout' : null,
            })),
            failed: [
              { orderId: 'x', docNumber: 'SO-HONG', code: 'CARRIER_WAYBILL_DATA', message: 'm' },
            ],
          },
          { status: 201 },
        );
      }),
    );
    await selectTwoRows();
    const dialog = await openFor('VTP');
    expect(within(dialog).queryByLabelText('Vận chuyển bằng đường bay')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('radiogroup')).not.toBeInTheDocument();

    // Quét/gõ số đơn thứ 6 (DRAFT, không nằm trong 2 đơn đã chọn) → thêm vào đầu danh sách.
    const extra = makeOrders(6)[5]!;
    const box = within(dialog).getByLabelText('Tìm đơn hàng');
    fireEvent.change(box, { target: { value: extra.docNumber } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await within(dialog).findByText('3 đơn được chọn')).toBeInTheDocument();
    expect(box).toHaveValue('');

    // Số đơn không tồn tại → báo ngay dưới ô tìm, không thêm.
    fireEvent.change(box, { target: { value: 'SO-KHONG-CO' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Không thấy đơn/);
    expect(within(dialog).getByText('3 đơn được chọn')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Dịch vụ vận chuyển' }));
    fireEvent.click(await screen.findByRole('option', { name: /VTK/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 3 đơn' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    const rows = makeOrders(2);
    expect(bodies[0]).toMatchObject({
      orderIds: [extra.id, rows[0]!.id, rows[1]!.id],
      carrierId: 'c-vtp',
      options: { serviceCode: 'VTK', shopPaysFee: true },
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã gửi 3 đơn sang VTP', {
        description:
          '1 hãng chưa phản hồi, sẽ thử lại · 2 đã gán hãng, cấp vận đơn khi đóng gói · 1 không gửi được: SO-HONG',
        duration: 10_000,
      }),
    );
  });

  it('lô có đơn hãng từ chối: đơn khác vẫn gửi, dialog giữ mở với danh sách đơn lỗi (số đơn, khách, lời hãng); Đóng → tắt', async () => {
    search = '';
    toastSuccess.mockClear();
    const rows = makeOrders(2);
    const said = 'Đơn hàng thiếu thông tin địa chỉ (Đường hoặc Phường).';
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: [
              {
                orderId: rows[1]!.id,
                docNumber: rows[1]!.docNumber,
                carrierId: 'c-ghtk',
                carrierCode: 'GHTK',
                outcome: 'ISSUED',
                shipmentId: 's-1',
                shipmentDocNumber: 'DN-1',
                trackingNo: 'S1.SG',
                reason: null,
              },
            ],
            failed: [
              {
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                code: 'CARRIER_REJECTED',
                message: 'raw server message',
                carrierMessage: said,
                warehouseName: null,
                missingSkus: null,
              },
            ],
          },
          { status: 201 },
        ),
      ),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));

    const list = await within(dialog).findByRole('list', { name: 'Danh sách đơn lỗi' });
    expect(within(dialog).getByText('1 đơn không gửi được sang GHTK')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 đơn còn lại đã gửi xong/)).toBeInTheDocument();
    const item = within(list).getByRole('listitem');
    expect(within(item).getByRole('link', { name: rows[0]!.docNumber })).toHaveAttribute(
      'href',
      `/crm/orders/${rows[0]!.id}/edit`,
    );
    expect(item).toHaveTextContent(rows[0]!.customer.name);
    expect(item).toHaveTextContent(`Hãng báo: “${said}”`);
    // Luật 6: không render message thô của server.
    expect(item).not.toHaveTextContent('raw server message');

    // Danh sách vẫn giữ lựa chọn tới lúc đóng; đóng → dialog tắt + bỏ chọn.
    // (toolbar nằm sau modal → aria-hidden, phải tìm với hidden: true)
    expect(screen.getByRole('toolbar', { hidden: true })).toBeInTheDocument();
    // Nút "Đóng" ở chân danh sách đơn lỗi (dialog còn nút × cùng tên ở góc).
    const panel = within(dialog).getByRole('region', { name: 'Đơn không gửi được' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('kho xuất không có sản phẩm (ORDER_SKU_NOT_IN_WAREHOUSE) → cảnh báo nêu tên kho + từng sản phẩm, không gửi', async () => {
    search = '';
    const rows = makeOrders(2);
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: [],
            failed: rows.map((r) => ({
              orderId: r.id,
              docNumber: r.docNumber,
              code: 'ORDER_SKU_NOT_IN_WAREHOUSE',
              message: 'raw server message',
              carrierMessage: null,
              warehouseName: 'Kho Thạch Thất',
              missingSkus: [{ code: 'CANXI-500', name: 'Canxi Bo Organic 500ml' }],
            })),
          },
          { status: 201 },
        ),
      ),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    const list = await within(dialog).findByRole('list', { name: 'Danh sách đơn lỗi' });
    expect(within(dialog).getByText('2 đơn không gửi được sang GHTK')).toBeInTheDocument();
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent(
      'Kho Thạch Thất không có: CANXI-500 — Canxi Bo Organic 500ml. Đổi kho xuất hoặc chuyển hàng về kho rồi gửi lại.',
    );
    expect(first).not.toHaveTextContent('raw server message');
  });

  it('toShippingOptions: mặc định chỉ gửi cờ, ô trống không gửi; điền đủ → đúng kiểu số/chuỗi', () => {
    expect(toShippingOptions(DEFAULT_SHIPPING_OPTIONS_FORM)).toEqual({
      shopPaysFee: true,
      dropAtPostOffice: false,
      allowInspection: true,
      callShopOnFailure: true,
    });
    expect(
      toShippingOptions({
        ...DEFAULT_SHIPPING_OPTIONS_FORM,
        byAir: true,
        serviceCode: 'xteam',
        extraServices: 'GBH, GHN ,',
        pickWorkShift: '3',
        pickDate: '2026-09-12',
        insuranceValue: '150000',
        maxWeightKg: '2',
        lengthCm: '10',
        widthCm: '',
        heightCm: '0',
        note: '  In tem  ',
      }),
    ).toEqual({
      shopPaysFee: true,
      transport: 'fly',
      dropAtPostOffice: false,
      allowInspection: true,
      callShopOnFailure: true,
      serviceCode: 'xteam',
      extraServices: ['GBH', 'GHN'],
      pickWorkShift: 3,
      pickDate: '2026-09-12',
      insuranceValue: '150000',
      maxWeightKg: '2',
      lengthCm: 10,
      note: 'In tem',
    });
  });
});
