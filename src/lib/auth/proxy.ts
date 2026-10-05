/**
 * Proxy thuần (không import next/*) — route handler /api/[...path] gọi hàm này.
 * Browser → /api/<path> → apps/api/<path> với Bearer từ cookie httpOnly.
 */
const FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'idempotency-key',
  'x-request-id',
  'if-none-match',
] as const;

/**
 * Route công khai của apps/api (`/public/*`, vd hủy nhận tin CRM-12): API đếm rate limit theo
 * phần tử đầu `X-Forwarded-For` và lưu User-Agent làm bằng chứng — phải chuyển tiếp của người
 * truy cập, nếu không mọi khách dùng chung IP của server web. Caddy phía trước web đã ghi đè XFF
 * bằng IP thật (không tin XFF từ client). Không gắn Bearer: trang công khai không mang phiên.
 */
const PUBLIC_EXTRA_HEADERS = ['x-forwarded-for', 'user-agent'] as const;

export function isPublicApiPath(path: readonly string[]): boolean {
  return path[0] === 'public';
}

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'x-request-id',
  'etag',
  'cache-control',
  'content-disposition',
] as const;

export interface ProxyInput {
  method: string;
  /** Segment sau /api, ví dụ ['customers', 'abc'] */
  path: string[];
  search: string;
  headers: Headers;
  body: ArrayBuffer | null;
  apiUrl: string;
  accessToken: string | undefined;
}

export function buildUpstreamRequest(input: ProxyInput): Request {
  const url = `${input.apiUrl.replace(/\/$/, '')}/${input.path.map(encodeURIComponent).join('/')}${input.search}`;
  const headers = new Headers();
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = input.headers.get(h);
    if (v) headers.set(h, v);
  }
  const isPublic = isPublicApiPath(input.path);
  if (isPublic) {
    for (const h of PUBLIC_EXTRA_HEADERS) {
      const v = input.headers.get(h);
      if (v) headers.set(h, v);
    }
  }
  if (!headers.has('x-request-id')) headers.set('x-request-id', crypto.randomUUID());
  if (input.accessToken && !isPublic) headers.set('authorization', `Bearer ${input.accessToken}`);
  const hasBody = input.body !== null && input.method !== 'GET' && input.method !== 'HEAD';
  return new Request(url, {
    method: input.method,
    headers,
    body: hasBody ? input.body : undefined,
    redirect: 'manual',
  });
}

export function buildDownstreamResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Không cache response qua proxy (dữ liệu theo scope người dùng).
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
