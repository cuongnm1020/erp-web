import Decimal from 'decimal.js';

/**
 * Pancake chỉ lưu đơn giá NGUYÊN đồng × số lượng. Thành tiền không chia hết cho SL (vd 5.400.000
 * cho 42 chai = 128.571,43/chai) thì Pancake ra số khác (5.399.982) và ghi đè ngược ERP — sự cố
 * SOP2610-107401 (2026-11-03). Server chặn bằng 422 PANCAKE_LINE_AMOUNT_INDIVISIBLE; màn Sửa đơn
 * báo trước + gợi ý hai mức gần nhất Pancake giữ được. Cùng luật với
 * `apps/api/src/modules/pancake-sync/push/pancake-line-amount.ts`.
 *
 * @returns null = hợp lệ (chia hết, sai số < 0,01 đ); không thì hai mức gần nhất (chuỗi số nguyên).
 */
export function pancakeAmountFix(
  total: string,
  qtyBase: Decimal.Value,
): { lower: string; upper: string } | null {
  const qty = new Decimal(qtyBase);
  const amount = new Decimal(total);
  if (qty.lte(0)) return null;
  const per = amount.div(qty);
  const unit = per.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (unit.mul(qty).minus(amount).abs().lt('0.01')) return null;
  return {
    lower: per.toDecimalPlaces(0, Decimal.ROUND_FLOOR).mul(qty).toFixed(0),
    upper: per.toDecimalPlaces(0, Decimal.ROUND_CEIL).mul(qty).toFixed(0),
  };
}
