import { describe, expect, it } from 'vitest';
import type { ShipmentLabelData } from './api/use-pda';
import { sortLabelsForPrint } from './waybill-sort';

const label = (id: string, items: Array<[string, string]>): ShipmentLabelData =>
  ({
    shipmentId: id,
    items: items.map(([name, qty]) => ({ name, qty })),
  }) as ShipmentLabelData;

const order = (ls: ShipmentLabelData[]) => sortLabelsForPrint(ls).map((l) => l.shipmentId);

describe('sortLabelsForPrint', () => {
  it('abc theo tên sản phẩm, số tự nhiên; cùng tên thì đơn ít sản phẩm trước', () => {
    const ls = [
      label('amino', [['Amino tổng hợp', '1.000000']]),
      label('c5-a', [['COMBO 5 CHAI CANXI BIO', '1.000000']]),
      label('c2-a', [['COMBO 2 CHAI CANXI BIO', '1.000000']]),
      label('c10', [['COMBO 10 CHAI CANXI BIO', '1.000000']]),
      label('c5-b', [['combo 5 chai canxi bio', '1.000000']]),
      label('c2-b', [['COMBO 2 CHAI CANXI BIO', '1.000000']]),
      label('c5-c', [['COMBO 5 CHAI CANXI BIO', '1.000000']]),
    ];
    expect(order(ls)).toEqual(['amino', 'c2-a', 'c2-b', 'c5-a', 'c5-b', 'c5-c', 'c10']);
  });

  it('cùng sản phẩm: một mặt hàng trước nhiều mặt hàng, ít số lượng trước; không hàng xuống cuối', () => {
    const ls = [
      label('empty', []),
      label('mix', [
        ['Phân bón B', '1.000000'],
        ['Canxi bio', '1.000000'],
      ]),
      label('qty3', [['Canxi bio', '3.000000']]),
      label('qty1', [['Canxi bio', '1.000000']]),
      label('other', [['Đạm cá', '1.000000']]),
    ];
    expect(order(ls)).toEqual(['qty1', 'qty3', 'mix', 'other', 'empty']);
  });

  it('không đổi mảng gốc', () => {
    const ls = [label('b', [['B', '1']]), label('a', [['A', '1']])];
    sortLabelsForPrint(ls);
    expect(ls.map((l) => l.shipmentId)).toEqual(['b', 'a']);
  });
});
