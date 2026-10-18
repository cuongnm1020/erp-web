/**
 * Tự đăng xuất khi không thao tác (AUTH-IDLE). Mốc "thao tác cuối" lưu localStorage để mọi tab
 * dùng chung: làm việc ở tab này thì tab kia không đá ra. Chỉ là một mốc thời gian, không phải token.
 * Chốt chặn phía server: apps/api WEB_REFRESH_TTL (45m) — cookie refresh cùng thời hạn.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_STORAGE_KEY = 'erp:last-activity';
/** Lý do trên URL /login?reason= để màn đăng nhập giải thích. */
export const IDLE_LOGOUT_REASON = 'idle';

/** Thuần — để test. `last` null = chưa có mốc (lần đầu) → chưa hết. */
export function isIdleExpired(
  last: number | null,
  now: number,
  timeoutMs = IDLE_TIMEOUT_MS,
): boolean {
  return last !== null && now - last >= timeoutMs;
}

export function readLastActivity(): number | null {
  try {
    const v = Number(window.localStorage.getItem(IDLE_STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeLastActivity(at = Date.now()): void {
  try {
    window.localStorage.setItem(IDLE_STORAGE_KEY, String(at));
  } catch {
    // Trình duyệt chặn storage: bộ đếm trong bộ nhớ của tab vẫn chạy.
  }
}

export function clearLastActivity(): void {
  try {
    window.localStorage.removeItem(IDLE_STORAGE_KEY);
  } catch {
    // như trên
  }
}
