import { NextResponse } from 'next/server';
import { callApi, readAuthCookies, withClearedAuthCookies } from '@/lib/auth/server';

export const runtime = 'nodejs';

/** POST /api/auth/logout — thu hồi refresh token ở API (best effort) rồi xóa cookie. */
export async function POST(): Promise<NextResponse> {
  const { access, refresh } = await readAuthCookies();
  if (refresh) {
    try {
      await callApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
        accessToken: access,
      });
    } catch {
      // API không tới được vẫn phải xóa cookie phía web.
    }
  }
  return withClearedAuthCookies(new NextResponse(null, { status: 204 }));
}
