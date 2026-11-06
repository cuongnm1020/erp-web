import { describe, expect, it } from 'vitest';
import { ApiError } from './api/errors';
import { messageFor, packShortageText } from './error-messages';

describe('ORDER_PACK_SHORTAGE (2026-11-05) — không đóng gói thiếu, nêu SKU × số thiếu', () => {
  it('packShortageText liệt kê từng dòng; rỗng → chuỗi rỗng', () => {
    expect(
      packShortageText([
        { skuCode: 'SP-0213', qtyMissing: '10' },
        { skuCode: 'SP-0108', qtyMissing: '1' },
      ]),
    ).toBe('Thiếu: SP-0213 × 10, SP-0108 × 1.');
    expect(packShortageText([])).toBe('');
  });

  it('messageFor dịch mã + nối dòng thiếu từ details, không dùng message thô', () => {
    const err = new ApiError(
      409,
      'ORDER_PACK_SHORTAGE',
      'Đơn SO2611-00349 còn thiếu hàng (message thô)',
      {
        docNumber: 'SO2611-00349',
        shortages: [{ lineNo: 2, skuCode: 'SP-0213', qtyMissing: '10' }],
      },
      undefined,
    );
    const text = messageFor(err);
    expect(text).toContain('không đóng gói thiếu');
    expect(text).toContain('Thiếu: SP-0213 × 10.');
    expect(text).not.toContain('message thô');
  });

  it('ORDER_SKU_SELL_WAREHOUSE: nêu sản phẩm + kho được bán từ details (2026-11-05)', () => {
    const err = new ApiError(
      409,
      'ORDER_SKU_SELL_WAREHOUSE',
      'message thô',
      {
        docNumber: null,
        warehouseName: 'Kho Thạch Thất',
        skus: [{ code: 'SP-0213', name: 'Siêu kali 25gr', sellWarehouseName: 'Kho Long An' }],
      },
      undefined,
    );
    expect(messageFor(err)).toBe(
      'SP-0213 chỉ bán từ Kho Long An. Đổi Kho xuất sang đúng kho đó hoặc bỏ sản phẩm khỏi đơn.',
    );
  });
});

describe('ORDER_SORT_TOO_BROAD (2026-11-06) — sắp Sản phẩm / Cân nặng quá 200.000 đơn', () => {
  it('nói rõ quá nhiều đơn + cách thu hẹp, không rơi về câu chung 422', () => {
    const err = new ApiError(
      422,
      'ORDER_SORT_TOO_BROAD',
      'message thô',
      { max: 200000 },
      undefined,
    );
    const text = messageFor(err);
    expect(text).toContain('Quá nhiều đơn để sắp theo cột này');
    expect(text).not.toContain('Một số trường chưa hợp lệ');
    expect(text).not.toContain('message thô');
  });
});
