import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { ApiError, networkError, toApiError } from './errors';

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** Browser: '/api' (proxy Next giữ cookie httpOnly). Server: serverEnv().apiUrl. */
  baseUrl: string;
  fetch?: (input: Request) => Promise<Response>;
  /**
   * Làm mới phiên. Trả true nếu thành công. Mặc định (browser) gọi POST /api/auth/refresh.
   * undefined = không refresh (server-side).
   */
  refresh?: (() => Promise<boolean>) | undefined;
  /** Gọi khi refresh thất bại hoặc 401 lần hai. Mặc định: chuyển về /login?next=. */
  onUnauthorized?: () => void;
  /** Header gắn vào mọi request (server-side: Authorization). */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

const AUTH_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);
const RETRIED = 'x-erp-retried';

/**
 * Client API duy nhất (luật 3: hook ở features/<mod>/api gọi qua đây).
 * - x-request-id sinh mỗi request → traceId đối chiếu audit.
 * - 401 → refresh đúng MỘT lần dù N request song song (single-flight) → retry 1 lần.
 * - Lỗi HTTP → ApiError chuẩn hóa qua unwrap().
 * - Idempotency-Key: caller truyền `headers: idempotency(key)`; key sinh lúc bấm, không lúc render.
 */
export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetch ?? ((req: Request) => globalThis.fetch(req));
  const onUnauthorized = opts.onUnauthorized ?? defaultOnUnauthorized;

  let refreshing: Promise<boolean> | null = null;
  const refreshOnce = (): Promise<boolean> => {
    if (!opts.refresh) return Promise.resolve(false);
    refreshing ??= opts
      .refresh()
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  const clones = new WeakMap<Request, Request>();

  const middleware: Middleware = {
    async onRequest({ request }) {
      if (!request.headers.has('x-request-id')) {
        request.headers.set('x-request-id', crypto.randomUUID());
      }
      if (opts.headers) {
        for (const [k, v] of Object.entries(await opts.headers())) request.headers.set(k, v);
      }
      // Giữ bản sao để retry sau refresh (body của request gốc bị tiêu thụ khi fetch).
      clones.set(request, request.clone());
      return request;
    },
    async onResponse({ request, response, schemaPath }) {
      if (response.status !== 401 || AUTH_PATHS.has(schemaPath)) return response;
      if (request.headers.get(RETRIED) === '1') {
        onUnauthorized();
        return response;
      }
      const ok = await refreshOnce();
      if (!ok) {
        onUnauthorized();
        return response;
      }
      const clone = clones.get(request);
      if (!clone) return response;
      const retry = new Request(clone, { headers: new Headers(clone.headers) });
      retry.headers.set(RETRIED, '1');
      if (opts.headers) {
        for (const [k, v] of Object.entries(await opts.headers())) retry.headers.set(k, v);
      }
      const second = await fetchImpl(retry);
      if (second.status === 401) onUnauthorized();
      return second;
    },
  };

  const client = createClient<paths>({ baseUrl: opts.baseUrl, fetch: fetchImpl });
  client.use(middleware);
  return client;
}

function defaultOnUnauthorized(): void {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname.startsWith('/login')) return;
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

async function defaultBrowserRefresh(): Promise<boolean> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  return res.ok;
}

/** Header Idempotency-Key (luật 4). Gọi trong event handler với key đã sinh lúc bấm. */
export function idempotency(key: string): Record<string, string> {
  return { 'Idempotency-Key': key };
}

/** Sinh key lúc người dùng bấm. KHÔNG gọi trong render. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Biến { data, error, response } của openapi-fetch thành data-hoặc-throw ApiError,
 * để TanStack Query nhận lỗi chuẩn. Dùng: `unwrap(api.GET('/auth/me'))`.
 */
export async function unwrap<T>(p: Promise<FetchResult<T>>): Promise<T> {
  let r: FetchResult<T>;
  try {
    r = await p;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw networkError(e);
  }
  if (r.response.ok) return r.data as T;
  throw toApiError(r.response, r.error);
}

/** Client cho browser — mọi request đi qua proxy Next tại /api (cookie httpOnly, luật Auth). */
export const api: ApiClient = createApiClient({
  // Tuyệt đối theo origin hiện tại: browser giống '/api'; jsdom/MSW cần URL đầy đủ.
  baseUrl: typeof window === 'undefined' ? '/api' : `${window.location.origin}/api`,
  refresh: typeof window === 'undefined' ? undefined : defaultBrowserRefresh,
});
