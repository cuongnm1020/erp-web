/** Tên cookie auth — thuần, không import next/headers, dùng được ở middleware và test. */
export function cookieNames(prefix: string): { access: string; refresh: string } {
  return { access: `${prefix}_at`, refresh: `${prefix}_rt` };
}
