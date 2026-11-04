import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShipmentLabelData } from './api/use-pda';
import { estimateAddressLines, portraitItemRows, WaybillLabel } from './components/waybill-label';

/**
 * Tem dọc: số dòng hàng theo chỗ trống của ô Sản phẩm (2026-11-04) — trước đó khóa 2 dòng nên
 * đơn 4 món in thiếu dù nửa dưới tem trống. Số kỳ vọng = đo getBoundingClientRect trên Chrome
 * (xem `PORTRAIT_MM` trong waybill-label.tsx).
 */
const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Sản phẩm ${i + 1}`, qty: '1.000000' }));

const base = {
  shipmentId: 'sh-1',
  shipmentDocNumber: 'DN2611-00001',
  orderDocNumber: 'SOP2611-00001',
  carrierCode: 'VTP',
  carrierName: 'Viettel Post',
  trackingNo: '156309468422',
  codAmount: '100000.0000',
  weightKg: '0.5000',
  recipient: {
    name: 'Pham Duy',
    phone: '0901232000',
    address: 'Ấp 1, Xã Gia Tân, Huyện Thống Nhất, Đồng Nai',
    street: 'Ấp 1',
    locality: 'Xã Gia Tân, Huyện Thống Nhất, Đồng Nai',
    fromWard: 'Xã Gia Tân, Huyện Thống Nhất, Đồng Nai',
    fromDistrict: 'Huyện Thống Nhất, Đồng Nai',
    province: 'Đồng Nai',
  },
  sender: null,
  allowInspection: false,
  callShopOnFailure: null,
  items: items(4),
  note: null,
  facebookPageName: null,
} as unknown as ShipmentLabelData;

const printedAt = new Date('2026-11-04T03:33:00.000Z');

describe('portraitItemRows — số dòng hàng tem dọc', () => {
  const vtp = { longCode: false, seq: false, sender: false, vnpost: false, addressLines: 1 };

  it('VTP không page: 7 dòng; có page: 5; thêm seq + địa chỉ 2 dòng: 3; VNPost có page: 4', () => {
    expect(portraitItemRows(vtp)).toBe(7);
    expect(portraitItemRows({ ...vtp, sender: true })).toBe(5);
    expect(portraitItemRows({ ...vtp, sender: true, seq: true, addressLines: 2 })).toBe(3);
    expect(portraitItemRows({ ...vtp, sender: true, vnpost: true })).toBe(4);
  });

  it('mã dài (không có cột QR): 6 dòng; trường hợp chật nhất (mọi khối + địa chỉ 3 dòng): 2', () => {
    expect(portraitItemRows({ ...vtp, longCode: true })).toBe(6);
    expect(
      portraitItemRows({ longCode: true, seq: true, sender: true, vnpost: true, addressLines: 9 }),
    ).toBe(2);
  });

  it('ước lượng dòng địa chỉ theo số ký tự (~42 / dòng)', () => {
    expect(estimateAddressLines('***, Huyện Thống Nhất, Đồng Nai')).toBe(1);
    expect(estimateAddressLines('***, Thành phố Phan Rang-Tháp Chàm, Ninh Thuận')).toBe(2);
  });
});

describe('WaybillLabel dọc — in đủ danh sách sản phẩm', () => {
  it('đơn 4 món (ảnh kho gửi 2026-11-04) in đủ 4 dòng, không "+N sản phẩm khác"', () => {
    render(<WaybillLabel data={base} orientation="portrait" printedAt={printedAt} />);
    expect(screen.getByText('Sản phẩm 4')).toBeInTheDocument();
    expect(screen.queryByText(/sản phẩm khác/)).not.toBeInTheDocument();
  });

  it('đơn 12 món không page: 7 dòng + "+5 sản phẩm khác" ở tiêu đề', () => {
    render(
      <WaybillLabel
        data={{ ...base, items: items(12) }}
        orientation="portrait"
        printedAt={printedAt}
      />,
    );
    expect(screen.getByText('Sản phẩm 7')).toBeInTheDocument();
    expect(screen.queryByText('Sản phẩm 8')).not.toBeInTheDocument();
    expect(screen.getByText('+5 sản phẩm khác')).toBeInTheDocument();
  });

  it('đơn 12 món có page + số lô: 4 dòng (hàng người gửi + "#x/N" chiếm chỗ)', () => {
    render(
      <WaybillLabel
        data={{ ...base, items: items(12), facebookPageName: 'Thiên Nông Official' }}
        orientation="portrait"
        printedAt={printedAt}
        seq={{ index: 3, total: 50 }}
      />,
    );
    expect(screen.getByText('Sản phẩm 4')).toBeInTheDocument();
    expect(screen.queryByText('Sản phẩm 5')).not.toBeInTheDocument();
    expect(screen.getByText('+8 sản phẩm khác')).toBeInTheDocument();
  });
});
