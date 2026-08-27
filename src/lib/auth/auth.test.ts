import { describe, expect, it } from 'vitest';
import { buildAuthCookies, buildClearCookies, DEFAULT_REFRESH_TTL_SECONDS } from './cookies';
import { buildDownstreamResponse, buildUpstreamRequest } from './proxy';
import { decide, isPublicPath, safeNext } from './route-guard';

describe('auth cookies', () => {
  it('httpOnly + SameSite=Lax + path=/ ; Secure theo môi trường; maxAge theo expiresIn', () => {
    const [at, rt] = buildAuthCookies(
      { accessToken: 'A', refreshToken: 'R', expiresIn: 900 },
      { prefix: 'erp', secure: true },
    );
    expect(at).toMatchObject({
      name: 'erp_at',
      value: 'A',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });
    expect(rt).toMatchObject({
      name: 'erp_rt',
      value: 'R',
      httpOnly: true,
      maxAge: DEFAULT_REFRESH_TTL_SECONDS,
    });
  });

  it('dev → secure=false (localhost http)', () => {
    const [at] = buildAuthCookies(
      { accessToken: 'A', refreshToken: 'R', expiresIn: 1 },
      { prefix: 'erp', secure: false },
    );
    expect(at.secure).toBe(false);
  });

  it('clear → maxAge 0, value rỗng', () => {
    const specs = buildClearCookies({ prefix: 'x', secure: true });
    expect(specs.map((s) => [s.name, s.value, s.maxAge])).toEqual([
      ['x_at', '', 0],
      ['x_rt', '', 0],
    ]);
  });
});

describe('proxy', () => {
  it('chuyển tiếp path/query/header cho phép, gắn Bearer, bỏ cookie', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'idempotency-key': 'k1',
      'x-request-id': 'rid',
      cookie: 'erp_at=secret',
      authorization: 'Bearer forged',
    });
    const req = buildUpstreamRequest({
      method: 'POST',
      path: ['customers', 'a b'],
      search: '?take=10&q=x',
      headers,
      body: new TextEncoder().encode('{"a":1}').buffer as ArrayBuffer,
      apiUrl: 'http://api.internal:3000/',
      accessToken: 'TOKEN',
    });
    expect(req.url).toBe('http://api.internal:3000/customers/a%20b?take=10&q=x');
    expect(req.method).toBe('POST');
    expect(req.headers.get('authorization')).toBe('Bearer TOKEN');
    expect(req.headers.get('idempotency-key')).toBe('k1');
    expect(req.headers.get('x-request-id')).toBe('rid');
    expect(req.headers.get('cookie')).toBeNull();
  });

  it('không có token → không có Authorization; GET không body; tự sinh x-request-id', () => {
    const req = buildUpstreamRequest({
      method: 'GET',
      path: ['health'],
      search: '',
      headers: new Headers(),
      body: null,
      apiUrl: 'http://api',
      accessToken: undefined,
    });
    expect(req.headers.has('authorization')).toBe(false);
    expect(req.headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/);
  });

  it('response: giữ status, content-type, x-request-id; ép no-store', async () => {
    const up = new Response('{"code":"X"}', {
      status: 409,
      headers: { 'content-type': 'application/json', 'x-request-id': 't1', 'set-cookie': 'a=b' },
    });
    const down = buildDownstreamResponse(up);
    expect(down.status).toBe(409);
    expect(down.headers.get('x-request-id')).toBe('t1');
    expect(down.headers.get('set-cookie')).toBeNull();
    expect(down.headers.get('cache-control')).toBe('no-store');
    expect(await down.text()).toBe('{"code":"X"}');
  });
});

describe('route guard', () => {
  const cases: Array<[string, boolean, boolean, string]> = [
    ['/crm/customers', false, false, 'login'],
    ['/crm/customers', true, false, 'ok'],
    ['/crm/customers', false, true, 'ok'], // access hết hạn, còn refresh → client tự refresh
    ['/login', false, false, 'ok'],
    ['/login', true, false, 'home'],
    ['/403', false, false, 'ok'],
    ['/survey/abc', false, false, 'ok'],
    ['/', false, false, 'login'],
  ];
  it.each(cases)('%s access=%s refresh=%s → %s', (pathname, hasAccess, hasRefresh, kind) => {
    expect(decide({ pathname, search: '', hasAccess, hasRefresh }).kind).toBe(kind);
  });

  it('giữ next kèm query', () => {
    const d = decide({
      pathname: '/crm/orders',
      search: '?scope=mine',
      hasAccess: false,
      hasRefresh: false,
    });
    expect(d).toEqual({ kind: 'login', next: '/crm/orders?scope=mine' });
  });

  it('isPublicPath', () => {
    expect(isPublicPath('/api/auth/login')).toBe(true);
    expect(isPublicPath('/crm')).toBe(false);
  });

  it('safeNext chặn open redirect và loop /login', () => {
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('/login?next=/x')).toBe('/');
    expect(safeNext('/crm/customers?x=1')).toBe('/crm/customers?x=1');
    expect(safeNext(null)).toBe('/');
  });
});
