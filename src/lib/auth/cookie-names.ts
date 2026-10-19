/** Tên cookie auth — thuần, không import next/headers, dùng được ở middleware và test. */
export function cookieNames(prefix: string): {
  access: string;
  refresh: string;
  /** Refresh token của superadmin, cất khi đang "đăng nhập với tư cách" người khác (2026-10-19). */
  adminRefresh: string;
} {
  return { access: `${prefix}_at`, refresh: `${prefix}_rt`, adminRefresh: `${prefix}_art` };
}
