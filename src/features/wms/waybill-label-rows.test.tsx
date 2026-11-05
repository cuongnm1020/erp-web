import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShipmentLabelData } from './api/use-pda';
import { landscapePages } from './components/landscape-waybill-label';
import {
  estimateAddressLines,
  portraitGoodsMm,
  portraitItemCount,
  portraitPages,
  WaybillLabel,
} from './components/waybill-label';
import { chunkItems, estimateLines, fitItems } from './label-text';

/**
 * Tem: tên in ĐỦ không cắt, số món mỗi tờ theo chỗ trống của ô Sản phẩm, hết chỗ thì in tiếp
 * sang tờ mới có "Tờ x/N" (user chốt 2026-11-04) — trước đó tem dọc khóa 2 dòng nên đơn 4 món
 * in thiếu dù nửa dưới tem trống, tên dài bị cắt 1 dòng, phần dư chỉ báo "+N sản phẩm khác".
 * Số kỳ vọng = đo getBoundingClientRect trên Chrome (xem `PORTRAIT_MM`, `GOODS_MM`).
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

/** Các tờ in của một tem đã render. */
const pagesOf = (container: HTMLElement) => [...container.querySelectorAll('[data-print-page]')];

describe('label-text — ước lượng số dòng tên, chia tờ', () => {
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

  it('chunkItems chia hết danh sách theo thứ tự; rỗng → một tờ rỗng', () => {
    const list = items(7);
    expect(chunkItems(list, () => 3)).toEqual([list.slice(0, 3), list.slice(3, 6), list.slice(6)]);
    expect(chunkItems(list, () => 10)).toEqual([list]);
    expect(chunkItems([], () => 3)).toEqual([[]]);
  });
});

describe('tem dọc — chỗ trống ô Sản phẩm, số món mỗi tờ, in nhiều tờ', () => {
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

  it('đơn 4 món (ảnh kho gửi 2026-11-04) in một tờ đủ 4 dòng, không ghi số tờ', () => {
    const { container } = render(
      <WaybillLabel data={base} orientation="portrait" printedAt={printedAt} />,
    );
    expect(pagesOf(container)).toHaveLength(1);
    expect(screen.getByText('Sản phẩm 4')).toBeInTheDocument();
    expect(screen.queryByText(/sản phẩm khác/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tờ \d+\/\d+/)).not.toBeInTheDocument();
  });

  it('tên dài in nguyên văn (không cắt) và tính 3 dòng: 4 món gồm 1 tên dài vẫn một tờ', () => {
    const { container } = render(
      <WaybillLabel
        data={{ ...base, items: [...items(3), { name: LONG, qty: '2.000000' }] }}
        orientation="portrait"
        printedAt={printedAt}
      />,
    );
    expect(pagesOf(container)).toHaveLength(1);
    expect(screen.getByText(LONG)).toBeInTheDocument();
  });

  it('đơn 12 món không page: tờ 1 = tem đầy đủ không ghi chú (9 món), tờ 2 = tờ in tiếp + ghi chú (2026-11-05)', () => {
    const { container } = render(
      <WaybillLabel
        data={{ ...base, items: items(12) }}
        orientation="portrait"
        printedAt={printedAt}
      />,
    );
    const pages = pagesOf(container);
    expect(pages).toHaveLength(2);
    const [p1, p2] = [pages[0]!, pages[1]!];
    // Tờ 1: bỏ ô ghi chú → thêm 10,55 mm = 2 hàng (7 → 9 món)
    expect(p1.textContent).toContain('Sản phẩm · Tờ 1/2');
    expect(p1.textContent).toContain('Sản phẩm 9');
    expect(p1.textContent).not.toContain('Sản phẩm 10');
    expect(p1.textContent).toContain('Pham Duy');
    expect(p1.querySelector('[aria-label="Mã vận đơn 156309468422"]')).not.toBeNull();
    expect(p1.textContent).not.toContain('Quay video');
    // Tờ 2: không phải phiếu thứ hai — chỉ mã + số tờ + món còn lại + ghi chú
    expect(p2.getAttribute('data-waybill-label')).toBe('156309468422');
    expect(p2.textContent).toContain('Tiếp theo · 156309468422');
    expect(p2.textContent).toContain('Tờ 2/2');
    expect(p2.textContent).toContain('Sản phẩm (tiếp)');
    expect(p2.textContent).toContain('Sản phẩm 10');
    expect(p2.textContent).toContain('Sản phẩm 12');
    expect(p2.textContent).toContain('Quay video');
    expect(p2.textContent).not.toContain('Pham Duy');
    expect(p2.textContent).not.toContain('Thu *** đ');
    expect(p2.querySelector('[aria-label="Mã vận đơn 156309468422"]')).toBeNull();
    expect(p2.querySelector('[aria-label="QR 156309468422"]')).toBeNull();
    expect(screen.queryByText(/sản phẩm khác/)).not.toBeInTheDocument();
  });

  it('portraitPages: vừa một tờ → một tờ; không tờ nào chỉ có ghi chú; danh sách dài → nhiều tờ in tiếp', () => {
    const goods = portraitGoodsMm(vtp);
    expect(portraitPages(items(7), goods)).toEqual([items(7)]);
    expect(portraitPages([], goods)).toEqual([[]]);
    // 8 món: bỏ ghi chú thì tờ 1 vừa cả 8 → chừa món cuối sang tờ 2 (có hàng + ghi chú)
    expect(portraitPages(items(8), goods).map((p) => p.length)).toEqual([7, 1]);
    const long = portraitPages(items(40), goods);
    expect(long.flat()).toEqual(items(40));
    expect(long.length).toBeGreaterThanOrEqual(3);
    expect(long.at(-1)!.length).toBeGreaterThan(0);
  });
});

describe('tem ngang — ô Sản phẩm ~12,9 mm, tên in đủ, in nhiều tờ', () => {
  it('cả danh sách vừa một tờ ở 8 pt (kể cả tên 2 dòng) → 8 pt; không thì 7 pt và chia tờ', () => {
    expect(landscapePages(items(2, () => SHORT))).toEqual({
      pages: [items(2, () => SHORT)],
      pt: 8,
    });
    expect(landscapePages([{ name: SHORT }, { name: 'Combo 2 gói ledan 95sp 100g' }]).pt).toBe(8);
    // Tên 84 ký tự ở 8 pt chiếm 3 dòng → không vừa cùng món kia → xuống 7 pt (3 dòng + 1 = 12,84)
    expect(landscapePages([{ name: SHORT }, { name: LONG }])).toEqual({
      pages: [[{ name: SHORT }, { name: LONG }]],
      pt: 7,
    });
    // Tờ in tiếp chỉ có danh sách (2026-11-05) chứa được nhiều hơn → 4 + 8
    const twelve = items(12, () => SHORT);
    expect(landscapePages(twelve)).toEqual({
      pages: [twelve.slice(0, 4), twelve.slice(4)],
      pt: 7,
    });
    // Món 3 tên 3 dòng không vừa phần còn lại → sang tờ 2 cùng món 4 (giữ thứ tự)
    const mixed = [{ name: SHORT }, { name: SHORT }, { name: LONG }, { name: SHORT }];
    expect(landscapePages(mixed).pages).toEqual([mixed.slice(0, 2), mixed.slice(2)]);
  });

  it('render: tên dài in nguyên văn, 6 món → 2 tờ ghi "Tờ x/2", không "+N không in"', () => {
    const { container } = render(
      <WaybillLabel
        data={{ ...base, items: [{ name: LONG, qty: '1.000000' }, ...items(5)] }}
        orientation="landscape"
        printedAt={printedAt}
      />,
    );
    const pages = pagesOf(container);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.textContent).toContain(LONG);
    expect(pages[0]!.textContent).toContain('Sản phẩm (6) · Tờ 1/2');
    expect(pages[0]!.textContent).not.toContain('Ghi chú:');
    // Tờ 2 = tờ in tiếp (2026-11-05): danh sách còn lại + ghi chú, không mã vạch / người nhận
    expect(pages[1]!.textContent).toContain('Tiếp theo · 156309468422');
    expect(pages[1]!.textContent).toContain('Tờ 2/2');
    expect(pages[1]!.textContent).toContain('Sản phẩm (tiếp)');
    expect(pages[1]!.textContent).toContain('Sản phẩm 5');
    expect(pages[1]!.textContent).toContain('Ghi chú:');
    expect(pages[1]!.textContent).not.toContain('Pham Duy');
    expect(pages[1]!.querySelector('[aria-label="Mã vận đơn 156309468422"]')).toBeNull();
    expect(screen.queryByText(/không in/)).not.toBeInTheDocument();
  });
});
