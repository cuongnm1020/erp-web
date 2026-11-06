import Decimal from 'decimal.js';

/**
 * COD dưới tỉ lệ này × Σ(giá niêm yết × SL) → nghi chiết khấu quá tay (2026-11-06, user chốt 30%).
 * Trước đây job `cod-alert` của api quét 10 phút một lần rồi báo Slack; nay kiểm ngay trên màn tạo
 * đơn, job đã tắt mặc định. Cùng công thức với `isCodLow` bên api.
 */
export const COD_LOW_RATIO = new Decimal('0.3');

/** Tỉ lệ COD / tổng giá niêm yết khi COD thấp bất thường; null = bình thường hoặc chưa đủ số. */
export function lowCodRatio(cod: string | null, goods: string | null): Decimal | null {
  if (cod === null || goods === null) return null;
  const g = new Decimal(goods);
  if (g.lte(0)) return null;
  const c = new Decimal(cod);
  return c.lessThan(g.mul(COD_LOW_RATIO)) ? c.div(g) : null;
}

/** Phần trăm làm tròn XUỐNG 1 lẻ — 29,96% không hiện thành "30%" (ngưỡng là < 30%). */
export function formatRatioPct(ratio: Decimal): string {
  return `${ratio.mul(100).toDecimalPlaces(1, Decimal.ROUND_DOWN).toString().replace('.', ',')}%`;
}
