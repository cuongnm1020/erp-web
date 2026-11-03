import { describe, expect, it } from 'vitest';
import { previewAmounts } from './components/order-edit-screen';
import { shownAmounts } from './labels';

const base = {
  subtotal: '410000.0000',
  discount: '0.0000',
  manualDiscount: '0.0000',
  manualDiscountRate: null,
  roundingAmount: '0.0000',
  total: '410000.0000',
  pancakeOrderId: null,
  taxAmount: '0.0000',
  shippingFee: '0.0000',
  surcharge: '0.0000',
  lines: [{ discount: '0.0000', lineTotal: '410000.0000' }],
};

describe('previewAmounts — thẻ Giá trị đơn hàng tính lại khi sửa thành tiền (2026-11-02)', () => {
  it('chưa sửa giỏ (null) hoặc tạm tính không đổi → số đã lưu', () => {
    expect(previewAmounts(base, null)).toEqual({
      subtotal: base.subtotal,
      discount: base.discount,
      roundingAmount: base.roundingAmount,
      total: base.total,
    });
    expect(previewAmounts(base, '410000.0000').total).toBe(base.total);
  });

  it('sửa thành tiền 410.000 → 350.000: tạm tính + tổng theo giỏ mới, phí ship giữ nguyên', () => {
    const r = previewAmounts(
      { ...base, shippingFee: '30000.0000', total: '440000.0000' },
      '350000.0000',
    );
    expect(r.subtotal).toBe('350000.0000');
    expect(r.total).toBe('380000.0000');
  });

  it('giảm giá tay theo % tính lại trên tạm tính mới; theo số tiền giữ nguyên', () => {
    const pct = previewAmounts(
      {
        ...base,
        discount: '41000.0000',
        manualDiscount: '41000.0000',
        manualDiscountRate: '0.1',
        total: '369000.0000',
      },
      '350000.0000',
    );
    expect(pct.discount).toBe('35000.0000');
    expect(pct.total).toBe('315000.0000');
    const amount = previewAmounts(
      { ...base, discount: '10000.0000', manualDiscount: '10000.0000', total: '400000.0000' },
      '350000.0000',
    );
    expect(amount.discount).toBe('10000.0000');
    expect(amount.total).toBe('340000.0000');
  });

  it('đơn Pancake: bỏ làm tròn — tiền = Σ thành tiền', () => {
    const r = previewAmounts(
      {
        ...base,
        subtotal: '215000.0000',
        roundingAmount: '1000.0000',
        total: '216000.0000',
        pancakeOrderId: '46422',
        lines: [{ discount: '0.0000', lineTotal: '215000.0000' }],
      },
      '200000.0000',
    );
    expect(r.roundingAmount).toBe('0.0000');
    expect(r.total).toBe('200000.0000');
  });

  it('đơn Pancake có chiết khấu từng dòng (SOP2610-107401): tiền = Σ thành tiền, không trừ chiết khấu dòng lần hai', () => {
    // Pancake: 42 × niêm yết 150.000 = 6.300.000, chiết khấu dòng 42 × 21.429 = 900.018.
    const order = {
      ...base,
      subtotal: '6300000.0000',
      discount: '900018.0000',
      total: '5399982.0000',
      pancakeOrderId: '107401',
      lines: [{ discount: '900018.0000', lineTotal: '5399982.0000' }],
    };
    expect(previewAmounts(order, '5399982.0000').total).toBe('5399982.0000');
    const r = previewAmounts(order, '5400000.0000');
    expect(r.discount).toBe('0.0000');
    expect(r.total).toBe('5400000.0000');
    // Có thêm giảm giá cấp đơn 50.000 trên Pancake → giữ nguyên khoản đó.
    const withOrderLevel = previewAmounts(
      { ...order, discount: '950018.0000', total: '5349982.0000' },
      '5400000.0000',
    );
    expect(withOrderLevel.discount).toBe('50000.0000');
    expect(withOrderLevel.total).toBe('5350000.0000');
  });

  it('đơn ERP có chiết khấu dòng: giảm giá xem trước chỉ còn giảm giá tay', () => {
    const r = previewAmounts(
      {
        ...base,
        subtotal: '500000.0000',
        discount: '60000.0000',
        manualDiscount: '10000.0000',
        total: '440000.0000',
        lines: [{ discount: '50000.0000', lineTotal: '450000.0000' }],
      },
      '400000.0000',
    );
    expect(r.discount).toBe('10000.0000');
    expect(r.total).toBe('390000.0000');
  });
});

describe('shownAmounts — đơn Pancake hiện tạm tính = Σ thành tiền (2026-11-03, SOP2610-107393)', () => {
  const pc = {
    ...base,
    pancakeOrderId: '46422',
    // 10 × niêm yết 150.000 + 3 × 32.000 (tặng) = 1.596.000; bán 142.500 + 0 đ.
    subtotal: '1596000.0000',
    discount: '171000.0000',
    total: '1425000.0000',
    lines: [
      { discount: '75000.0000', lineTotal: '1425000.0000' },
      { discount: '96000.0000', lineTotal: '0.0000' },
    ],
  };

  it('chiết khấu so với niêm yết không hiện thành "Giảm giá"', () => {
    expect(shownAmounts(pc)).toEqual({ subtotal: '1425000.0000', discount: '0.0000' });
    expect(previewAmounts(pc, null)).toMatchObject({
      subtotal: '1425000.0000',
      discount: '0.0000',
      total: '1425000.0000',
    });
  });

  it('giảm giá cấp đơn vẫn hiện; đơn ERP giữ nguyên số đã lưu', () => {
    expect(shownAmounts({ ...pc, discount: '191000.0000' }).discount).toBe('20000.0000');
    expect(shownAmounts(base)).toEqual({ subtotal: base.subtotal, discount: base.discount });
  });
});
