import { NextResponse } from 'next/server';
import { callApi, passthroughError, withAuthCookies } from '@/lib/auth/server';
import type { TokenPairLike } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

/** POST /api/auth/login → apps/api /auth/login → set cookie httpOnly. Token không trả về JS. */
export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  const upstream = await callApi('/auth/login', { method: 'POST', body });
  if (!upstream.ok) return passthroughError(upstream);
  const pair = (await upstream.json()) as TokenPairLike;
  return withAuthCookies(new NextResponse(null, { status: 204 }), pair);
}
