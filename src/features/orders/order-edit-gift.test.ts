import { describe, expect, it } from 'vitest';
import type { SalesOrderDetail } from './api/use-orders';
import { linesChange } from './components/order-edit-lines';

/** Sửa đơn có sản phẩm khuyến mãi (2026-11-03): giữ cờ tặng, không gửi đơn giá cho dòng tặng. */
const ORDER = {
  lines: [
    {
      id: 'l1',
      skuId: 'sku-ches',
      uomId: 'uom-goi',
      qty: '10.000000',
      unitPrice: '250000.0000',
      listPrice: '250000.0000',
      isGift: false,
      nonStock: false,
      combo: null,
    },
    {
      id: 'l2',
      skuId: 'sku-ches',
      uomId: 'uom-goi',
      qty: '2.000000',
      unitPrice: '0.0000',
      listPrice: '0.0000',
      isGift: true,
      nonStock: false,
      combo: null,
    },
  ],
  customItems: [],
} as unknown as SalesOrderDetail;

describe('linesChange — dòng khuyến mãi', () => {
  const base = [
    { skuId: 'sku-ches', uomId: 'uom-goi', qty: '10', unitPrice: '250000', discountPercent: '' },
    {
      skuId: 'sku-ches',
      uomId: 'uom-goi',
      qty: '2',
      unitPrice: '0',
      discountPercent: '',
      isGift: true,
    },
  ];

  it('không đổi gì → không gửi', () => {
    expect(linesChange(ORDER, base).body).toBeNull();
  });

  it('tăng SL tặng 2 → 3: gửi isGift, không gửi đơn giá dòng tặng', () => {
    const r = linesChange(ORDER, [base[0]!, { ...base[1]!, qty: '3' }]);
    expect(r.body?.lines).toEqual([
      { skuId: 'sku-ches', uomId: 'uom-goi', qty: '10', unitPrice: '250000' },
      { skuId: 'sku-ches', uomId: 'uom-goi', qty: '3', isGift: true },
    ]);
  });
});
