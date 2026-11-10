import { describe, expect, it } from 'vitest';
import { CARRIERS } from '@/test/msw/handlers';
import type { Carrier } from '@/features/wms/api/use-shipping';
import { carrierFilterOptions, parseCarrierFilter } from './carrier-filter';

/** GHTK hai tài khoản đủ cấu hình + một chưa cấu hình (như carrier-select.test). */
const WITH_ACCOUNTS = CARRIERS.map((c) =>
  c.code === 'GHTK'
    ? {
        ...c,
        accounts: [
          {
            id: 'acc-hl',
            name: 'Nam Việt - Hàng Lòng',
            code: 'S23119447',
            isDefault: true,
            configured: true,
          },
          { id: 'acc-cn', name: 'Cá Nhân', code: 'S23166145', isDefault: false, configured: true },
          { id: 'acc-x', name: 'Shop chưa xong', code: null, isDefault: false, configured: false },
        ],
      }
    : c,
) as Carrier[];

describe('Ô Hãng VC màn In đơn (2026-11-10)', () => {
  it('mỗi hãng một dòng "tất cả tài khoản" rồi các tài khoản đủ cấu hình ngay dưới; hãng không tài khoản chỉ dòng hãng', () => {
    const opts = carrierFilterOptions(WITH_ACCOUNTS);
    const ghtk = opts.filter((o) => o.label.startsWith('GHTK') || o.hint === 'GHTK');
    expect(ghtk).toEqual([
      { value: 'c:c-ghtk', label: 'GHTK · tất cả tài khoản', hint: '2 tài khoản' },
      { value: 'a:acc-hl', label: 'GHTK S23119447 Nam Việt - Hàng Lòng', hint: 'GHTK' },
      { value: 'a:acc-cn', label: 'GHTK S23166145 Cá Nhân', hint: 'GHTK' },
    ]);
    // Gõ "ghtk" (ô chọn tìm trong nhãn) ra dòng hãng + mọi tài khoản GHTK.
    expect(opts.filter((o) => /ghtk/i.test(o.label)).map((o) => o.value)).toEqual(
      ghtk.map((o) => o.value),
    );
    expect(opts.some((o) => o.label.includes('Shop chưa xong'))).toBe(false);
    const manual = opts.find((o) => o.label.startsWith('Giao thủ công'));
    expect(manual?.hint).toBe('Hãng');
    expect(manual?.value.startsWith('c:')).toBe(true);
  });

  it('URL → carrierIds / carrierAccountIds, bỏ giá trị hỏng', () => {
    const c = '11111111-1111-4111-8111-111111111111';
    const a = '22222222-2222-4222-8222-222222222222';
    expect(parseCarrierFilter(`c:${c},a:${a},a:xyz,${c}`)).toEqual({
      value: `c:${c},a:${a}`,
      carrierIds: c,
      carrierAccountIds: a,
    });
    expect(parseCarrierFilter(undefined)).toEqual({
      value: '',
      carrierIds: '',
      carrierAccountIds: '',
    });
  });
});
