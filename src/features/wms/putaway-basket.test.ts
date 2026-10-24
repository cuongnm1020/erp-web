import { describe, expect, it } from 'vitest';
import {
  addLoose,
  addUnits,
  assignItems,
  basketEmpty,
  classifyCode,
  freeUnits,
  looseFree,
  padToBase,
  pickUnits,
  plainQty,
  type PutAwayGroup,
  type PutAwayView,
} from './putaway-basket';
import { looseMovable, toggleUnits, type LocationItem } from './relocate-selection';

const unit = (n: number, parent: string | null = null) => ({
  id: `c-${n}`,
  barcode: `THG-${n}`,
  qty: '24.000000',
  childCount: 0,
  parentBarcode: parent,
});

const group = (over: Partial<PutAwayGroup> = {}): PutAwayGroup => ({
  key: 'g',
  skuId: 'sku',
  skuCode: 'SP',
  skuName: 'SP',
  baseUomCode: 'GOI',
  lotId: null,
  lotNumber: null,
  containerTypeCode: 'CARTON',
  containerTypeName: 'Thùng',
  remainingCount: 4,
  remainingQty: '96.000000',
  placedCount: 0,
  placedQty: '0.000000',
  suggestedLocationCode: null,
  containers: [unit(1), unit(2, 'PL-1'), unit(3, 'PL-1'), unit(4)],
  ...over,
});

const view = (groups: PutAwayGroup[]): PutAwayView => ({
  taskId: 't',
  docNumber: 'PUT',
  status: 'ASSIGNED',
  assignedToMe: true,
  receiptDocNumber: null,
  fromLocationCode: null,
  defaultLocation: null,
  groups,
  placed: [],
  remainingCount: 4,
});

describe('giỏ cất hàng (LOC-6)', () => {
  it('quét 1 thùng + số thùng: thùng vừa quét trước, rồi mã tăng dần, bỏ thùng đã trong giỏ', () => {
    const g = group();
    const b1 = addUnits([], g, pickUnits(g, unit(3, 'PL-1'), 2, []));
    expect(b1[0]!.units.map((u) => u.id)).toEqual(['c-3', 'c-1']);
    expect(freeUnits(g, b1).map((u) => u.id)).toEqual(['c-2', 'c-4']);
    expect(pickUnits(g, unit(4), 9, b1).map((u) => u.id)).toEqual(['c-4', 'c-2']);
  });

  it('mã thùng / mã pallet bọc khớp cục bộ, không phân biệt hoa thường', () => {
    const v = view([group()]);
    expect(classifyCode(v, ' thg-4 ')).toMatchObject({ kind: 'unit', unit: { id: 'c-4' } });
    const pallet = classifyCode(v, 'pl-1');
    expect(pallet.kind === 'pallet' && pallet.units.map((u) => u.id)).toEqual(['c-2', 'c-3']);
    expect(classifyCode(v, 'X').kind).toBe('none');
  });

  it('hàng rời: ô số theo ĐVT → cơ sở; còn lại trừ phần trong giỏ; thân assign đúng DTO', () => {
    const g = group({
      key: 'l',
      containerTypeCode: null,
      containers: [],
      remainingQty: '10.000000',
    });
    expect(padToBase('2', '3')).toBe('6.000000');
    expect(padToBase('1,5', '2')).toBe('3.000000');
    expect(padToBase('0', '1')).toBeNull();
    expect(padToBase('abc', '1')).toBeNull();
    const b = addLoose([], g, '4.000000');
    expect(looseFree(g, b)).toBe('6.000000');
    expect(basketEmpty(b)).toBe(false);
    expect(assignItems(b)).toEqual({ loose: [{ skuId: 'sku', lotId: null, qty: '4.000000' }] });
    expect(assignItems([])).toEqual({});
    expect(plainQty('12.500000')).toBe('12.5');
    expect(plainQty('10.000000')).toBe('10');
  });
});

describe('chọn hàng chuyển (LOC-8)', () => {
  const item: LocationItem = {
    skuId: 's',
    skuCode: 'S',
    skuName: 'S',
    baseUomCode: 'GOI',
    lotId: null,
    lotNumber: null,
    onHand: '58.000000',
    reserved: '0.000000',
    inHand: '20.000000',
    movable: '38.000000',
    looseQty: '10.000000',
    containers: [
      {
        id: 'c-1',
        barcode: 'T1',
        typeCode: 'C',
        typeName: 'C',
        status: 'STORED',
        qty: '24.000000',
        parentBarcode: null,
      },
      {
        id: 'c-2',
        barcode: 'T2',
        typeCode: 'C',
        typeName: 'C',
        status: 'STORED',
        qty: '24.000000',
        parentBarcode: null,
      },
    ],
  };

  it('hàng rời chuyển được = min(rời, chuyển được − thùng đã chọn)', () => {
    expect(looseMovable(item, { units: [], loose: {} })).toBe('10.000000');
    expect(looseMovable(item, { units: ['c-1'], loose: {} })).toBe('10.000000');
    expect(looseMovable(item, { units: ['c-1', 'c-2'], loose: {} })).toBe('0.000000');
  });

  it('tick lại cả nhóm đã chọn → bỏ chọn', () => {
    const s = toggleUnits({ units: [], loose: {} }, ['c-1', 'c-2']);
    expect(s.units).toEqual(['c-1', 'c-2']);
    expect(toggleUnits(s, ['c-1', 'c-2']).units).toEqual([]);
  });
});
