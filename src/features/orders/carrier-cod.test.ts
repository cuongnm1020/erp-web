import { describe, expect, it } from 'vitest';
import { carrierCodDiffers } from './components/carrier-status-card';

describe('carrierCodDiffers — hãng đang thu khác COD ERP đã gửi (2026-11-10)', () => {
  it('shop sửa COD trên app hãng (4.170.000 → 3.470.000) → khác', () => {
    expect(carrierCodDiffers({ codAmount: '4170000.0000', carrierCodAmount: '3470000.0000' })).toBe(
      true,
    );
  });

  it('hãng chưa báo → không so; bằng nhau theo đồng chẵn (COD lẻ phần nghìn) → không khác', () => {
    expect(carrierCodDiffers({ codAmount: '4170000.0000', carrierCodAmount: null })).toBe(false);
    expect(carrierCodDiffers({ codAmount: '1020000.0006', carrierCodAmount: '1020000.0000' })).toBe(
      false,
    );
  });

  it('phiếu cũ không ghi COD (null = 0) mà hãng thu → khác', () => {
    expect(carrierCodDiffers({ codAmount: null, carrierCodAmount: '150000.0000' })).toBe(true);
  });
});
