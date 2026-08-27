import { NextResponse } from 'next/server';
import { buildDownstreamResponse, buildUpstreamRequest } from '@/lib/auth/proxy';
import { readAuthCookies } from '@/lib/auth/server';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Proxy /api/<path> → apps/api/<path>. Route cụ thể hơn (/api/auth/login|refresh|logout)
 * được Next ưu tiên trước catch-all này. Không đụng body JSON — chuyển tiếp nguyên vẹn,
 * kể cả envelope lỗi và header x-request-id (traceId).
 */
async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const { access } = await readAuthCookies();
  const url = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.arrayBuffer();
  const upstreamReq = buildUpstreamRequest({
    method: req.method,
    path,
    search: url.search,
    headers: req.headers,
    body,
    apiUrl: serverEnv().apiUrl,
    accessToken: access,
  });
  try {
    const upstream = await fetch(upstreamReq, { cache: 'no-store' });
    return buildDownstreamResponse(upstream);
  } catch {
    return NextResponse.json(
      { statusCode: 502, code: 'UPSTREAM_UNAVAILABLE', message: 'Không tới được API' },
      { status: 502, headers: { 'x-request-id': upstreamReq.headers.get('x-request-id') ?? '' } },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
