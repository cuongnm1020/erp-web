import { describe, expect, it } from 'vitest';
import { EnvError, parsePublicEnv, parseServerEnv } from './env';

describe('env', () => {
  it('thiếu NEXT_PUBLIC_API_URL → EnvError nêu rõ tên biến', () => {
    expect(() => parseServerEnv({})).toThrow(EnvError);
    try {
      parseServerEnv({});
    } catch (e) {
      expect((e as EnvError).issues.join('\n')).toContain('NEXT_PUBLIC_API_URL');
    }
  });

  it('URL sai định dạng → lỗi', () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_API_URL: 'localhost:3000' })).toThrow(EnvError);
  });

  it('API_URL thiếu → apiUrl rơi về NEXT_PUBLIC_API_URL', () => {
    const env = parseServerEnv({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' });
    expect(env.apiUrl).toBe('http://localhost:3000');
    expect(env.isProd).toBe(false);
    expect(env.AUTH_COOKIE_PREFIX).toBe('erp');
  });

  it('API_URL có → ưu tiên cho server', () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_API_URL: 'https://erp.example.com/api',
      API_URL: 'http://api.internal:3000',
      NODE_ENV: 'production',
    });
    expect(env.apiUrl).toBe('http://api.internal:3000');
    expect(env.isProd).toBe(true);
  });

  it('NODE_ENV lạ → lỗi', () => {
    expect(() =>
      parseServerEnv({ NEXT_PUBLIC_API_URL: 'http://localhost:3000', NODE_ENV: 'staging' }),
    ).toThrow(EnvError);
  });
});
