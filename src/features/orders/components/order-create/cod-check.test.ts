import { describe, expect, it } from 'vitest';
import { formatRatioPct, lowCodRatio } from './cod-check';

describe('lowCodRatio', () => {
  it('COD < 30% tổng niêm yết → trả tỉ lệ', () => {
    const r = lowCodRatio('12000.0000', '140000.0000');
    expect(r?.toFixed(4)).toBe('0.0857');
  });

  it('COD đúng 30% → không cảnh báo', () => {
    expect(lowCodRatio('30000', '100000')).toBeNull();
  });

  it('COD 0 (chuyển khoản hết) vẫn cảnh báo', () => {
    expect(lowCodRatio('0.0000', '100000')).not.toBeNull();
  });

  it('chưa có giá / giỏ chỉ có quà → bỏ qua', () => {
    expect(lowCodRatio(null, '100000')).toBeNull();
    expect(lowCodRatio('0', null)).toBeNull();
    expect(lowCodRatio('0', '0')).toBeNull();
  });
});

describe('formatRatioPct', () => {
  it('làm tròn xuống 1 lẻ, dấu phẩy', () => {
    expect(formatRatioPct(lowCodRatio('29996', '100000')!)).toBe('29,9%');
  });
});
