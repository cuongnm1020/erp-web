import { NextResponse, type NextRequest } from 'next/server';
import { cookieNames } from '@/lib/auth/cookie-names';
import { decide } from '@/lib/auth/route-guard';

/**
 * Bảo vệ route theo cookie (FE-0-04). Edge runtime → không import lib/env (process.env đủ dùng).
 * /api/* không qua đây: proxy tự trả 401 từ apps/api.
 */
export function middleware(req: NextRequest): NextResponse {
  const names = cookieNames(process.env.AUTH_COOKIE_PREFIX ?? 'erp');
  const d = decide({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    hasAccess: req.cookies.has(names.access),
    hasRefresh: req.cookies.has(names.refresh),
  });
  if (d.kind === 'login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(d.next)}`;
    return NextResponse.redirect(url);
  }
  if (d.kind === 'home') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)'],
};
