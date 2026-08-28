import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { serverEnv } from '../env';
import { cookieNames } from './cookie-names';
import {
  buildAuthCookies,
  buildClearCookies,
  type CookieSpec,
  type TokenPairLike,
} from './cookies';

/** Đọc token từ cookie httpOnly — chỉ route handler / RSC. */
export async function readAuthCookies(): Promise<{ access?: string; refresh?: string }> {
  const env = serverEnv();
  const names = cookieNames(env.AUTH_COOKIE_PREFIX);
  const jar = await cookies();
  return { access: jar.get(names.access)?.value, refresh: jar.get(names.refresh)?.value };
}

function apply(res: NextResponse, specs: CookieSpec[]): NextResponse {
  for (const { name, value, ...o } of specs) res.cookies.set(name, value, o);
  return res;
}

export function withAuthCookies(res: NextResponse, pair: TokenPairLike): NextResponse {
  const env = serverEnv();
  return apply(res, buildAuthCookies(pair, { prefix: env.AUTH_COOKIE_PREFIX, secure: env.isProd }));
}

export function withClearedAuthCookies(res: NextResponse): NextResponse {
  const env = serverEnv();
  return apply(res, buildClearCookies({ prefix: env.AUTH_COOKIE_PREFIX, secure: env.isProd }));
}

/** Gọi thẳng apps/api từ route handler (không qua openapi-fetch để giữ nguyên envelope). */
export async function callApi(path: string, init: RequestInit & { accessToken?: string } = {}) {
  const env = serverEnv();
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-request-id', crypto.randomUUID());
  if (init.accessToken) headers.set('authorization', `Bearer ${init.accessToken}`);
  // redirect: 'manual' — API thật không bao giờ redirect; nếu apiUrl trỏ nhầm (vd vào chính
  // web app) thì nhận 3xx/!ok thay vì đi theo redirect tới trang HTML rồi vỡ JSON.parse.
  return fetch(`${env.apiUrl}${path}`, { ...init, headers, cache: 'no-store', redirect: 'manual' });
}

/** Đọc body JSON an toàn: upstream trả HTML/rác (apiUrl sai, API chết giữa chừng) → null, không throw. */
export async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** 502 chuẩn envelope khi upstream trả phản hồi không phải JSON. */
export function upstreamInvalid(): NextResponse {
  return NextResponse.json(
    {
      statusCode: 502,
      code: 'UPSTREAM_INVALID',
      message: 'API trả về phản hồi không hợp lệ — kiểm tra API đang chạy và API_URL',
    },
    { status: 502 },
  );
}

/** Chuyển tiếp nguyên envelope lỗi của API (status + body + x-request-id) về browser. */
export async function passthroughError(upstream: Response): Promise<NextResponse> {
  const body = await upstream.text();
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
  const trace = upstream.headers.get('x-request-id');
  if (trace) res.headers.set('x-request-id', trace);
  return res;
}
