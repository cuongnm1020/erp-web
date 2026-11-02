import { describe, expect, it } from 'vitest';
import { pancakeAmountFix } from './pancake-line-amount';

describe('pancakeAmountFix', () => {
  it('SOP2610-107401: 5.400.000 / 42 → gợi ý 5.399.982 / 5.400.024', () => {
    expect(pancakeAmountFix('5400000', '42')).toEqual({ lower: '5399982', upper: '5400024' });
  });

  it('thành tiền xem trước từ đơn giá 4 lẻ (128571.4286 × 42) vẫn bị bắt', () => {
    expect(pancakeAmountFix('5400000.0012', '42')).toEqual({
      lower: '5399982',
      upper: '5400024',
    });
  });

  it('chia hết / quà tặng 0 đ / nhiễu < 0,01 đ → hợp lệ', () => {
    expect(pancakeAmountFix('5670000', '42')).toBeNull();
    expect(pancakeAmountFix('0', '2')).toBeNull();
    expect(pancakeAmountFix('299999.9999', '3')).toBeNull();
  });
});
