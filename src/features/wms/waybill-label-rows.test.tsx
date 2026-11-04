import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShipmentLabelData } from './api/use-pda';
import { landscapeGoodsFit } from './components/landscape-waybill-label';
import {
  estimateAddressLines,
  portraitGoodsMm,
  portraitItemCount,
  WaybillLabel,
} from './components/waybill-label';
import { estimateLines, fitItems } from './label-text';

/**
 * Tem: số món in được theo chỗ trống của ô Sản phẩm, tên in ĐỦ không cắt (2026-11-04) — trước
 * đó tem dọc khóa 2 dòng nên đơn 4 món in thiếu dù nửa dưới tem trống, và tên dài bị cắt 1
 * dòng. Số kỳ vọng = đo getBoundingClientRect trên Chrome (xem `PORTRAIT_MM`, `GOODS_MM`).
 */
const SHORT = 'Sherdoba 20ec 450ml';
const LONG = 'Phân bón lá cao cấp Thiên Nông Organic Canxi Bo 500ml tặng kèm 1 gói ledan 95sp 100g';
const CAPS = 'COMBO 3 CHAI CANXI BO ORGANIC 500ML + 2 GÓI SIÊU RA HOA ĐẬU TRÁI';

const items = (n: number, name = (i: number) => `Sản phẩm ${i + 1}`) =>
  Array.from({ length: n }, (_, i) => ({ name: name(i), qty: '1.000000' }));

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

describe('label-text — ước lượng số dòng tên', () => {
  it('tên ngắn 1 dòng, tên 84 ký tự 3 dòng, tên toàn hoa rộng hơn (cột 54 mm, 7,5 pt)', () => {
    expect(estimateLines(SHORT, 7.5, 54)).toBe(1);
    expect(estimateLines(LONG, 7.5, 54)).toBe(3);
    // Toàn hoa 64 ký tự đo 97 mm → 2 dòng (chữ thường cùng số ký tự chỉ ~90 mm)
    expect(estimateLines(CAPS, 7.5, 54)).toBe(2);
    expect(estimateLines('Combo 2 gói ledan 95sp 100g', 7.5, 54)).toBe(1);
  });

  it('fitItems cộng dồn theo thứ tự, dừng ở món đầu không vừa; luôn ≥ 1', () => {
    const opts = { availableMm: 10, lineMm: 3.45, rowExtraMm: 1.05, pt: 7.5, widthMm: 54 };
    // 4,5 + 4,5 = 9 vừa; món thứ 3 (1 dòng) vượt 10
    expect(
      fitItems(
        items(5, () => SHORT),
        opts,
      ),
    ).toBe(2);
    // Món 2 là tên 3 dòng (11,4 mm) → dừng dù món 3 ngắn vẫn vừa
    expect(fitItems([{ name: SHORT }, { name: LONG }, { name: SHORT }], opts)).toBe(1);
    expect(fitItems([{ name: LONG }], { ...opts, availableMm: 5 })).toBe(1);
  });
});

describe('tem dọc — chỗ trống ô Sản phẩm và số món', () => {
  const vtp = { longCode: false, seq: false, sender: false, vnpost: false, addressLines: 1 };

  it('VTP không page 7 món 1 dòng; có page 5; thêm seq + địa chỉ 2 dòng 3; VNPost có page 4', () => {
    const count = (o: Partial<typeof vtp>) =>
      portraitItemCount(items(12), portraitGoodsMm({ ...vtp, ...o }));
    expect(count({})).toBe(7);
    expect(count({ sender: true })).toBe(5);
    expect(count({ sender: true, seq: true, addressLines: 2 })).toBe(3);
    expect(count({ sender: true, vnpost: true })).toBe(4);
    expect(count({ longCode: true })).toBe(6);
  });

  it('ước lượng dòng địa chỉ người nhận', () => {
    expect(estimateAddressLines('***, Huyện Thống Nhất, Đồng Nai')).toBe(1);
    expect(estimateAddressLines('***, Thành phố Phan Rang-Tháp Chàm, Ninh Thuận')).toBe(2);
  });

  it('đơn 4 món (ảnh kho gửi 2026-11-04) in đủ 4 dòng, không "+N sản phẩm khác"', () => {
    render(<WaybillLabel data={base} orientation="portrait" printedAt={printedAt} />);
    expect(screen.getByText('Sản phẩm 4')).toBeInTheDocument();
    expect(screen.queryByText(/sản phẩm khác/)).not.toBeInTheDocument();
  });

  it('tên dài in nguyên văn (không cắt) và tính 3 dòng: 4 món gồm 1 tên dài vẫn đủ', () => {
    render(
      <WaybillLabel
        data={{ ...base, items: [...items(3), { name: LONG, qty: '2.000000' }] }}
        orientation="portrait"
        printedAt={printedAt}
      />,
    );
    expect(screen.getByText(LONG)).toBeInTheDocument();
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
});

describe('tem ngang — ô Sản phẩm ~12,9 mm, tên in đủ', () => {
  it('cả danh sách vừa ở 8 pt (kể cả tên 2 dòng) → 8 pt; không thì 7 pt và cắt bớt món', () => {
    expect(landscapeGoodsFit(items(2, () => SHORT))).toEqual({ count: 2, pt: 8 });
    // Tên 84 ký tự ở 8 pt chiếm 3 dòng → không vừa cùng món kia → xuống 7 pt (3 dòng + 1 = 12,84)
    expect(landscapeGoodsFit([{ name: SHORT }, { name: LONG }])).toEqual({ count: 2, pt: 7 });
    expect(landscapeGoodsFit([{ name: SHORT }, { name: 'Combo 2 gói ledan 95sp 100g' }])).toEqual({
      count: 2,
      pt: 8,
    });
    expect(landscapeGoodsFit(items(12, () => SHORT))).toEqual({ count: 4, pt: 7 });
    // Món 3 tên 3 dòng không vừa phần còn lại → dừng ở 2 (giữ thứ tự)
    expect(
      landscapeGoodsFit([{ name: SHORT }, { name: SHORT }, { name: LONG }, { name: SHORT }]),
    ).toEqual({ count: 2, pt: 7 });
  });

  it('render: tên dài in nguyên văn, phần không in báo ở tiêu đề', () => {
    render(
      <WaybillLabel
        data={{ ...base, items: [{ name: LONG, qty: '1.000000' }, ...items(5)] }}
        orientation="landscape"
        printedAt={printedAt}
      />,
    );
    expect(screen.getByText(LONG)).toBeInTheDocument();
    expect(screen.getByText(/\+\d sản phẩm khác không in/)).toBeInTheDocument();
  });
});
