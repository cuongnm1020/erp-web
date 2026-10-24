import Decimal from 'decimal.js';
import type { components } from '@/lib/api/schema';

/**
 * Giỏ cất hàng (LOC-6 bản web, `docs/PLAN-putaway-relocate.md`) — thuần, cùng luật với app PDA
 * (`apps/pda/src/features/putaway/basket.ts`): quét thùng + gõ số thùng / hàng rời vào giỏ rồi
 * quét MỘT vị trí → `POST /pda/putaway/:id/assign`. Giỏ không lên server trước lúc gán.
 * Số lượng là chuỗi decimal (luật 10) — tính bằng decimal.js.
 */
export type PutAwayView = components['schemas']['PdaPutAwayViewDto'];
export type PutAwayGroup = PutAwayView['groups'][number];
export type PutAwayUnit = PutAwayGroup['containers'][number];
export type AssignBody = components['schemas']['PdaPutAwayAssignDto'];

const dec = (v: string): Decimal => new Decimal(v.trim() || '0');
const fix = (d: Decimal): string => d.toFixed(6);
export const ZERO = '0.000000';
/** Chuỗi gõ được vào ô số (không nhóm nghìn, bỏ số 0 thừa): "12.500000" → "12.5". */
export const plainQty = (v: string): string =>
  dec(v)
    .toFixed(6)
    .replace(/\.?0+$/, '');
export const qtyGt = (a: string, b: string): boolean => dec(a).gt(dec(b));
const sumQty = (vs: string[]): string =>
  fix(vs.reduce((acc, v) => acc.plus(dec(v)), new Decimal(0)));

export interface BasketEntry {
  groupKey: string;
  skuId: string;
  lotId: string | null;
  skuCode: string;
  skuName: string;
  uomCode: string;
  /** Thùng đã chọn (rỗng với hàng rời). */
  units: PutAwayUnit[];
  /** Hàng rời (ĐVT cơ sở). */
  looseQty: string;
}

export type Basket = BasketEntry[];

export const sameCode = (a: string, b: string | null | undefined): boolean =>
  b != null && a.trim().toUpperCase() === b.trim().toUpperCase();

export const basketUnitIds = (basket: Basket): Set<string> =>
  new Set(basket.flatMap((e) => e.units.map((u) => u.id)));

export const basketUnitCount = (basket: Basket): number =>
  basket.reduce((n, e) => n + e.units.length, 0);

export const entryQty = (e: BasketEntry): string =>
  fix(dec(sumQty(e.units.map((u) => u.qty))).plus(dec(e.looseQty)));

export const basketEmpty = (basket: Basket): boolean =>
  basket.every((e) => e.units.length === 0 && !qtyGt(e.looseQty, ZERO));

/** Thùng còn chọn được của nhóm (chưa vào giỏ), mã tăng dần như server trả. */
export const freeUnits = (group: PutAwayGroup, basket: Basket): PutAwayUnit[] => {
  const taken = basketUnitIds(basket);
  return group.containers.filter((c) => !taken.has(c.id));
};

export type ScanHit =
  | { kind: 'unit'; group: PutAwayGroup; unit: PutAwayUnit }
  /** Mã pallet bọc: mọi thùng con còn trong pallet. */
  | { kind: 'pallet'; group: PutAwayGroup; barcode: string; units: PutAwayUnit[] }
  | { kind: 'none' };

/** Khớp mã quét cục bộ: mã thùng → mã pallet bọc. Không khớp → màn resolve (SKU / vị trí). */
export function classifyCode(view: PutAwayView, raw: string): ScanHit {
  const code = raw.trim();
  for (const g of view.groups) {
    const unit = g.containers.find((c) => sameCode(code, c.barcode));
    if (unit) return { kind: 'unit', group: g, unit };
  }
  for (const g of view.groups) {
    const units = g.containers.filter((c) => sameCode(code, c.parentBarcode));
    if (units.length > 0)
      return { kind: 'pallet', group: g, barcode: units[0]!.parentBarcode!, units };
  }
  return { kind: 'none' };
}

/**
 * Chọn `count` thùng của nhóm: thùng vừa quét trước, rồi các thùng còn lại theo mã tăng dần —
 * luật "quét 1 thùng + gõ số lượng" (user chốt 2026-10-24).
 */
export function pickUnits(
  group: PutAwayGroup,
  scanned: PutAwayUnit,
  count: number,
  basket: Basket,
): PutAwayUnit[] {
  const free = freeUnits(group, basket);
  const first = free.find((u) => u.id === scanned.id);
  const rest = free.filter((u) => u.id !== scanned.id);
  return [...(first ? [first] : []), ...rest].slice(0, Math.max(0, count));
}

function upsert(
  basket: Basket,
  group: PutAwayGroup,
  patch: (e: BasketEntry) => BasketEntry,
): Basket {
  const found = basket.find((e) => e.groupKey === group.key);
  const base: BasketEntry = found ?? {
    groupKey: group.key,
    skuId: group.skuId,
    lotId: group.lotId,
    skuCode: group.skuCode,
    skuName: group.skuName,
    uomCode: group.baseUomCode,
    units: [],
    looseQty: ZERO,
  };
  const next = patch(base);
  return found ? basket.map((e) => (e.groupKey === group.key ? next : e)) : [...basket, next];
}

export const addUnits = (basket: Basket, group: PutAwayGroup, units: PutAwayUnit[]): Basket => {
  const taken = basketUnitIds(basket);
  const fresh = units.filter((u) => !taken.has(u.id));
  return upsert(basket, group, (e) => ({ ...e, units: [...e.units, ...fresh] }));
};

/** Nhóm hàng rời còn phải cất của SKU — null nếu không có. */
export function looseGroup(view: PutAwayView, skuId: string): PutAwayGroup | null {
  return (
    view.groups.find(
      (g) => g.skuId === skuId && g.containerTypeCode === null && qtyGt(g.remainingQty, ZERO),
    ) ?? null
  );
}

/** Hàng rời của nhóm còn đưa vào giỏ được. */
export const looseFree = (group: PutAwayGroup, basket: Basket): string => {
  const inBasket = basket.find((e) => e.groupKey === group.key)?.looseQty ?? ZERO;
  return fix(dec(group.remainingQty).minus(dec(inBasket)));
};

export const addLoose = (basket: Basket, group: PutAwayGroup, qty: string): Basket =>
  upsert(basket, group, (e) => ({ ...e, looseQty: fix(dec(e.looseQty).plus(dec(qty))) }));

/** Ô số lượng (ĐVT của mã quét) → ĐVT cơ sở; rỗng / không hợp lệ / 0 → null. */
export function padToBase(value: string, factor: string): string | null {
  if (!/^\d+([.,]\d{1,6})?$/.test(value.trim())) return null;
  const q = dec(value.replace(',', '.'));
  if (q.isZero()) return null;
  return fix(q.times(dec(factor)));
}

/** Thân `POST /pda/putaway/:id/assign` (không kèm đích / key — màn ghép vào). */
export function assignItems(basket: Basket): Pick<AssignBody, 'containerIds' | 'loose'> {
  const containerIds = basket.flatMap((e) => e.units.map((u) => u.id));
  const loose = basket
    .filter((e) => qtyGt(e.looseQty, ZERO))
    .map((e) => ({ skuId: e.skuId, lotId: e.lotId, qty: e.looseQty }));
  return {
    ...(containerIds.length ? { containerIds } : {}),
    ...(loose.length ? { loose } : {}),
  };
}
