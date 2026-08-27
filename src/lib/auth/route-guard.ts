/**
 * Quyết định chuyển hướng — thuần để test. Middleware chỉ kiểm tra SỰ TỒN TẠI cookie,
 * không verify JWT: apps/api là nơi quyết định; sai token → 401 → client refresh/đăng nhập lại.
 */
export type GuardDecision = { kind: 'ok' } | { kind: 'login'; next: string } | { kind: 'home' };

const PUBLIC_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/survey/', '/api/'];
const PUBLIC_EXACT = new Set(['/403', '/404', '/500']);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

export function decide(input: {
  pathname: string;
  search: string;
  hasAccess: boolean;
  hasRefresh: boolean;
}): GuardDecision {
  const authed = input.hasAccess || input.hasRefresh;
  const isLogin = input.pathname === '/login';
  if (isLogin && authed) return { kind: 'home' };
  if (isPublicPath(input.pathname)) return { kind: 'ok' };
  if (authed) return { kind: 'ok' };
  return { kind: 'login', next: `${input.pathname}${input.search}` };
}

/** Chỉ cho phép `next` nội bộ (tránh open redirect). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login'))
    return '/';
  return next;
}
