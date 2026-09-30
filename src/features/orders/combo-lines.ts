import Decimal from 'decimal.js';
import type { SalesOrderLine } from './api/use-orders';

/**
 * Dòng đơn từ API là dòng THÀNH PHẦN đã bung (server giữ tồn / pick / hoá đơn trên đó);
 * `line.combo` (cùng `groupNo`) cho biết dòng thuộc combo nào. UI gộp lại để người bán
 * thấy "3 × Combo A+B = 450.000" thay vì hai dòng thành phần với giá đã phân bổ.
 */
export interface ComboGroup {
  kind: 'combo';
  groupNo: number;
  skuId: string;
  skuCode: string;
  skuName: string;
  /** Số combo đặt — Decimal(18,6) chuỗi. */
  qty: string;
  /** Giá niêm yết / giá bán MỘT combo — Decimal(18,4) chuỗi. */
  listPrice: string;
  unitPrice: string;
  /** Σ chiết khấu / Σ thành tiền các dòng thành phần — đúng bằng giá combo × số combo. */
  discount: string;
  lineTotal: string;
  lines: SalesOrderLine[];
}

export type OrderLineGroup = { kind: 'line'; line: SalesOrderLine } | ComboGroup;

/** Gộp dòng thành phần theo `combo.groupNo`, giữ thứ tự xuất hiện; dòng thường giữ nguyên. */
export function groupOrderLines(lines: readonly SalesOrderLine[]): OrderLineGroup[] {
  const out: OrderLineGroup[] = [];
  const byGroup = new Map<number, ComboGroup>();
  for (const line of lines) {
    if (!line.combo) {
      out.push({ kind: 'line', line });
      continue;
    }
    let g = byGroup.get(line.combo.groupNo);
    if (!g) {
      g = {
        kind: 'combo',
        groupNo: line.combo.groupNo,
        skuId: line.combo.skuId,
        skuCode: line.combo.skuCode,
        skuName: line.combo.skuName,
        qty: line.combo.qty,
        listPrice: line.combo.listPrice,
        unitPrice: line.combo.unitPrice,
        discount: '0',
        lineTotal: '0',
        lines: [],
      };
      byGroup.set(line.combo.groupNo, g);
      out.push(g);
    }
    g.lines.push(line);
    g.discount = new Decimal(g.discount).plus(line.discount).toFixed(4);
    g.lineTotal = new Decimal(g.lineTotal).plus(line.lineTotal).toFixed(4);
  }
  return out;
}

/**
 * Tạo lại đơn từ đơn cũ (`?from=`): các dòng thành phần của một combo gộp về MỘT dòng nhập
 * với skuId = SKU combo, qty = số combo. `uomId` để trống — form tự chọn ĐVT cơ sở của SKU
 * combo khi tải chi tiết SKU. Dòng thường giữ nguyên.
 */
export function collapseComboLines(
  lines: readonly SalesOrderLine[],
): Array<{ skuId: string; uomId: string; qty: string }> {
  const out: Array<{ skuId: string; uomId: string; qty: string }> = [];
  const seen = new Set<number>();
  for (const l of lines) {
    if (!l.combo) {
      out.push({ skuId: l.skuId, uomId: l.uomId, qty: l.qty });
      continue;
    }
    if (seen.has(l.combo.groupNo)) continue;
    seen.add(l.combo.groupNo);
    out.push({ skuId: l.combo.skuId, uomId: '', qty: l.combo.qty });
  }
  return out;
}
