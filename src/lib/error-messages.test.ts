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
});
