import Decimal from 'decimal.js';
import type { SalesOrderLine } from './api/use-orders';

/** Một dòng phiếu in sau khi cộng các dòng cùng SKU + cùng ĐVT. */
export interface PrintLine {
  key: string;
  no: number;
  line: SalesOrderLine;
  /** Tổng SL (bán + khuyến mãi), chuỗi decimal. */
  qty: string;
  /** Phần tặng trong tổng; '0' = không có. */
  giftQty: string;
}

/**
 * Dòng in đơn (2026-11-03): sản phẩm khuyến mãi trùng SKU với hàng bán thì CỘNG số lượng — bán 10
 * gói + tặng 2 gói in một dòng "12" (kèm "gồm 2 tặng"), người đóng hàng lấy một lần. Gộp theo
 * SKU + ĐVT để không cộng lẫn thùng với gói; thứ tự theo dòng đầu tiên.
 */
export function mergePrintLines(lines: readonly SalesOrderLine[]): PrintLine[] {
  const out = new Map<string, PrintLine>();
  for (const l of lines) {
    const key = `${l.skuId}:${l.uomId}`;
    const cur = out.get(key);
    const gift = l.isGift ? new Decimal(l.qty) : new Decimal(0);
    if (cur) {
      cur.qty = new Decimal(cur.qty).plus(l.qty).toString();
      cur.giftQty = new Decimal(cur.giftQty).plus(gift).toString();
      continue;
    }
    out.set(key, {
      key,
      no: out.size + 1,
      line: l,
      qty: new Decimal(l.qty).toString(),
      giftQty: gift.toString(),
    });
  }
  return [...out.values()];
}
