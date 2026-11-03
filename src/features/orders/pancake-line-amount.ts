import Decimal from 'decimal.js';

/**
 * Pancake chỉ lưu đơn giá NGUYÊN đồng × số lượng. Thành tiền không chia hết cho SL (vd 5.400.000
 * cho 42 chai = 128.571,43/chai) thì Pancake ra số khác (42 × 128.571 = 5.399.982). Từ 2026-11-03
 * (user chốt) server gửi Pancake đơn giá làm tròn, ERP giữ nguyên thành tiền đã nhập — đơn sửa
 * trên ERP là "ERP giữ", webhook không ghi đè ngược. Màn Sửa đơn chỉ báo con số Pancake sẽ ghi.
 * Cùng cách làm tròn với `apps/api/src/modules/pancake-sync/push/pancake-line-amount.ts`.
 *
 * @returns null = chia hết (sai số < 0,01 đ); không thì đơn giá + thành tiền Pancake sẽ ghi.
 */
export function pancakeAmountFix(
  total: string,
  qtyBase: Decimal.Value,
): { unit: string; pancakeTotal: string } | null {
  const qty = new Decimal(qtyBase);
  const amount = new Decimal(total);
  if (qty.lte(0)) return null;
  const unit = amount.div(qty).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (unit.mul(qty).minus(amount).abs().lt('0.01')) return null;
  return { unit: unit.toFixed(0), pancakeTotal: unit.mul(qty).toFixed(0) };
}
