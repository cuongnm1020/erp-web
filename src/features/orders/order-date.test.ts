import { describe, expect, it } from 'vitest';
import { orderDateIso } from './schema';

// Ngày tạo đơn chọn tay (2026-11-03): doanh số tính theo ngày này.
describe('orderDateIso', () => {
  const now = new Date(2026, 10, 3, 14, 25, 30);

  it('trống hoặc hôm nay → không gửi (server lấy lúc chốt)', () => {
    expect(orderDateIso('', now)).toBeUndefined();
    expect(orderDateIso('2026-11-03', now)).toBeUndefined();
  });

  it('ngày lùi → giờ hiện tại trên ngày đã chọn', () => {
    const iso = orderDateIso('2026-11-01', now);
    expect(iso).toBe(new Date(2026, 10, 1, 14, 25, 30).toISOString());
  });
});
