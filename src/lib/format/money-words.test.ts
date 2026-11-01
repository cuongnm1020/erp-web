import { describe, expect, it } from 'vitest';
import { moneyInWordsVi, readIntegerVi } from './money-words';

describe('moneyInWordsVi — số tiền viết bằng chữ trên hóa đơn', () => {
  it('đúng mẫu hóa đơn MISA', () => {
    expect(moneyInWordsVi('69300')).toBe('Sáu mươi chín nghìn ba trăm đồng chẵn.');
    expect(moneyInWordsVi('69300.0000')).toBe('Sáu mươi chín nghìn ba trăm đồng chẵn.');
  });

  it('lẻ / mốt / lăm / mười / không trăm', () => {
    expect(readIntegerVi('0')).toBe('không');
    expect(readIntegerVi('105')).toBe('một trăm lẻ năm');
    expect(readIntegerVi('21')).toBe('hai mươi mốt');
    expect(readIntegerVi('15')).toBe('mười lăm');
    expect(readIntegerVi('11')).toBe('mười một');
    expect(readIntegerVi('1005')).toBe('một nghìn không trăm lẻ năm');
    expect(readIntegerVi('1050000')).toBe('một triệu không trăm năm mươi nghìn');
    expect(readIntegerVi('2000000000')).toBe('hai tỷ');
    expect(readIntegerVi('1000000000000')).toBe('một nghìn tỷ');
    expect(readIntegerVi('8050000')).toBe('tám triệu không trăm năm mươi nghìn');
  });

  it('trống / không đọc được → chuỗi rỗng', () => {
    expect(moneyInWordsVi(null)).toBe('');
    expect(moneyInWordsVi('abc')).toBe('');
  });
});
