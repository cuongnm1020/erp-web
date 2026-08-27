import Decimal from 'decimal.js';

/**
 * Tiền (luật 10): API trả string decimal (Decimal(18,4)). Không bao giờ Number/parseFloat.
 * Hiển thị duy nhất qua formatMoney(). Nhóm nghìn kiểu VN: 1.234.567,50
 */
export const EMPTY = '—';
/** Khoảng trắng không ngắt dòng giữa số và đơn vị. */
export const NBSP = '\u00A0';

export type MoneyInput = string | Decimal | null | undefined;

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(v: MoneyInput): Decimal | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Decimal) return v.isFinite() ? v : null;
  const s = v.trim();
  if (!s) return null;
  try {
    const d = new Decimal(s);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export interface MoneyFormatOptions {
  /** Số chữ số thập phân hiển thị. VND mặc định 0; ngoại tệ 2. */
  dp?: number;
  /** Hậu tố đơn vị, mặc định '₫'. '' để bỏ. */
  unit?: string;
  /** Hiện dấu + cho số dương (bảng công nợ). */
  signed?: boolean;
}

/** Nhóm nghìn bằng '.', thập phân bằng ',' — thuần chuỗi, không qua Number. */
export function groupVi(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatMoney(v: MoneyInput, opts: MoneyFormatOptions = {}): string {
  const d = toDecimal(v);
  if (d === null) return EMPTY;
  const dp = opts.dp ?? 0;
  const unit = opts.unit ?? '₫';
  const fixed = d.toFixed(dp); // "-1234567.50"
  const neg = fixed.startsWith('-');
  const [intRaw = '0', frac] = (neg ? fixed.slice(1) : fixed).split('.');
  const body = frac !== undefined ? `${groupVi(intRaw)},${frac}` : groupVi(intRaw);
  const sign = neg ? '−' : opts.signed && !d.isZero() ? '+' : '';
  return `${sign}${body}${unit ? `${NBSP}${unit}` : ''}`;
}

/**
 * Chuỗi người dùng gõ ("1.234.567,5" / "1234567.5" / "1,234,567.50") → string decimal chuẩn
 * ("1234567.5") để gửi API. Trả null nếu không parse được.
 */
export function parseMoneyInput(raw: string): string | null {
  let s = raw.trim().replace(/\s|₫|đ/gi, '');
  if (!s) return null;
  const neg = s.startsWith('-') || s.startsWith('−');
  if (neg) s = s.slice(1);
  if (/[.,]{2}/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // VN: '.' nhóm nghìn, ',' thập phân
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // EN: ',' nhóm nghìn, '.' thập phân — hoặc VN chỉ có dấu chấm nhóm nghìn (1.234.567)
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1 || (lastComma === -1 && /^\d{1,3}(\.\d{3})+$/.test(s))) {
      s = s.replace(/\./g, '');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const d = toDecimal(s);
  if (!d) return null;
  return (neg ? d.neg() : d).toString();
}
