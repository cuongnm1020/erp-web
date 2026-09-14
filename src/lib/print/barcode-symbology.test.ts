import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, isValidEan13, symbologyFor } from './barcode-symbology';

describe('barcode-symbology — chọn ký hiệu render (PLAN-barcode-pick-pack quyết định 3)', () => {
  it('check digit EAN-13 theo GS1 mod 10', () => {
    // 893456780123 → 2 (tính tay: lẻ 25 + chẵn 31×3 = 118 → 2); 400638133393 → 1 (mẫu GS1)
    expect(ean13CheckDigit('893456780123')).toBe(2);
    expect(ean13CheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('8934567801232')).toBe(true);
    expect(isValidEan13('4006381333931')).toBe(true);
    // Mã trong design mock cũ (…1234) là mã khai sai check digit
    expect(isValidEan13('8934567801234')).toBe(false);
  });

  it('EAN13 chỉ khi đúng 13 số + check digit đúng; sai → rơi về CODE128', () => {
    expect(symbologyFor('EAN13', '8934567801232')).toBe('ean13');
    expect(symbologyFor('EAN13', '8934567801234')).toBe('code128'); // check digit sai
    expect(symbologyFor('EAN13', '893456780123')).toBe('code128'); // 12 số
    expect(symbologyFor('EAN13', 'ABC4567801234')).toBe('code128'); // có chữ
  });

  it('CODE128 / INTERNAL → code128 dù chuỗi là 13 số hợp lệ; QR giữ qrcode', () => {
    expect(symbologyFor('CODE128', '8934567801232')).toBe('code128');
    expect(symbologyFor('INTERNAL', 'SO-2609-000123')).toBe('code128');
    expect(symbologyFor('QR', 'TL08-BLUE')).toBe('qrcode');
  });
});
