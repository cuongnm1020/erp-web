import { NextResponse } from 'next/server';
import type { TokenPairLike } from '@/lib/auth/cookies';
import {
  callApi,
  passthroughError,
  readAuthCookies,
  readJsonSafe,
  upstreamInvalid,
  withAdminRefreshCookie,
  withAuthCookies,
} from '@/lib/auth/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/impersonate {userId} — superadmin đăng nhập với tư cách người dùng (2026-10-19).
 * API kiểm quyền và trả cặp token của người đó; route này đặt cookie auth mới và CẤT refresh token
 * hiện tại của superadmin vào cookie httpOnly riêng để "Quay lại tài khoản của tôi". Token không
 * bao giờ tới JS (route cụ thể này đứng trước proxy /api/[...path]).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const { access, refresh, adminRefresh } = await readAuthCookies();
  const upstream = await callApi('/auth/impersonate', {
    method: 'POST',
    body: await req.text(),
    accessToken: access,
    from: req,
  });
  if (!upstream.ok) return passthroughError(upstream);
  const pair = await readJsonSafe<TokenPairLike>(upstream);
  if (!pair?.accessToken) return upstreamInvalid();
  // API không cho lồng — nhưng nếu đã có refresh cất sẵn thì giữ bản gốc của superadmin.
  const res = withAuthCookies(new NextResponse(null, { status: 204 }), pair);
  return withAdminRefreshCookie(res, adminRefresh ?? refresh ?? null);
}
