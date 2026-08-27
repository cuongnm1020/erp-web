import { describe, expect, it, vi } from 'vitest';
import { createApiClient, idempotency, unwrap } from './client';
import { ApiError, NETWORK_ERROR } from './errors';
import { extractFieldErrors } from './form-errors';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const ME = {
  userId: 'u1',
  code: 'admin',
  roles: ['ADMIN'],
  permissions: ['customer.read'],
  leaderTeamIds: [],
  hasGlobalAccess: true,
};

describe('api client', () => {
  it('/health type-safe qua client sinh sẵn, gắn x-request-id', async () => {
    const fetchMock = vi.fn(async (req: Request) => {
      expect(req.headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/);
      return json(200, { status: 'ok', db: 'ok', redis: 'ok', timestamp: 't' });
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });
    const health = await unwrap(api.GET('/health'));
    expect(health.status).toBe('ok');
    expect(health.db).toBe('ok');
  });

  it('5 request 401 song song → refresh đúng MỘT lần, rồi retry thành công', async () => {
    let authorized = false;
    const refresh = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      authorized = true;
      return true;
    });
    const fetchMock = vi.fn(async (req: Request) => {
      if (req.headers.get('x-erp-retried') === '1' || authorized) return json(200, ME);
      return json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'x' });
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, refresh });

    const results = await Promise.all(Array.from({ length: 5 }, () => unwrap(api.GET('/auth/me'))));
    expect(results.every((r) => r.code === 'admin')).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    // 5 lần đầu + 5 lần retry
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('refresh thất bại → onUnauthorized, ném ApiError 401', async () => {
    const onUnauthorized = vi.fn();
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'x' }),
      refresh: async () => false,
      onUnauthorized,
    });
    await expect(unwrap(api.GET('/auth/me'))).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 trên /auth/login KHÔNG refresh', async () => {
    const refresh = vi.fn(async () => true);
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => json(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' }),
      refresh,
      onUnauthorized: () => undefined,
    });
    await expect(
      unwrap(api.POST('/auth/login', { body: { username: 'a', password: 'b' } })),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('error envelope → ApiError có code/details/traceId từ header', async () => {
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () =>
        json(
          409,
          {
            statusCode: 409,
            code: 'UNIQUE_VIOLATION',
            message: 'Dữ liệu bị trùng',
            details: { target: ['phone'] },
          },
          { 'x-request-id': 'trace-123' },
        ),
    });
    const err = await unwrap(api.GET('/auth/me')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(409);
    expect(e.code).toBe('UNIQUE_VIOLATION');
    expect(e.traceId).toBe('trace-123');
    expect(e.details).toEqual({ target: ['phone'] });
    expect(e.isConflict).toBe(true);
  });

  it('Idempotency-Key giữ nguyên khi retry sau refresh', async () => {
    const keys: string[] = [];
    let first = true;
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (req) => {
        keys.push(req.headers.get('idempotency-key') ?? '');
        if (first) {
          first = false;
          return json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'x' });
        }
        return json(200, { accessToken: 'a', refreshToken: 'r', expiresIn: 1 });
      },
      refresh: async () => true,
    });
    // /auth/logout nằm trong AUTH_PATHS → dùng một path khác có body để test retry
    await unwrap(
      api.POST('/permissions', {
        body: { code: 'x.y', name: 'x' },
        headers: idempotency('key-1'),
      }),
    );
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('mạng đứt → ApiError NETWORK_ERROR', async () => {
    const api = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(unwrap(api.GET('/health'))).rejects.toMatchObject({
      code: NETWORK_ERROR,
      status: 0,
    });
  });
});

describe('extractFieldErrors', () => {
  it('details theo luật (path + message)', () => {
    const e = new ApiError(
      422,
      'VALIDATION',
      'x',
      [
        { path: 'phone', message: 'Sai định dạng' },
        { path: ['addresses', 0, 'line1'], message: 'Bắt buộc' },
      ],
      undefined,
    );
    expect(extractFieldErrors(e)).toEqual([
      { path: 'phone', message: 'Sai định dạng' },
      { path: 'addresses.0.line1', message: 'Bắt buộc' },
    ]);
  });

  it('Nest ValidationPipe 400 message[] → path theo token đầu', () => {
    const e = new ApiError(
      400,
      'VALIDATION',
      'x',
      ['phone must be a string', 'phone should not be empty', 'property foo should not exist'],
      undefined,
    );
    expect(extractFieldErrors(e).map((f) => f.path)).toEqual(['phone', 'foo']);
  });

  it('không phải validation → []', () => {
    expect(extractFieldErrors(new ApiError(409, 'CONFLICT', 'x', ['a b'], undefined))).toEqual([]);
  });
});
