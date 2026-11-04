import { describe, expect, it } from 'vitest';
import { remarkLines } from './components/carrier-status-card';

describe('remarkLines — ghi chú hãng tách dòng (2026-11-04)', () => {
  it('GHTK gộp nhiều lần hẹn: tiêu đề trước " — " một dòng, mỗi "Lấy hàng lần N:" một dòng', () => {
    const r =
      'NCC hẹn ngày lấy hàng — Lấy hàng lần 1: Delay lấy hàng vì NCC hẹn ngày lấy. Thời gian hẹn: Chiều 2026-10-30 Lấy hàng lần 2: Delay lấy hàng vì NCC hẹn ngày lấy. Thời gian hẹn: Chiều 2026-11-27';
    expect(remarkLines(r)).toEqual([
      'NCC hẹn ngày lấy hàng',
      'Lấy hàng lần 1: Delay lấy hàng vì NCC hẹn ngày lấy. Thời gian hẹn: Chiều 2026-10-30',
      'Lấy hàng lần 2: Delay lấy hàng vì NCC hẹn ngày lấy. Thời gian hẹn: Chiều 2026-11-27',
    ]);
  });

  it('Giao hàng lần N, xuống dòng có sẵn; ghi chú thường giữ nguyên một dòng', () => {
    expect(remarkLines('Giao hàng lần 1: Khách hẹn\nGiao hàng lần 2: Không nghe máy')).toEqual([
      'Giao hàng lần 1: Khách hẹn',
      'Giao hàng lần 2: Không nghe máy',
    ]);
    expect(remarkLines('Không liên lạc được với KH 3 lần')).toEqual([
      'Không liên lạc được với KH 3 lần',
    ]);
  });
});
