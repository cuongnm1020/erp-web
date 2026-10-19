import { NextResponse } from 'next/server';
import type { TokenPairLike } from '@/lib/auth/cookies';
import {
  callApi,
  readAuthCookies,
  readJsonSafe,
  withAdminRefreshCookie,
  withAuthCookies,
  withClearedAuthCookies,
} from '@/lib/auth/server';

export const runtime = 'nodejs';

const UNAUTHORIZED = { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Phiên đã hết' };

/**
 * POST /api/auth/impersonate/stop — thôi đăng nhập thay, quay về tài khoản superadmin: thu hồi
 * refresh của phiên đăng nhập thay ở API (best effort), đổi refresh đã cất lấy cặp token mới của
 * superadmin. Refresh đã cất hết hạn (quá 45 phút) → xoá hết cookie → 401, client về /login.
 */
export async function POST(): Promise<NextResponse> {
  const { access, refresh, adminRefresh } = await readAuthCookies();
  if (refresh) {
    try {
      await callApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
        accessToken: access,
      });
    } catch {
      // Không tới được API vẫn phải quay về tài khoản cũ.
    }
  }
  const fail = () =>
    withAdminRefreshCookie(
      withClearedAuthCookies(NextResponse.json(UNAUTHORIZED, { status: 401 })),
      null,
    );
  if (!adminRefresh) return fail();
  const upstream = await callApi('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: adminRefresh }),
  });
  if (!upstream.ok) return fail();
  const pair = await readJsonSafe<TokenPairLike>(upstream);
  if (!pair?.accessToken) return fail();
  return withAdminRefreshCookie(
    withAuthCookies(new NextResponse(null, { status: 204 }), pair),
    null,
  );
}
