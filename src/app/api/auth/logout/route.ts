import { NextResponse } from 'next/server';
import {
  callApi,
  readAuthCookies,
  withAdminRefreshCookie,
  withClearedAuthCookies,
} from '@/lib/auth/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/logout — thu hồi refresh token ở API (best effort) rồi xóa cookie. Đang đăng nhập
 * thay thì thu hồi luôn refresh đã cất của superadmin (đăng xuất là thoát hẳn).
 */
export async function POST(): Promise<NextResponse> {
  const { access, refresh, adminRefresh } = await readAuthCookies();
  for (const token of [refresh, adminRefresh]) {
    if (!token) continue;
    try {
      await callApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: token }),
        accessToken: access,
      });
    } catch {
      // API không tới được vẫn phải xóa cookie phía web.
    }
  }
  return withAdminRefreshCookie(
    withClearedAuthCookies(new NextResponse(null, { status: 204 })),
    null,
  );
}
