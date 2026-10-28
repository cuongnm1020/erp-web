import type { CSSProperties } from 'react';

/**
 * Tem vận đơn dựng ở kích thước ×LABEL_SCALE rồi `transform: scale(1/LABEL_SCALE)` về đúng khổ
 * (2026-10-14). Lý do: Chrome có cài đặt "cỡ chữ tối thiểu" (máy đóng gói thử đặt 12px) — chữ
 * 6,5–8pt (≈ 9–11px) bị kéo lên 12px, tem tràn, dòng hàng bị che. Cài đặt đó xét cỡ chữ TRƯỚC
 * transform, nên dựng ×2 (chữ nhỏ nhất 13pt ≈ 17px) thì in ra vẫn đúng cỡ thiết kế. CSS `zoom`
 * không qua được (đã thử). Mọi kích thước trong tem đi qua `u()` / `f()`.
 */
export const LABEL_SCALE = 2;

/** Kích thước thiết kế (mm trên tem thật) → kích thước dựng. */
export const u = (mm: number) => `${+(mm * LABEL_SCALE).toFixed(3)}mm`;

/** Cỡ chữ thiết kế (pt trên tem thật) → cỡ chữ dựng. */
export const f = (pt: number) => `${+(pt * LABEL_SCALE).toFixed(3)}pt`;

/** Khung ngoài: đúng khổ tem thật, cắt phần thừa. */
export const labelOuter = (widthMm: number, heightMm: number): CSSProperties => ({
  width: `${widthMm}mm`,
  height: `${heightMm}mm`,
});

/** Khung trong: dựng ×LABEL_SCALE rồi thu về góc trên trái. */
export const labelInner = (widthMm: number, heightMm: number): CSSProperties => ({
  width: u(widthMm),
  height: u(heightMm),
  transform: `scale(${1 / LABEL_SCALE})`,
  transformOrigin: '0 0',
  fontFamily: 'Arial, Helvetica, sans-serif',
});

/**
 * Lề bù thêm ở cạnh trên và cạnh phải tem vận đơn (mm, 2026-10-28): in thật trên máy HiLabel,
 * nội dung sát mép trên / mép phải hơn hẳn mép trái — user muốn hai cạnh này cách lề như cạnh
 * trái. Chỉnh số này sau khi in thử, không sửa từng tem.
 */
export const WAYBILL_EDGE = { top: 2, right: 2 } as const;
