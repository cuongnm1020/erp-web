import { describe, expect, it } from 'vitest';
import { suspiciousPriceRatio } from './cart-line';

describe('suspiciousPriceRatio', () => {
  it('SO2610-00255: 95.000 ₫ / thùng niêm yết 4.400.000 ₫ → cảnh báo (~2,2%)', () => {
    const r = suspiciousPriceRatio('95000', '4400000.0000');
    expect(r?.mul(100).toDecimalPlaces(1).toString()).toBe('2.2');
  });

  it('giảm giá thường (95.000 / 110.000) → không cảnh báo', () => {
    expect(suspiciousPriceRatio('95000', '110000')).toBeNull();
  });

  it('đúng 10% niêm yết → không cảnh báo', () => {
    expect(suspiciousPriceRatio('11000', '110000')).toBeNull();
  });

  it('giá 0 (tặng), chưa có giá hoặc niêm yết 0 → không cảnh báo', () => {
    expect(suspiciousPriceRatio('0', '110000')).toBeNull();
    expect(suspiciousPriceRatio(null, '110000')).toBeNull();
    expect(suspiciousPriceRatio('95000', null)).toBeNull();
    expect(suspiciousPriceRatio('95000', '0')).toBeNull();
  });
});
