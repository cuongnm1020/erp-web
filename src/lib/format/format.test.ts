import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatQuantity,
  formatRelative,
  formatTime,
  normalizePhone,
  parseMoneyInput,
  toLocalDateKey,
} from './index';

describe('formatMoney', () => {
  it('nhóm nghìn VN, VND mặc định 0 lẻ', () => {
    expect(formatMoney('1234567.5000')).toBe('1.234.568\u00A0₫');
    expect(formatMoney('1234567.4999')).toBe('1.234.567\u00A0₫');
    expect(formatMoney('999')).toBe('999\u00A0₫');
  });
  it('số âm dùng dấu trừ thật, số 0, signed', () => {
    expect(formatMoney('-1500000')).toBe('−1.500.000\u00A0₫');
    expect(formatMoney('0')).toBe('0\u00A0₫');
    expect(formatMoney('0', { signed: true })).toBe('0\u00A0₫');
    expect(formatMoney('250000', { signed: true })).toBe('+250.000\u00A0₫');
  });
  it('giá trị rất lớn không mất chính xác (vượt Number.MAX_SAFE_INTEGER)', () => {
    expect(formatMoney('99999999999999.9999', { dp: 4, unit: '' })).toBe('99.999.999.999.999,9999');
    expect(formatMoney('123456789012345678.1234', { dp: 2, unit: '' })).toBe(
      '123.456.789.012.345.678,12',
    );
  });
  it('dp 2 + đơn vị khác, Decimal input', () => {
    expect(formatMoney(new Decimal('12.5'), { dp: 2, unit: 'USD' })).toBe('12,50\u00A0USD');
  });
  it('null / rỗng / rác → —', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('')).toBe('—');
    expect(formatMoney('abc')).toBe('—');
    expect(formatMoney('NaN')).toBe('—');
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['1.234.567,5', '1234567.5'],
    ['1.234.567', '1234567'],
    ['1,234,567.50', '1234567.5'],
    ['1234567.5', '1234567.5'],
    ['1234567', '1234567'],
    ['12,5', '12.5'],
    ['-1.000 ₫', '-1000'],
    ['  250 000 đ ', '250000'],
  ])('%s → %s', (input, out) => {
    expect(parseMoneyInput(input)).toBe(out);
  });
  it('rác → null', () => {
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1..2')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('bỏ số 0 thừa, giữ tối đa maxDp', () => {
    expect(formatQuantity('12.000000')).toBe('12');
    expect(formatQuantity('12.500000', { unit: 'kg' })).toBe('12,5\u00A0kg');
    expect(formatQuantity('0.1234567', { maxDp: 3 })).toBe('0,123');
  });
  it('đổi đơn vị theo factor (24 cái = 1 thùng)', () => {
    expect(formatQuantity('48', { factor: 24, unit: 'thùng' })).toBe('2\u00A0thùng');
    expect(formatQuantity('36', { factor: '24', unit: 'thùng' })).toBe('1,5\u00A0thùng');
    expect(formatQuantity('1', { factor: 0 })).toBe('—');
  });
  it('âm, lớn, null', () => {
    expect(formatQuantity('-1000')).toBe('−1.000');
    expect(formatQuantity('123456789012.5')).toBe('123.456.789.012,5');
    expect(formatQuantity(undefined)).toBe('—');
  });
});

describe('date (Asia/Ho_Chi_Minh)', () => {
  it('qua nửa đêm: 17:30Z ngày 1 → 00:30 ngày 2 giờ VN', () => {
    expect(formatDateTime('2026-01-01T17:30:00Z')).toBe('02/01/2026 00:30');
    expect(formatDate('2026-01-01T17:30:00Z')).toBe('02/01/2026');
    expect(toLocalDateKey('2026-01-01T17:30:00Z')).toBe('2026-01-02');
  });
  it('trước nửa đêm UTC vẫn cùng ngày VN; giây; giờ', () => {
    expect(formatDateTime('2026-08-23T16:59:59Z', { seconds: true })).toBe('23/08/2026 23:59:59');
    expect(formatTime('2026-08-23T16:59:59Z')).toBe('23:59');
    expect(formatTime('2026-08-23T17:00:00Z')).toBe('00:00');
  });
  it('nhận Date, epoch; rác → —', () => {
    expect(formatDate(new Date('2026-02-28T20:00:00Z'))).toBe('01/03/2026');
    expect(formatDate(0)).toBe('01/01/1970');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
  it('formatRelative', () => {
    const now = new Date('2026-08-23T10:00:00Z');
    expect(formatRelative('2026-08-23T09:59:30Z', now)).toBe('vừa xong');
    expect(formatRelative('2026-08-23T09:45:00Z', now)).toBe('15 phút trước');
    expect(formatRelative('2026-08-23T07:00:00Z', now)).toBe('3 giờ trước');
    expect(formatRelative('2026-08-22T09:00:00Z', now)).toBe('hôm qua');
    expect(formatRelative('2026-08-24T12:00:00Z', now)).toBe('ngày mai');
    expect(formatRelative('2026-08-20T09:00:00Z', now)).toBe('3 ngày trước');
    expect(formatRelative('2026-08-01T09:00:00Z', now)).toBe('01/08/2026');
  });
});

describe('phone', () => {
  it('chuẩn hóa +84 / 84 / 0', () => {
    expect(normalizePhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizePhone('84912345678')).toBe('0912345678');
    expect(normalizePhone('0912.345.678')).toBe('0912345678');
    expect(normalizePhone('12345')).toBeNull();
  });
  it('hiển thị 0xxx xxx xxx; không chuẩn → giữ nguyên; rỗng → —', () => {
    expect(formatPhone('0912345678')).toBe('0912 345 678');
    expect(formatPhone('02438123456')).toBe('0243 8123 456');
    expect(formatPhone('ext 123')).toBe('ext 123');
    expect(formatPhone('')).toBe('—');
    expect(formatPhone(null)).toBe('—');
  });
});
