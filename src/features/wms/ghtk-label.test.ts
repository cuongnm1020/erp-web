import { describe, expect, it } from 'vitest';
import { hidePhone, maskedAddress, maskPhone, parseGhtkTracking, printNote } from './ghtk-label';

describe('tem kiểu GHTK — tiện ích', () => {
  it('tách mã vận đơn GHTK: mã shop + mã số ngắn; mã không đúng dạng → null', () => {
    expect(parseGhtkTracking('S23119447.BO.MN13-12-P52.1763110086')).toEqual({
      shopCode: 'S23119447',
      shortCode: '1763110086',
    });
    expect(parseGhtkTracking('S1.A1.1763110086')).toBeNull();
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

  it('ghi chú in: ghi chú đơn + xem hàng + gọi shop, mỗi ý một dòng', () => {
    expect(
      printNote({ note: 'Giao giờ hành chính', allowInspection: false, callShopOnFailure: true }),
    ).toBe('Giao giờ hành chính\nKhông cho xem hàng\nGọi shop khi không giao được');
    expect(printNote({ note: null, allowInspection: null, callShopOnFailure: null })).toBeNull();
  });
});
