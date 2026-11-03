import { describe, expect, it } from 'vitest';
import type { SalesOrderLine } from './api/use-orders';
import { mergePrintLines } from './print-lines';

const line = (p: Partial<SalesOrderLine>): SalesOrderLine =>
  ({
    id: `l-${Math.random()}`,
    skuId: 'sku-ches',
    uomId: 'uom-goi',
    qty: '1',
    isGift: false,
    skuName: 'Ches thái lan 100gr',
    skuCode: 'SP-0083',
    ...p,
  }) as SalesOrderLine;

describe('mergePrintLines — in đơn cộng SL cùng SKU (2026-11-03)', () => {
  it('bán 10 + tặng 2 cùng SKU → một dòng 12, gồm 2 tặng', () => {
    const out = mergePrintLines([
      line({ qty: '10.000000' }),
      line({ qty: '2.000000', isGift: true }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ no: 1, qty: '12', giftQty: '2' });
  });

  it('khác SKU hoặc khác ĐVT → dòng riêng, đánh số lại', () => {
    const out = mergePrintLines([
      line({ qty: '10' }),
      line({ skuId: 'sku-khac', qty: '1', isGift: true }),
      line({ uomId: 'uom-thung', qty: '1' }),
    ]);
    expect(out.map((r) => [r.no, r.qty, r.giftQty])).toEqual([
      [1, '10', '0'],
      [2, '1', '1'],
      [3, '1', '0'],
    ]);
  });
});
