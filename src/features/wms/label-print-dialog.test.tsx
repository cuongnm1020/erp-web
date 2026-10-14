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
    province: 'Vĩnh Long',
  },
  sender: {
    name: 'Mạnh',
    phone: '0339213208',
    address: 'Số nhà 59 đường cốc trại, Kim Quan 3, Xã Thạch Thất, Hà Nội',
    street: 'Số nhà 59 đường cốc trại, Kim Quan 3',
    locality: 'Xã Thạch Thất, Hà Nội',
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
    expect(label.getByText('0901 234 567', { exact: false })).toBeTruthy();
    expect(label.getByText(/Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long/)).toBeTruthy();
    // Bố cục theo nhãn Pancake (2026-10-14): mã hãng + số kiện, COD, bảng Sản phẩm / SL
    expect(label.getByText('VTP')).toBeTruthy();
    expect(label.getByText('1/1')).toBeTruthy();
    expect(label.getByText(/COD: 215\.000/)).toBeTruthy();
    expect(label.getByRole('columnheader', { name: 'Sản phẩm' })).toBeTruthy();
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
    // Dọc in tối đa 3 dòng hàng
    expect(within(root).getByText('+2 sản phẩm khác')).toBeTruthy();
  });

  it('đơn GHTK, tem ngang → bố cục tem GHTK: mã vạch đoạn số cuối, che SĐT, không mã phân loại / tuyến', async () => {
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
    // Người dùng bỏ mã phân loại / tuyến / mã đơn bán khỏi tem (2026-10-14)
    expect(label.queryByText(/MN13/)).toBeNull();
    expect(label.queryByText(/MIỀN/)).toBeNull();
    expect(label.queryByText(/SO2610-00042/)).toBeNull();
    expect(label.getByText('S23119447')).toBeTruthy();
    expect(label.getByText(/Mạnh \/ 033\*\*\*3208/)).toBeTruthy();
    expect(label.getByText(/Nguyễn Công Quân \/ \*{11}/)).toBeTruthy();
    expect(label.getByText('Đ/c: ***, Xã Thiện Mỹ, Huyện Trà Ôn, Vĩnh Long')).toBeTruthy();
    expect(label.getByText('DN2610-00001')).toBeTruthy();
    expect(label.getByText(/Không cho xem hàng/)).toBeTruthy();
    // SĐT đầy đủ của người nhận không được in
    expect(label.queryByText(/0901/)).toBeNull();
  });

  it('mã GHTK dài, tem dọc → bố cục chung: mã vạch trải hết chiều ngang, không kèm QR', async () => {
    localStorage.setItem('erp.pack.labelOrientation', 'portrait');
    const long = 'S23119447.BO.MT17-07-H42.1298006883';
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
    expect(label.queryByRole('img', { name: `QR ${long}` })).toBeNull();
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
