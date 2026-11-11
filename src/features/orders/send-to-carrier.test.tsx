import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CARRIERS, ME_SALE, makeOrders } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { OrderListScreen } from './components/order-list-screen';
import { toShippingOptions, DEFAULT_SHIPPING_OPTIONS_FORM } from './shipping-options';

const replace = vi.fn();
let search = '';
/** Xem mọi trạng thái — màn mở mặc định chỉ tab Đơn mới (2026-11-04), dữ liệu mẫu trải mọi tab. */
const ALL = 'group=all';
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

/** Ghi lại các lần POST /sales-orders/release-pick (thả việc lấy hàng đang giữ, 2026-10-29). */
const captureRelease = () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('/api/sales-orders/release-pick', async ({ request }) => {
      const body = (await request.json()) as { orderIds: string[] };
      bodies.push(body);
      return HttpResponse.json({ released: body.orderIds.length }, { status: 201 });
    }),
  );
  return bodies;
};

const selectTwoRows = async (opts?: Parameters<typeof renderApp>[1]) => {
  renderApp(<OrderListScreen />, opts);
  await screen.findByText(FIRST.docNumber);
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[1]!);
  expect(await screen.findByRole('toolbar')).toBeInTheDocument();
};

/** Dữ liệu tem tối thiểu cho POST /shipments/label-data. */
const LABEL = {
  shipmentId: 'sh-1',
  shipmentDocNumber: 'DN2610-00001',
  orderDocNumber: 'SO-0',
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
};

/** Radix DropdownMenu mở bằng bàn phím trong jsdom (pointerdown không có `button`). */
const openMenu = () =>
  fireEvent.keyDown(screen.getByRole('button', { name: /Gửi sang ĐVVC/ }), { key: 'ArrowDown' });

/** Hộp Gửi ĐVVC bắt buộc chọn NV đóng hàng (2026-11-11) — chọn người đầu của kho. */
const choosePacker = async (dialog: HTMLElement, name = 'Lê Đóng Gói') => {
  const packer = within(dialog).getByRole('combobox', { name: 'NV đóng hàng' });
  await waitFor(() => expect(packer).toBeEnabled());
  fireEvent.click(packer);
  fireEvent.click(await screen.findByRole('option', { name }));
};

const openFor = async (code: string) => {
  openMenu();
  // Nhãn dùng chung "<MÃ HÃNG> <tên tài khoản / tên hãng>" — khớp theo mã hãng ở đầu.
  fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(`^Sang ${code} `) }));
  return screen.findByRole('dialog');
};

describe('Gửi sang ĐVVC — SendToCarrierMenu + SendToCarrierDialog', () => {
  it('menu dựng từ GET /carriers: chỉ hãng bật, có adapter và đủ cấu hình (GHN chưa cấu hình, MANUAL/OLD ẩn)', async () => {
    search = ALL;
    toastSuccess.mockClear();
    await selectTwoRows();
    openMenu();
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Sang GHTK Giao Hàng Tiết Kiệm',
      'Sang VTP Viettel Post',
    ]);
    expect(within(menu).queryByText(/GHN|MANUAL|OLD|chưa cấu hình/)).not.toBeInTheDocument();
  });

  it('GHTK: dialog hai cột — trái liệt kê đơn đã chọn (✕ bỏ đơn), phải có tuỳ chọn đường bay / ca lấy; Cập nhật → POST đúng orderIds + options, bỏ chọn sau khi xong', async () => {
    search = ALL;
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
    const released = captureRelease();
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
    await choosePacker(dialog);
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
      // Admin đóng gói nhanh được → giữ việc lấy hàng, hỏi "Đóng gói + in" (2026-10-29).
      holdPick: true,
      packerId: 'u-pk1',
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã gửi 1 đơn sang GHTK', expect.anything()),
    );
    expect(toastError).not.toHaveBeenCalled();
    // Gửi 1 đơn vẫn hỏi; mặc định (Enter) là để kho lấy hàng.
    expect(
      await within(dialog).findByText('Đóng gói + in vận đơn luôn 1 đơn?'),
    ).toBeInTheDocument();
    const keep = within(dialog).getByRole('button', { name: 'Để kho lấy hàng' });
    expect(keep).toHaveFocus();
    expect(released).toEqual([]);
    fireEvent.click(keep);
    await waitFor(() => expect(released).toEqual([{ orderIds: [rows[0]!.id] }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
    // Dựng cả màn danh sách đơn + nhiều thao tác: local ~1,3 s, runner CI chậm ~6× vượt 5 s mặc định.
  }, 15_000);

  it('không đủ tồn cho cả lô (409 ORDER_CARRIER_STOCK_SHORT, 2026-11-07): hộp giữ mở, liệt kê SP cần / còn / thiếu + đơn; bỏ đơn thì danh sách ẩn', async () => {
    search = ALL;
    toastError.mockClear();
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            code: 'ORDER_CARRIER_STOCK_SHORT',
            message: 'x',
            details: {
              items: [
                {
                  warehouseId: 'w1',
                  skuId: 's1',
                  skuCode: 'SP-0147',
                  skuName: 'Combi chelate 25g',
                  required: '5',
                  available: '3',
                  docNumbers: ['SO-1', 'SO-2'],
                },
              ],
            },
          },
          { status: 409 },
        ),
      ),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    const note = await within(dialog).findByRole('alert');
    expect(note).toHaveTextContent('Không đủ tồn cho 1 sản phẩm — chưa gửi đơn nào');
    expect(note).toHaveTextContent('SP-0147 Combi chelate 25g: cần 5, còn 3, thiếu 2');
    expect(note).toHaveTextContent('Đơn: SO-1, SO-2');
    expect(toastError).not.toHaveBeenCalled();
    const rows = makeOrders(3);
    fireEvent.click(within(dialog).getByRole('button', { name: `Bỏ đơn ${rows[1]!.docNumber}` }));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  }, 15_000);

  it('NV đóng hàng bắt buộc (2026-11-11): chưa chọn → không gửi, báo dưới ô; chọn rồi mới gửi', async () => {
    search = ALL;
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ sent: [], failed: [] }, { status: 201 });
      }),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    const packer = within(dialog).getByRole('combobox', { name: 'NV đóng hàng' });
    await waitFor(() => expect(packer).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    expect(
      await within(dialog).findByText('Chọn NV đóng hàng trước khi gửi sang hãng.'),
    ).toBeInTheDocument();
    expect(packer).toHaveAttribute('aria-invalid', 'true');
    expect(bodies).toEqual([]);
    // Không còn lựa chọn "Không chọn (giao trên PDA)".
    fireEvent.click(packer);
    expect(screen.queryByRole('option', { name: /Không chọn/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'Lê Đóng Gói' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ packerId: 'u-pk1' });
  }, 15_000);

  it('NV đóng hàng (2026-11-06): đơn cùng kho → chọn người đóng gói của kho, POST kèm packerId', async () => {
    search = ALL;
    const bodies: Record<string, unknown>[] = [];
    const rows = makeOrders(2).map((o) => ({ ...o, warehouseId: 'wh-1' }));
    server.use(
      http.get('/api/sales-orders', () => HttpResponse.json({ items: rows, total: rows.length })),
      http.get('/api/pda/packers', ({ request }) => {
        expect(new URL(request.url).searchParams.get('warehouseId')).toBe('wh-1');
        return HttpResponse.json([{ id: 'u-pk1', code: 'pk1', fullName: 'Lê Đóng Gói' }]);
      }),
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({ sent: [], failed: [] }, { status: 201 });
      }),
    );
    renderApp(<OrderListScreen />);
    await screen.findByText(rows[0]!.docNumber);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn dòng' })[0]!);
    const dialog = await openFor('GHTK');
    const packer = within(dialog).getByRole('combobox', { name: 'NV đóng hàng' });
    await waitFor(() => expect(packer).toBeEnabled());
    fireEvent.click(packer);
    fireEvent.click(await screen.findByRole('option', { name: 'Lê Đóng Gói' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^Cập nhật/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ orderIds: [rows[0]!.id], packerId: 'u-pk1' });
  }, 15_000);

  it('VTP: không có ô đường bay / ca lấy; chọn dịch vụ VTK; gõ số đơn + Enter thêm đơn ngoài lựa chọn; kết quả gộp ISSUED/SAVED vào toast', async () => {
    search = ALL;
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
    await choosePacker(dialog);
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
    search = ALL;
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
    await choosePacker(dialog);
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
    const panel = within(dialog).getByRole('region', { name: 'Kết quả từng đơn' });
    // Đơn đã có mã nằm ở nhóm "Có mã vận đơn" (2026-10-28).
    fireEvent.click(within(panel).getByRole('button', { name: 'Có mã vận đơn 1' }));
    expect(
      within(within(panel).getByRole('list', { name: 'Danh sách kết quả' })).getByText(
        'Có mã S1.SG',
      ),
    ).toBeInTheDocument();
    // Đơn lỗi không giữ gì; đơn gửi được (rows[1]) chờ chọn → "Để kho lấy hàng".
    expect(within(panel).getByText('Đóng gói + in vận đơn luôn 1 đơn?')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Để kho lấy hàng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument());
  });

  it('đơn đã có vận đơn ở tài khoản khác (ORDER_WAYBILL_ACCOUNT_LOCKED) → nút "Hủy vận đơn cũ" → xác nhận → POST /sales-orders/cancel-waybill đúng đơn, báo đã hủy', async () => {
    search = ALL;
    toastSuccess.mockClear();
    const rows = makeOrders(2);
    const cancelBodies: unknown[] = [];
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: [],
            failed: rows.map((r) => ({
              orderId: r.id,
              docNumber: r.docNumber,
              code: 'ORDER_WAYBILL_ACCOUNT_LOCKED',
              message: 'raw',
              carrierMessage: null,
              warehouseName: null,
              missingSkus: null,
            })),
          },
          { status: 201 },
        ),
      ),
      http.post('/api/sales-orders/cancel-waybill', async ({ request }) => {
        cancelBodies.push(await request.json());
        return HttpResponse.json(
          {
            cancelled: [
              {
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                trackingNo: 'S1.OLD',
                carrierCode: 'GHTK',
              },
            ],
            failed: [
              {
                orderId: rows[1]!.id,
                docNumber: rows[1]!.docNumber,
                code: 'ORDER_CARRIER_PICKED_UP',
                message: 'raw',
                carrierMessage: null,
              },
            ],
          },
          { status: 201 },
        );
      }),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));

    const band = await within(dialog).findByRole('group', { name: 'Hủy vận đơn cũ' });
    expect(band).toHaveTextContent('2 đơn đã có vận đơn ở tài khoản khác');
    fireEvent.click(within(band).getByRole('button', { name: 'Hủy vận đơn cũ' }));
    const confirm = await screen.findByRole('dialog', { name: 'Hủy vận đơn của 2 đơn đã chọn?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Hủy 2 vận đơn' }));

    await waitFor(() => expect(cancelBodies).toHaveLength(1));
    expect(cancelBodies[0]).toEqual({ orderIds: rows.map((r) => r.id) });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Đã hủy 1 vận đơn', expect.anything()),
    );
    const err = toastError.mock.calls.find((c) => c[0] === '1 đơn KHÔNG hủy được vận đơn');
    expect(err).toBeDefined();
    // Câu riêng cho hủy vận đơn (không phải câu "hủy đơn"), không render message thô.
    expect((err![1] as { description: string }).description).toContain(
      'Hãng đã lấy hàng — không hủy vận đơn được nữa.',
    );
    expect((err![1] as { description: string }).description).not.toContain('raw');
  });

  it('lô nhiều đơn (2026-10-28): kết quả TỪNG đơn — có mã / chờ đóng gói / cần sửa; SĐT bị che (TikTok) → nhóm Cần sửa với việc phải làm', async () => {
    search = ALL;
    const rows = makeOrders(2);
    const base = { carrierId: 'c-ghtk', carrierCode: 'GHTK', carrierAccountId: null, reason: null };
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: [
              {
                ...base,
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                outcome: 'SAVED',
                shipmentId: null,
                shipmentDocNumber: null,
                trackingNo: null,
                warning: 'RECIPIENT_PHONE_MASKED',
              },
              {
                ...base,
                orderId: rows[1]!.id,
                docNumber: rows[1]!.docNumber,
                outcome: 'SAVED',
                shipmentId: null,
                shipmentDocNumber: null,
                trackingNo: null,
                warning: null,
              },
            ],
            failed: [],
          },
          { status: 201 },
        ),
      ),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));

    const panel = await within(dialog).findByRole('region', { name: 'Kết quả từng đơn' });
    expect(within(panel).getByText('Đã gửi 2 đơn sang GHTK')).toBeInTheDocument();
    // Mở sẵn nhóm Cần sửa: chỉ đơn SĐT bị che.
    const fix = within(panel).getByRole('list', { name: 'Danh sách đơn lỗi' });
    const item = within(fix).getByRole('listitem');
    expect(item).toHaveTextContent(rows[0]!.docNumber);
    expect(item).toHaveTextContent('Cần sửa trước khi đóng gói');
    expect(item).toHaveTextContent(/SĐT người nhận bị sàn che — GHTK sẽ từ chối/);
    fireEvent.click(within(panel).getByRole('button', { name: 'Chờ 1' }));
    expect(within(panel).getByRole('list', { name: 'Danh sách kết quả' })).toHaveTextContent(
      rows[1]!.docNumber,
    );
    // Đơn SĐT bị che không tính vào số đơn đóng gói.
    expect(within(panel).getByText('Đóng gói + in vận đơn luôn 1 đơn?')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Để kho lấy hàng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('xin mã sẵn (2026-10-31): gửi xong mọi đơn "Đang xin mã", hỏi lại POST /shipments/waybill-status → đơn có mã / đơn hãng từ chối cập nhật tại chỗ, thanh "Đã có mã x/N"', async () => {
    search = ALL;
    const rows = makeOrders(2);
    const base = { carrierId: 'c-ghtk', carrierCode: 'GHTK', carrierAccountId: null };
    let polls = 0;
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: rows.map((r, i) => ({
              ...base,
              orderId: r.id,
              docNumber: r.docNumber,
              outcome: 'QUEUED',
              shipmentId: `sh-${i}`,
              shipmentDocNumber: `DN-${i}`,
              trackingNo: null,
              reason: 'Đang xin mã vận đơn',
              warning: null,
            })),
            failed: [],
          },
          { status: 201 },
        ),
      ),
      http.post('/api/shipments/waybill-status', () => {
        polls += 1;
        const none = { trackingNo: null, waybillError: null, waybillErrorCode: null };
        return HttpResponse.json(
          polls === 1
            ? [
                { shipmentId: 'sh-0', orderId: rows[0]!.id, ...none },
                { shipmentId: 'sh-1', orderId: rows[1]!.id, ...none },
              ]
            : [
                { shipmentId: 'sh-0', orderId: rows[0]!.id, ...none, trackingNo: 'S9.A1.777' },
                {
                  shipmentId: 'sh-1',
                  orderId: rows[1]!.id,
                  trackingNo: null,
                  waybillError: 'Địa chỉ không hợp lệ',
                  waybillErrorCode: 'CARRIER_REJECTED',
                },
              ],
        );
      }),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    const panel = await within(dialog).findByRole('region', { name: 'Kết quả từng đơn' });
    const bar = await within(dialog).findByRole('progressbar', {
      name: 'Tiến độ xin mã vận đơn',
    });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    // Mã chưa về (2026-11-07): khóa cả "Để kho lấy hàng" lẫn "Đóng gói + in".
    expect(within(dialog).getByRole('button', { name: 'Để kho lấy hàng' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /Đang xin mã vận đơn 0\/2/ })).toBeDisabled();
    // Hỏi lại sau 2 s → một đơn có mã, một đơn hãng từ chối.
    await waitFor(() => expect(within(panel).getByText('Có mã S9.A1.777')).toBeInTheDocument(), {
      timeout: 5000,
    });
    // Mọi đơn đã có mã / bị từ chối → mở lại hai nút.
    expect(within(dialog).getByRole('button', { name: 'Để kho lấy hàng' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: /Đóng gói \+ in/ })).toBeEnabled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Cần sửa 1' }));
    const fix = within(panel).getByRole('list', { name: 'Danh sách đơn lỗi' });
    expect(fix).toHaveTextContent(rows[1]!.docNumber);
    expect(fix).toHaveTextContent('GHTK không cấp được mã');
    expect(fix).toHaveTextContent('Địa chỉ không hợp lệ');
    expect(within(dialog).getByText('1/2 đơn')).toBeInTheDocument();
  });

  it('"Đóng gói + in" sau khi gửi (2026-10-29): bulk-fulfil đơn gửi được (bỏ đơn cần sửa) → in tem → thả việc lấy hàng của cả lô → kết quả đóng gói', async () => {
    search = ALL;
    toastSuccess.mockClear();
    window.print = vi.fn();
    const rows = makeOrders(2);
    const released = captureRelease();
    const fulfilBodies: unknown[] = [];
    const base = { carrierId: 'c-ghtk', carrierCode: 'GHTK', carrierAccountId: null, reason: null };
    server.use(
      http.post('/api/sales-orders/send-to-carrier', () =>
        HttpResponse.json(
          {
            sent: [
              {
                ...base,
                orderId: rows[0]!.id,
                docNumber: rows[0]!.docNumber,
                outcome: 'SAVED',
                shipmentId: null,
                shipmentDocNumber: null,
                trackingNo: null,
                warning: null,
              },
              {
                ...base,
                orderId: rows[1]!.id,
                docNumber: rows[1]!.docNumber,
                outcome: 'SAVED',
                shipmentId: null,
                shipmentDocNumber: null,
                trackingNo: null,
                warning: 'RECIPIENT_PHONE_MASKED',
              },
            ],
            failed: [],
          },
          { status: 201 },
        ),
      ),
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
            failed: [],
          },
          { status: 201 },
        );
      }),
      http.post('/api/shipments/label-data', () => HttpResponse.json([LABEL])),
    );
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Đóng gói + in 1 tem' }));

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(fulfilBodies).toEqual([{ orderIds: [rows[0]!.id] }]);
    // Thả cả lô: đơn đã đóng gói server bỏ qua, đơn cần sửa xuống kho như trước.
    await waitFor(() => expect(released).toEqual([{ orderIds: [rows[0]!.id, rows[1]!.id] }]));
    expect(toastSuccess).toHaveBeenCalledWith('Đã đóng gói 1 đơn, in 1 tem', undefined);
    const panel = await within(dialog).findByRole('region', { name: 'Kết quả từng đơn' });
    expect(within(panel).getByText('Đã xử lý 1 đơn')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Không thả lần hai lúc đóng.
    expect(released).toHaveLength(1);
  });

  it('đóng popup (Esc) khi đang hỏi = để kho lấy hàng', async () => {
    search = ALL;
    const released = captureRelease();
    await selectTwoRows();
    const dialog = await openFor('GHTK');
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    // Handler mặc định: đơn đầu có mã, đơn sau chờ đóng gói — cả hai hỏi đóng gói.
    expect(
      await within(dialog).findByText('Đóng gói + in vận đơn luôn 2 đơn?'),
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const rows = makeOrders(2);
    expect(released).toEqual([{ orderIds: [rows[0]!.id, rows[1]!.id] }]);
  });

  it('kho không có quyền đóng gói nhanh: không giữ việc lấy hàng, không hỏi', async () => {
    search = ALL;
    const released = captureRelease();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json(
          {
            sent: (body.orderIds as string[]).map((id, i) => ({
              orderId: id,
              docNumber: `SO-${i}`,
              carrierId: body.carrierId,
              carrierCode: 'GHTK',
              carrierAccountId: null,
              outcome: 'SAVED',
              shipmentId: null,
              shipmentDocNumber: null,
              trackingNo: null,
              reason: null,
              warning: null,
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
    );
    await selectTwoRows({
      // Từ 2026-10-31 chỉ người có send_carrier (kho) gửi hãng — kho thiếu quyền đóng gói nhanh.
      me: { ...ME_SALE, permissions: [...ME_SALE.permissions, 'sales_order.send_carrier'] },
    });
    const dialog = await openFor('GHTK');
    // Không có task.execute → không có ô NV đóng hàng (không tra được danh sách) → không bắt buộc.
    expect(within(dialog).queryByRole('combobox', { name: 'NV đóng hàng' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    const panel = await within(dialog).findByRole('region', { name: 'Kết quả từng đơn' });
    expect(bodies[0]).not.toHaveProperty('holdPick');
    expect(within(panel).queryByText(/Đóng gói \+ in vận đơn luôn/)).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(released).toEqual([]);
  });

  it('kho xuất không có sản phẩm (ORDER_SKU_NOT_IN_WAREHOUSE) → cảnh báo nêu tên kho + từng sản phẩm, không gửi', async () => {
    search = ALL;
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
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    const list = await within(dialog).findByRole('list', { name: 'Danh sách đơn lỗi' });
    expect(within(dialog).getByText('2 đơn không gửi được sang GHTK')).toBeInTheDocument();
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent(
      'Kho Thạch Thất không có: CANXI-500 — Canxi Bo Organic 500ml. Đổi kho xuất hoặc chuyển hàng về kho rồi gửi lại.',
    );
    expect(first).not.toHaveTextContent('raw server message');
  });

  it('hãng nhiều tài khoản (FE-CARRIER-ACC-1): menu hiện từng tài khoản đủ cấu hình (chưa cấu hình ẩn); chọn tài khoản phụ → dialog chọn sẵn → POST kèm carrierAccountId; GHN mặc định thiếu cấu hình nhưng có tài khoản khác đủ → menu có GHN', async () => {
    search = ALL;
    toastSuccess.mockClear();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/carriers', () =>
        HttpResponse.json(
          CARRIERS.map((c) =>
            c.code === 'GHTK'
              ? {
                  ...c,
                  accounts: [
                    { id: 'acc-ghtk-default', name: 'Mặc định', isDefault: true, configured: true },
                    {
                      id: 'acc-ghtk-shop2',
                      name: 'Nam Việt - Hàng Lòng',
                      isDefault: false,
                      code: 'S23119447',
                      configured: true,
                    },
                    { id: 'acc-ghtk-new', name: 'GHTK mới', isDefault: false, configured: false },
                  ],
                }
              : c.code === 'GHN'
                ? {
                    ...c,
                    accounts: [
                      ...c.accounts,
                      { id: 'acc-ghn-2', name: 'GHN kho 2', isDefault: false, configured: true },
                    ],
                  }
                : c,
          ),
        ),
      ),
      http.post('/api/sales-orders/send-to-carrier', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json(
          {
            sent: (body.orderIds as string[]).map((id) => ({
              orderId: id,
              docNumber: 'SO-1',
              carrierId: body.carrierId,
              carrierCode: 'GHTK',
              carrierAccountId: body.carrierAccountId ?? null,
              outcome: 'SAVED',
              shipmentId: null,
              shipmentDocNumber: null,
              trackingNo: null,
              reason: null,
            })),
            failed: [],
          },
          { status: 201 },
        );
      }),
    );
    await selectTwoRows();
    openMenu();
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.getAttribute('aria-label')),
    ).toEqual([
      // Không dòng cấp hãng: mỗi tài khoản đủ cấu hình một dòng "<MÃ HÃNG> <mã TK> <tên>";
      // tài khoản "Mặc định" chưa đặt tên hiện tên hãng.
      'Sang GHN GHN kho 2',
      'Sang GHTK Giao Hàng Tiết Kiệm',
      'Sang GHTK S23119447 Nam Việt - Hàng Lòng',
      'Sang VTP Viettel Post',
    ]);
    expect(within(menu).queryByText(/GHTK mới/)).not.toBeInTheDocument();
    fireEvent.click(
      within(menu).getByRole('menuitem', { name: 'Sang GHTK S23119447 Nam Việt - Hàng Lòng' }),
    );
    const dialog = await screen.findByRole('dialog');
    // Ô chọn hãng dùng chung, chỉ tài khoản của GHTK — chọn sẵn tài khoản bấm từ menu.
    expect(within(dialog).getByRole('combobox', { name: 'Tài khoản GHTK' })).toHaveTextContent(
      'GHTK S23119447 Nam Việt - Hàng Lòng',
    );
    await choosePacker(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cập nhật 2 đơn' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ carrierId: 'c-ghtk', carrierAccountId: 'acc-ghtk-shop2' });
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
