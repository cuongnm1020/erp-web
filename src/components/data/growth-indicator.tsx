import Decimal from 'decimal.js';
import { cn } from '@/lib/cn';
import { toDecimal, type MoneyInput } from '@/lib/format';

/**
 * % tăng/giảm so kỳ trước: (hiện tại − trước) / trước × 100, 2 chữ số. Kỳ trước = 0 → null
 * (không có nền để so). Tính bằng decimal.js (luật 10).
 */
export function growthPct(current: MoneyInput, previous: MoneyInput): string | null {
  const c = toDecimal(current);
  const p = toDecimal(previous);
  if (c === null || p === null || p.isZero()) return null;
  return c.minus(p).div(p.abs()).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Tỷ lệ phần trăm a / b × 100, 2 chữ số (ví dụ % lãi gộp trên doanh thu). b = 0 → null. */
export function ratioPct(a: MoneyInput, b: MoneyInput): string | null {
  const x = toDecimal(a);
  const y = toDecimal(b);
  if (x === null || y === null || y.isZero()) return null;
  return x.div(y).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** "12.50" → "12,50%" (bỏ dấu, dấu do mũi tên thể hiện). */
function pctLabel(abs: Decimal): string {
  return `${abs.toFixed(2).replace('.', ',')}%`;
}

/**
 * ▲ / ▼ kèm %. Mũi tên + chữ mang nghĩa, màu chỉ là lớp phụ (không dựa vào màu đơn thuần).
 * `inverse`: chỉ số "tăng là xấu" (hàng hoàn, tỷ lệ hoàn) → tăng tô đỏ.
 * pct null → "Mới" nếu có số hiện tại, ngược lại "—".
 */
export function GrowthIndicator({
  pct,
  inverse = false,
  hasCurrent = false,
  className,
}: {
  pct: string | null;
  inverse?: boolean;
  /** pct null nhưng kỳ này có số (kỳ trước = 0) → hiện "Mới". */
  hasCurrent?: boolean;
  className?: string;
}) {
  const d = toDecimal(pct);
  if (d === null) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        {hasCurrent ? 'Mới' : '—'}
      </span>
    );
  }
  if (d.isZero()) {
    return (
      <span className={cn('text-xs tabular-nums text-muted-foreground', className)}>0,00%</span>
    );
  }
  const up = d.isPositive();
  const good = inverse ? !up : up;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
        good ? 'text-success' : 'text-destructive',
        className,
      )}
      aria-label={`${up ? 'Tăng' : 'Giảm'} ${pctLabel(d.abs())} so kỳ trước`}
    >
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      {pctLabel(d.abs())}
    </span>
  );
}
