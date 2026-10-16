import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { LabelPrintDialog } from './components/label-print-dialog';

// Radix Select cần ResizeObserver; jsdom không có.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const SHIPMENT_ID = '00000000-0000-4000-8000-00000000b001';

const WAYBILL = (carrierCode: string) => ({
  shipmentId: SHIPMENT_ID,
  shipmentDocNumber: 'DN2610-00001',
  carrierCode,
  outcome: 'ISSUED' as const,
  trackingNo: 'PKE1545655255',
  reason: null,
  errorCode: null,
});

const LABEL_DATA = {
  shipmentId: SHIPMENT_ID,
  shipmentDocNumber: 'DN2610-00001',
  orderDocNumber: 'SO2610-00042',
  carrierCode: 'VTP',
  carrierName: 'Viettel Post',
  trackingNo: 'PKE1545655255',
  codAmount: '215000.0000',
  weightKg: '1.2000',
  recipient: {
    name: 'Nguyễn Công Quân',
    phone: '0901234567',
    address: 'Số nhà 137 ấp Mỹ Phó, Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long',
    street: 'Số nhà 137 ấp Mỹ Phó',
    locality: 'Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long',
    fromWard: 'Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long',
    province: 'Vĩnh Long',
  },
  sender: {
    name: 'Mạnh',
    phone: '0339213208',
    address: 'Số nhà 59 đường cốc trại, Kim Quan 3, Xã Thạch Thất, Hà Nội',
    street: 'Số nhà 59 đường cốc trại, Kim Quan 3',
    locality: 'Xã Thạch Thất, Hà Nội',
    fromWard: 'Xã Thạch Thất, Hà Nội',
    province: 'Hà Nội',
    warehouseName: 'Kho Thạch Thất',
  },
  allowInspection: false,
  callShopOnFailure: null,
  items: [
    { name: 'COMBO 3 CHAI CANXI BO ORGANIC 500ML', qty: '1.000000' },
    { name: 'Phân bón A', qty: '2.000000' },
    { name: 'Phân bón B', qty: '1.000000' },
    { name: 'Phân bón C', qty: '1.000000' },
    { name: 'Phân bón D', qty: '1.000000' },
  ],
  note: 'Quý khách vui lòng quay video khi bóc hàng',
};

/** Tờ in chỉ tồn tại trong lúc window.print() chạy (gỡ khi hộp thoại đóng) → chụp lại lúc đó. */
let printed: HTMLElement[] = [];
const lastPrinted = () => printed[printed.length - 1]!;

describe('Popup nhãn — tem ERP 100×75 mm (2026-10-13)', () => {
  const print = vi.fn(() => {
    const root = document.querySelector<HTMLElement>('[data-print-root]');
    if (root) printed.push(root.cloneNode(true) as HTMLElement);
  });
  beforeEach(() => {
    localStorage.clear();
    print.mockClear();
    printed = [];
    window.print = print;
    server.use(
      http.get('/api/shipments/:id', () =>
        HttpResponse.json({ shipmentId: SHIPMENT_ID, trackingNo: 'PKE1545655255' }),
      ),
      http.get('/api/shipments/:id/label-data', () => HttpResponse.json(LABEL_DATA)),
    );
  });

  it('mặc định tem 100×75 ngang: chữ to đủ thông tin, tự in một lần, @page 100mm 75mm', async () => {
    renderApp(<LabelPrintDialog open waybill={WAYBILL('VTP')} orderId={null} onClose={() => {}} />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));

    const root = lastPrinted();
    expect(root.getAttribute('data-print-size')).toBe('WAYBILL_100x75');
    expect(root.querySelector('style')!.textContent).toContain('size: 100mm 75mm');
    // Bản chụp đã tách khỏi document → getBy* (ném khi không thấy) thay cho toBeInTheDocument.
    const label = within(root);
    expect(label.getByText('Viettel Post')).toBeTruthy();
    expect(label.getByText('PKE1545655255')).toBeTruthy();
    expect(label.getByText('Nguyễn Công Quân')).toBeTruthy();
    // 2026-10-15: SĐT người nhận giữ 4 số cuối, thêm hàng người gửi
    expect(label.getByText('******4567')).toBeTruthy();
    expect(label.queryByText(/0901/)).toBeNull();
    expect(label.getByText(/\/ 0339 213 208 · Đ\/c: \*\*\*, Xã Thạch Thất, Hà Nội/)).toBeTruthy();
    expect(label.getByText(/Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long/)).toBeTruthy();
    // Bố cục theo nhãn Pancake (2026-10-14): mã hãng + số kiện, COD, bảng Sản phẩm / SL
    expect(label.getByText('VTP')).toBeTruthy();
    expect(label.getByText('1/1')).toBeTruthy();
    expect(label.getByText(/COD: 215\.000/)).toBeTruthy();
    // "+N sản phẩm khác" nằm ở tiêu đề cột để không bị cắt khi tên hàng dài (2026-10-14)
    expect(
      label.getByRole('columnheader', { name: /^Sản phẩm · \+3 sản phẩm khác$/ }),
    ).toBeTruthy();
    expect(label.getByRole('columnheader', { name: 'SL' })).toBeTruthy();
    expect(label.getByText('COMBO 3 CHAI CANXI BO ORGANIC 500ML')).toBeTruthy();
    // Ngang in tối đa 2 dòng hàng, còn lại gom lại để chữ không bị thu nhỏ
    expect(label.getByText('+3 sản phẩm khác')).toBeTruthy();
    expect(label.getByText('Quý khách vui lòng quay video khi bóc hàng')).toBeTruthy();
    expect(label.getByRole('img', { name: 'Mã vận đơn PKE1545655255' })).toBeTruthy();
    expect(label.getByRole('img', { name: 'QR PKE1545655255' })).toBeTruthy();
    // Không nhúng PDF của hãng
    expect(screen.queryByTitle('Nhãn vận đơn PKE1545655255')).toBeNull();
  });

  it('chọn Dọc → @page 75mm 100mm, nhớ lựa chọn; "In lại" in thêm lần nữa', async () => {
    renderApp(<LabelPrintDialog open waybill={WAYBILL('VTP')} orderId={null} onClose={() => {}} />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('combobox', { name: 'Hướng giấy' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Dọc' }));
    expect(localStorage.getItem('erp.pack.labelOrientation')).toBe('portrait');

    fireEvent.click(screen.getByRole('button', { name: /In lại/ }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
    const root = lastPrinted();
    expect(root.getAttribute('data-print-size')).toBe('WAYBILL_75x100');
    expect(root.querySelector('style')!.textContent).toContain('size: 75mm 100mm');
    // Dọc in tối đa 2 dòng hàng (thêm hàng người gửi + ghi chú cuối tem 2026-10-15)
    expect(within(root).getByText('+3 sản phẩm khác')).toBeTruthy();
  });

  it('tem chung dọc (VTP): hàng người gửi, SĐT người nhận 4 số cuối, ghi chú cuối tem / mặc định', async () => {
    localStorage.setItem('erp.pack.labelOrientation', 'portrait');
    renderApp(<LabelPrintDialog open waybill={WAYBILL('VTP')} orderId={null} onClose={() => {}} />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const label = within(lastPrinted());
    // 2026-10-16: "Người gửi: SĐT / xã → tỉnh", tên POS dòng dưới
    expect(label.getByText('Người gửi:')).toBeTruthy();
    expect(label.getByText('0339213208 / Xã Thạch Thất, Hà Nội')).toBeTruthy();
    expect(label.getByText('Mạnh')).toBeTruthy();
    expect(label.queryByText(/Số nhà 59/)).toBeNull();
    expect(label.getByText('******4567')).toBeTruthy();
    expect(label.queryByText(/0901/)).toBeNull();
    expect(label.getByText('Quý khách vui lòng quay video khi bóc hàng')).toBeTruthy();
    // 2026-10-16: địa chỉ người nhận chỉ in từ xã trở đi — không lộ số nhà / ấp
    expect(label.getByText(/^Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long$/)).toBeTruthy();
    expect(label.queryByText(/Số nhà 137/)).toBeNull();
  });

  it('tem chung dọc, đơn không có ghi chú → in ghi chú mặc định', async () => {
    localStorage.setItem('erp.pack.labelOrientation', 'portrait');
    server.use(
      http.get('/api/shipments/:id/label-data', () =>
        HttpResponse.json({ ...LABEL_DATA, note: null }),
      ),
    );
    renderApp(<LabelPrintDialog open waybill={WAYBILL('VTP')} orderId={null} onClose={() => {}} />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const label = within(lastPrinted());
    expect(
      label.getByText('Quý Khách Vui Lòng Quay video khi bóc hàng để được hỗ trợ đơn hàng'),
    ).toBeTruthy();
  });

  it('đơn GHTK, tem ngang → bố cục tem GHTK: mã vạch đoạn số cuối, mã phân loại, tuyến, SĐT người gửi đầy đủ', async () => {
    const long = 'S23119447.BO.MN13-12-P52.1763110086';
    server.use(
      http.get('/api/shipments/:id/label-data', () =>
        HttpResponse.json({ ...LABEL_DATA, carrierCode: 'GHTK', trackingNo: long }),
      ),
    );
    renderApp(
      <LabelPrintDialog
        open
        waybill={{ ...WAYBILL('GHTK'), trackingNo: long }}
        orderId={null}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const label = within(lastPrinted());
    expect(label.getByRole('img', { name: `Mã vận đơn ${long}` })).toBeTruthy();
    expect(label.getByRole('img', { name: `QR ${long}` })).toBeTruthy();
    expect(label.getByText('1763110086')).toBeTruthy();
    // Mã phân loại + tuyến in lại theo mẫu GHTK (2026-10-14); mã đơn bán vẫn không in
    expect(label.getByText('MN13')).toBeTruthy();
    expect(label.getByText('LIÊN MIỀN')).toBeTruthy();
    expect(label.queryByText(/SO2610-00042/)).toBeNull();
    expect(label.getByText('S23119447')).toBeTruthy();
    expect(label.getByText(/Mạnh \/ 0339 213 208/)).toBeTruthy();
    // 2026-10-15: SĐT người nhận giữ 4 số cuối, bỏ khối lượng
    expect(label.getByText(/Nguyễn Công Quân \/ \*{6}4567/)).toBeTruthy();
    expect(label.queryByText(/Khối lượng/)).toBeNull();
    expect(label.getByText('Đ/c: ***, Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long')).toBeTruthy();
    expect(label.getByText('DN2610-00001')).toBeTruthy();
    expect(label.getByText(/Không cho xem hàng/)).toBeTruthy();
    // SĐT đầy đủ của người nhận không được in
    expect(label.queryByText(/0901/)).toBeNull();
  });

  it('đơn GHTK, tem dọc → cùng khung tem dọc chung: mã vạch số cuối, mã phân loại, QR mã đầy đủ', async () => {
    localStorage.setItem('erp.pack.labelOrientation', 'portrait');
    const long = 'S23119447.MB7.MB7-05-L1.1890932219';
    server.use(
      http.get('/api/shipments/:id/label-data', () =>
        HttpResponse.json({
          ...LABEL_DATA,
          carrierCode: 'GHTK',
          trackingNo: long,
          recipient: { ...LABEL_DATA.recipient, province: 'Hải Phòng' },
        }),
      ),
    );
    renderApp(
      <LabelPrintDialog
        open
        waybill={{ ...WAYBILL('GHTK'), trackingNo: long }}
        orderId={null}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const root = lastPrinted();
    expect(root.getAttribute('data-print-size')).toBe('WAYBILL_75x100');
    const label = within(root);
    // 2026-10-16: GHTK dọc dùng khung tem dọc chung (giống Viettel)
    expect(label.getByRole('img', { name: `Mã vận đơn ${long}` })).toBeTruthy();
    expect(label.getByRole('img', { name: `QR ${long}` })).toBeTruthy();
    expect(label.getByText('1890932219')).toBeTruthy();
    expect(label.getByText('MB7')).toBeTruthy();
    expect(label.getByText('GHTK')).toBeTruthy();
    expect(label.getByText('Người gửi:')).toBeTruthy();
    expect(label.getByText('0339213208 / Xã Thạch Thất, Hà Nội')).toBeTruthy();
    expect(label.getByText('******4567')).toBeTruthy();
    expect(label.getByText(/^Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long$/)).toBeTruthy();
    expect(label.queryByText(/Số nhà/)).toBeNull();
    expect(label.getByText('Quý khách vui lòng quay video khi bóc hàng')).toBeTruthy();
    expect(label.queryByText(/0901/)).toBeNull();
  });

  it('đơn GHTK, tem dọc, đơn không có ghi chú → in ghi chú mặc định', async () => {
    localStorage.setItem('erp.pack.labelOrientation', 'portrait');
    const long = 'S23119447.MB7.MB7-05-L1.1890932219';
    server.use(
      http.get('/api/shipments/:id/label-data', () =>
        HttpResponse.json({
          ...LABEL_DATA,
          carrierCode: 'GHTK',
          trackingNo: long,
          note: null,
          allowInspection: null,
          callShopOnFailure: null,
        }),
      ),
    );
    renderApp(
      <LabelPrintDialog
        open
        waybill={{ ...WAYBILL('GHTK'), trackingNo: long }}
        orderId={null}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(
      within(lastPrinted()).getByText(
        'Quý Khách Vui Lòng Quay video khi bóc hàng để được hỗ trợ đơn hàng',
      ),
    ).toBeTruthy();
  });

  it('hãng nội bộ (MANUAL, không có nhãn PDF) vẫn in được tem ERP dù máy đã chọn A6', async () => {
    localStorage.setItem('erp.pack.labelPageSize', 'A6');
    renderApp(
      <LabelPrintDialog open waybill={WAYBILL('MANUAL')} orderId={null} onClose={() => {}} />,
    );
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(lastPrinted().getAttribute('data-print-size')).toBe('WAYBILL_100x75');
    expect(screen.queryByTitle('Nhãn vận đơn PKE1545655255')).toBeNull();
  });
});
