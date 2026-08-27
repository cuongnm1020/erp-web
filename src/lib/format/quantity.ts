import Decimal from 'decimal.js';
import { EMPTY, groupVi, NBSP, toDecimal, type MoneyInput } from './money';

/**
 * Số lượng (luật 10): API trả Decimal(18,6) dạng string theo đơn vị cơ sở.
 * Đổi đơn vị chỉ ở lớp hiển thị: truyền `factor` (1 thùng = 24 cái → factor 24).
 */
export interface QuantityFormatOptions {
  /** Số thập phân tối đa; bỏ số 0 thừa. Mặc định 3 (kg). */
  maxDp?: number;
  /** Tên đơn vị hiển thị. */
  unit?: string;
  /** Chia cho factor trước khi hiển thị (đổi đơn vị). */
  factor?: string | number;
}

export function formatQuantity(v: MoneyInput, opts: QuantityFormatOptions = {}): string {
  let d = toDecimal(v);
  if (d === null) return EMPTY;
  if (opts.factor !== undefined) {
    const f = new Decimal(opts.factor);
    if (f.isZero()) return EMPTY;
    d = d.div(f);
  }
  const maxDp = opts.maxDp ?? 3;
  const fixed = d.toDecimalPlaces(maxDp).toFixed(maxDp);
  const neg = fixed.startsWith('-');
  const [intRaw = '0', fracRaw = ''] = (neg ? fixed.slice(1) : fixed).split('.');
  const frac = fracRaw.replace(/0+$/, '');
  const body = frac ? `${groupVi(intRaw)},${frac}` : groupVi(intRaw);
  return `${neg ? '−' : ''}${body}${opts.unit ? `${NBSP}${opts.unit}` : ''}`;
}
