import { NextResponse } from 'next/server';
import type { TokenPairLike } from '@/lib/auth/cookies';
import {
  callApi,
  readAuthCookies,
  withAuthCookies,
  withClearedAuthCookies,
} from '@/lib/auth/server';

export const runtime = 'nodejs';

const UNAUTHORIZED = { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Phiên đã hết' };

/**
 * POST /api/auth/refresh — rotation: refresh token của API dùng MỘT lần.
 * Client gộp single-flight (lib/api/client.ts) nên không có hai request cùng token.
 * Thất bại → xóa cookie → 401; client về /login.
 */
export async function POST(): Promise<NextResponse> {
  const { refresh } = await readAuthCookies();
  if (!refresh) {
    return withClearedAuthCookies(NextResponse.json(UNAUTHORIZED, { status: 401 }));
  }
  const upstream = await callApi('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!upstream.ok) {
    return withClearedAuthCookies(NextResponse.json(UNAUTHORIZED, { status: 401 }));
  }
  const pair = (await upstream.json()) as TokenPairLike;
  return withAuthCookies(new NextResponse(null, { status: 204 }), pair);
}
