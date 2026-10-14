/**
 * Tiện ích cho tem vận đơn kiểu GHTK (2026-10-14) — thuần, không I/O, test được.
 *
 * Mã vận đơn GHTK có dạng `S23119447.BO.MN13-12-P52.1763110086`:
 *   - `S23119447`     mã shop trên GHTK ("Người gửi / S23119447")
 *   - `BO`, `MN13-12-P52`  mã cụm / mã phân loại của GHTK (không in)
 *   - `1763110086`    mã số ngắn — mã vạch CODE128 của tem mang đúng đoạn này
 */
export interface GhtkTracking {
  shopCode: string;
  shortCode: string;
}

const GHTK_TRACKING = /^(S\d+)\.[A-Z0-9]+\.[A-Z0-9-]+\.(\d{6,})$/i;

export function parseGhtkTracking(code: string | null | undefined): GhtkTracking | null {
  const m = code?.trim().match(GHTK_TRACKING);
  return m ? { shopCode: m[1]!, shortCode: m[2]! } : null;
}

/** `0339213208` → `033***3208` (như tem GHTK). Số quá ngắn → che hết. */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 8) return d ? '*'.repeat(d.length) : '';
  return `${d.slice(0, 3)}***${d.slice(-4)}`;
}

/** Che toàn bộ số điện thoại người nhận — tem GHTK in `***********`. */
export function hidePhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  return '*'.repeat(Math.max(d.length, 10) + 1);
}

/** Địa chỉ in trên tem: che số nhà / đường (`***`), giữ thôn → tỉnh. */
export function maskedAddress(street: string | null | undefined, locality: string): string {
  const rest = locality.trim();
  if (!street?.trim()) return rest;
  return rest ? `***, ${rest}` : '***';
}

/**
 * Ghi chú in: ghi chú của đơn + tuỳ chọn xem hàng / gọi shop đã gửi hãng — mỗi ý một dòng
 * (tem in với `white-space: pre-line`).
 */
export function printNote(data: {
  note: string | null;
  allowInspection: boolean | null;
  callShopOnFailure: boolean | null;
}): string | null {
  const parts = [
    data.note?.trim() || null,
    data.allowInspection === true
      ? 'Cho xem hàng'
      : data.allowInspection === false
        ? 'Không cho xem hàng'
        : null,
    data.callShopOnFailure ? 'Gọi shop khi không giao được' : null,
  ].filter((x): x is string => !!x);
  return parts.length ? parts.join('\n') : null;
}
