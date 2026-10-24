import Decimal from 'decimal.js';
import type { components } from '@/lib/api/schema';
import { qtyGt, sameCode, ZERO } from './putaway-basket';

/**
 * Chọn hàng chuyển khỏi một vị trí (LOC-8 bản web) — thuần, cùng luật với app PDA
 * (`apps/pda/src/features/location/relocate-state.ts`). Chỉ chọn trong phần CHUYỂN ĐƯỢC: hàng đã
 * quét lấy cho đơn và thùng `PICKED` bị khoá.
 */
export type LocationContents = components['schemas']['PdaLocationContentsDto'];
export type LocationItem = LocationContents['items'][number];
export type LocationUnit = LocationItem['containers'][number];
export type RelocateBody = components['schemas']['PdaRelocateDto'];

const dec = (v: string): Decimal => new Decimal(v.trim() || '0');
const fix = (d: Decimal): string => d.toFixed(6);
const sumQty = (vs: string[]): string =>
  fix(vs.reduce((acc, v) => acc.plus(dec(v)), new Decimal(0)));

export const itemKey = (i: { skuId: string; lotId: string | null }): string =>
  `${i.skuId}|${i.lotId ?? ''}`;

export interface Selection {
  /** Thùng / pallet đã chọn (id). */
  units: string[];
  /** Hàng rời theo `itemKey` (ĐVT cơ sở). */
  loose: Record<string, string>;
}

export const EMPTY_SELECTION: Selection = { units: [], loose: {} };

export const isLocked = (u: LocationUnit): boolean => u.status === 'PICKED';

/** Hàng rời chuyển được = min(rời, chuyển được − thùng đã chọn của mã đó). */
export function looseMovable(item: LocationItem, sel: Selection): string {
  const inUnits = sumQty(item.containers.filter((c) => sel.units.includes(c.id)).map((c) => c.qty));
  const room = dec(item.movable).minus(dec(inUnits));
  const m = Decimal.min(dec(item.looseQty), room);
  return m.gt(0) ? fix(m) : ZERO;
}

/** Thùng (không khoá) khớp mã quét — mã thùng, hoặc mã pallet cha = mọi thùng con. */
export function unitsForCode(contents: LocationContents, raw: string): LocationUnit[] {
  const code = raw.trim();
  return contents.items.flatMap((i) =>
    i.containers.filter((c) => sameCode(code, c.barcode) || sameCode(code, c.parentBarcode)),
  );
}

/** Bật / tắt chọn các thùng; đã chọn hết thì bỏ chọn cả nhóm. */
export function toggleUnits(sel: Selection, ids: string[]): Selection {
  const allIn = ids.every((id) => sel.units.includes(id));
  const units = allIn
    ? sel.units.filter((id) => !ids.includes(id))
    : [...sel.units, ...ids.filter((id) => !sel.units.includes(id))];
  return { ...sel, units };
}

export const setLoose = (sel: Selection, key: string, qty: string): Selection => {
  const loose = { ...sel.loose };
  if (qtyGt(qty, ZERO)) loose[key] = fix(dec(qty));
  else delete loose[key];
  return { ...sel, loose };
};

export const selectionEmpty = (sel: Selection): boolean =>
  sel.units.length === 0 && Object.values(sel.loose).every((q) => !qtyGt(q, ZERO));

/** Tổng số lượng đã chọn (mọi SKU, ĐVT cơ sở) — chỉ để hiện. */
export function selectionQty(contents: LocationContents, sel: Selection): string {
  const unitQty = sumQty(
    contents.items.flatMap((i) =>
      i.containers.filter((c) => sel.units.includes(c.id)).map((c) => c.qty),
    ),
  );
  return fix(dec(unitQty).plus(dec(sumQty(Object.values(sel.loose)))));
}

export function relocateItems(
  contents: LocationContents,
  sel: Selection,
): Pick<RelocateBody, 'containerIds' | 'loose'> {
  const loose = contents.items
    .filter((i) => qtyGt(sel.loose[itemKey(i)] ?? ZERO, ZERO))
    .map((i) => ({ skuId: i.skuId, lotId: i.lotId, qty: sel.loose[itemKey(i)]! }));
  return {
    ...(sel.units.length ? { containerIds: sel.units } : {}),
    ...(loose.length ? { loose } : {}),
  };
}
