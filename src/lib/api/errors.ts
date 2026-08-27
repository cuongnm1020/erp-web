/**
 * Lỗi chuẩn hóa từ API (luật 6). Envelope backend: { statusCode, code, message, details? }.
 * traceId lấy từ header `x-request-id` (backend chưa đưa vào body — theo dõi ở PROGRESS.md).
 * `serverMessage` KHÔNG được render ra UI — dùng messageFor() ở lib/error-messages.ts.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    readonly serverMessage: string,
    readonly details: unknown,
    readonly traceId: string | undefined,
  ) {
    super(`[${status}] ${code}`);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  /** 422 theo luật, HOẶC 400 từ Nest ValidationPipe (backend chưa map sang 422). */
  get isValidation(): boolean {
    return this.status === 422 || (this.status === 400 && this.code === 'VALIDATION');
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

interface Envelope {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  error?: unknown;
  details?: unknown;
}

/** Mã khi mạng đứt / không tới được server (không có response). */
export const NETWORK_ERROR = 'NETWORK_ERROR';

/**
 * Dựng ApiError từ Response + body đã parse (hoặc undefined nếu body không phải JSON).
 * Nest ValidationPipe trả { statusCode: 400, message: string[], error: 'Bad Request' }
 * → code = 'VALIDATION', details = message[].
 */
export function toApiError(response: Response, body: unknown): ApiError {
  const traceId = response.headers.get('x-request-id') ?? undefined;
  const env: Envelope = body !== null && typeof body === 'object' ? (body as Envelope) : {};

  if (Array.isArray(env.message) && typeof env.code !== 'string') {
    return new ApiError(response.status, 'VALIDATION', 'Validation failed', env.message, traceId);
  }

  const code = typeof env.code === 'string' ? env.code : defaultCodeForStatus(response.status);
  const message =
    typeof env.message === 'string'
      ? env.message
      : typeof env.error === 'string'
        ? env.error
        : response.statusText;
  return new ApiError(response.status, code, message, env.details, traceId);
}

export function networkError(cause: unknown): ApiError {
  const msg = cause instanceof Error ? cause.message : String(cause);
  return new ApiError(0, NETWORK_ERROR, msg, undefined, undefined);
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST';
  }
}
