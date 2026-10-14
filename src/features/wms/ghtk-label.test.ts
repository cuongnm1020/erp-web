import { describe, expect, it } from 'vitest';
import {
  hidePhone,
  maskedAddress,
  maskPhone,
  parseGhtkTracking,
  printNote,
  routeLabel,
} from './ghtk-label';

describe('tem kiểu GHTK — tiện ích', () => {
  it('tách mã vận đơn GHTK: shop, mã phân loại (đoạn đầu nền đen), mã số ngắn', () => {
    expect(parseGhtkTracking('S23119447.BO.MN13-12-P52.1763110086')).toEqual({
      shopCode: 'S23119447',
      sortCode: 'MN13-12-P52',
      sortHead: 'MN13',
      sortTail: '-12-P52',
      shortCode: '1763110086',
    });
    // Mã không có đoạn mã cụm (đơn thật 2026-10-14)
    expect(parseGhtkTracking('S23119447.MB7-05-L1.1890932219')).toEqual({
      shopCode: 'S23119447',
      sortCode: 'MB7-05-L1',
      sortHead: 'MB7',
      sortTail: '-05-L1',
      shortCode: '1890932219',
    });
    expect(parseGhtkTracking('S1.1763110086')).toBeNull();
    expect(parseGhtkTracking('PKE1544685972')).toBeNull();
    expect(parseGhtkTracking(null)).toBeNull();
  });

  it('che SĐT người gửi giữ 3 đầu 4 cuối; SĐT người nhận che hết', () => {
    expect(maskPhone('0339213208')).toBe('033***3208');
    expect(maskPhone('0339 213 208')).toBe('033***3208');
    expect(hidePhone('0383352515')).toBe('***********');
  });

  it('địa chỉ che số nhà / đường, giữ thôn → tỉnh', () => {
    expect(maskedAddress('Số nhà 1564', 'Ấp Vĩnh Nghĩa, Xã Vĩnh Hậu, An Giang')).toBe(
      '***, Ấp Vĩnh Nghĩa, Xã Vĩnh Hậu, An Giang',
    );
    expect(maskedAddress(null, 'Xã Thạch Thất, Hà Nội')).toBe('Xã Thạch Thất, Hà Nội');
  });

  it('tuyến: cùng tỉnh / cùng miền / khác miền; tên có tiền tố, tên cũ; tỉnh lạ → null', () => {
    expect(routeLabel('Hà Nội', 'Thành phố Hà Nội')).toBe('NỘI TỈNH');
    expect(routeLabel('Hà Nội', 'Hải Phòng')).toBe('NỘI MIỀN');
    expect(routeLabel('Hà Nội', 'An Giang')).toBe('LIÊN MIỀN');
    expect(routeLabel('TP. Hồ Chí Minh', 'Đồng Tháp')).toBe('NỘI MIỀN');
    expect(routeLabel('Đà Nẵng', 'Thừa Thiên Huế')).toBe('NỘI MIỀN');
    expect(routeLabel('Hà Nội', 'Atlantis')).toBeNull();
    expect(routeLabel(null, 'An Giang')).toBeNull();
  });

  it('ghi chú in: ghi chú đơn + xem hàng + gọi shop, mỗi ý một dòng', () => {
    expect(
      printNote({ note: 'Giao giờ hành chính', allowInspection: false, callShopOnFailure: true }),
    ).toBe('Giao giờ hành chính\nKhông cho xem hàng\nGọi shop khi không giao được');
    expect(printNote({ note: null, allowInspection: null, callShopOnFailure: null })).toBeNull();
  });
});
