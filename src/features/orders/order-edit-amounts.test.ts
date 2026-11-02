import { describe, expect, it } from 'vitest';
import { previewAmounts } from './components/order-edit-screen';

const base = {
  subtotal: '410000.0000',
  discount: '0.0000',
  manualDiscount: '0.0000',
  manualDiscountRate: null,
  roundingAmount: '0.0000',
  total: '410000.0000',
  pancakeOrderId: null,
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
      { ...base, total: '440000.0000' /* có 30.000 phí ship */ },
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
      },
      '200000.0000',
    );
    expect(r.roundingAmount).toBe('0.0000');
    expect(r.total).toBe('200000.0000');
  });
});
