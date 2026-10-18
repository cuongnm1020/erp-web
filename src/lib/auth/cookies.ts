import { cookieNames } from './cookie-names';

/**
 * Cookie auth (apps/web/CLAUDE.md mục Auth): httpOnly, Secure (prod), SameSite=Lax, path=/.
 * Token KHÔNG bao giờ tới JS — chỉ route handler đọc/ghi. File này thuần để test được;
 * phần dùng next/headers nằm ở route handler.
 */
export interface TokenPairLike {
  accessToken: string;
  refreshToken: string;
  /** giây */
  expiresIn: number;
}

export interface CookieSpec {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

/**
 * Refresh TTL mặc định khớp apps/api WEB_REFRESH_TTL (45 phút, phiên web — PDA mới giữ 7 ngày):
 * đóng trình duyệt quá mốc này thì cookie cũng hết, mở lại vào thẳng /login.
 */
export const DEFAULT_REFRESH_TTL_SECONDS = 45 * 60;

export function buildAuthCookies(
  pair: TokenPairLike,
  opts: { prefix: string; secure: boolean; refreshTtlSeconds?: number },
): [CookieSpec, CookieSpec] {
  const names = cookieNames(opts.prefix);
  const base = {
    httpOnly: true as const,
    secure: opts.secure,
    sameSite: 'lax' as const,
    path: '/' as const,
  };
  return [
    { ...base, name: names.access, value: pair.accessToken, maxAge: pair.expiresIn },
    {
      ...base,
      name: names.refresh,
      value: pair.refreshToken,
      maxAge: opts.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS,
    },
  ];
}

export function buildClearCookies(opts: {
  prefix: string;
  secure: boolean;
}): [CookieSpec, CookieSpec] {
  const names = cookieNames(opts.prefix);
  const base = {
    httpOnly: true as const,
    secure: opts.secure,
    sameSite: 'lax' as const,
    path: '/' as const,
  };
  return [
    { ...base, name: names.access, value: '', maxAge: 0 },
    { ...base, name: names.refresh, value: '', maxAge: 0 },
  ];
}
