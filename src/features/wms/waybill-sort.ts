import Decimal from 'decimal.js';
import type { ShipmentLabelData } from './api/use-pda';

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

/** Tên các mặt hàng của đơn, xếp abc — khoá nhóm khi in. */
const names = (l: ShipmentLabelData): string[] =>
  l.items.map((i) => i.name.trim()).sort(collator.compare);

const totalQty = (l: ShipmentLabelData): Decimal =>
  l.items.reduce((s, i) => s.plus(new Decimal(i.qty || 0)), new Decimal(0));

/**
 * Thứ tự in tem vận đơn hàng loạt (2026-10-28): gom đơn cùng sản phẩm cạnh nhau để đóng gói
 * theo lô — xếp abc theo tên sản phẩm (so số tự nhiên: "COMBO 2 …" trước "COMBO 5 …" trước
 * "COMBO 10 …"), cùng tên thì đơn ít sản phẩm trước (ít mặt hàng → ít tổng số lượng), rồi các
 * tên tiếp theo của đơn nhiều mặt hàng. Đơn không có hàng xuống cuối. Không đổi mảng gốc;
 * hoà nhau giữ thứ tự ban đầu.
 */
export function sortLabelsForPrint(labels: readonly ShipmentLabelData[]): ShipmentLabelData[] {
  const keyed = labels.map((l, idx) => ({ l, idx, names: names(l), qty: totalQty(l) }));
  keyed.sort((a, b) => {
    if (!a.names.length || !b.names.length) {
      if (a.names.length !== b.names.length) return a.names.length ? -1 : 1;
      return a.idx - b.idx;
    }
    const first = collator.compare(a.names[0]!, b.names[0]!);
    if (first !== 0) return first;
    if (a.names.length !== b.names.length) return a.names.length - b.names.length;
    const qty = a.qty.comparedTo(b.qty);
    if (qty !== 0) return qty;
    for (let i = 1; i < a.names.length; i++) {
      const c = collator.compare(a.names[i]!, b.names[i]!);
      if (c !== 0) return c;
    }
    return a.idx - b.idx;
  });
  return keyed.map((k) => k.l);
}
