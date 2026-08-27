import { z } from 'zod';

/**
 * FE-0-02 — Biến môi trường validate bằng zod, fail-fast lúc boot.
 * Luật 1: KHÔNG có DATABASE_URL. Web chỉ biết URL của apps/api.
 *
 * - NEXT_PUBLIC_*: Next inline lúc build, đọc được ở cả browser lẫn server.
 * - API_URL: chỉ server (route handler / RSC) gọi api — ví dụ URL nội bộ trong ECS.
 *   Thiếu thì rơi về NEXT_PUBLIC_API_URL.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string({
      error: 'NEXT_PUBLIC_API_URL là bắt buộc (URL của apps/api, ví dụ http://localhost:3000)',
    })
    .url({ protocol: /^https?$/, error: 'NEXT_PUBLIC_API_URL phải là URL http(s) hợp lệ' }),
  NEXT_PUBLIC_SOCKET_URL: z
    .string()
    .url({ protocol: /^https?$/ })
    .optional(),
});

const serverSchema = publicSchema.extend({
  API_URL: z
    .string()
    .url({ protocol: /^https?$/, error: 'API_URL phải là URL http(s) hợp lệ' })
    .optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Tên cookie — đổi khi chạy nhiều portal cùng domain. */
  AUTH_COOKIE_PREFIX: z.string().min(1).default('erp'),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema> & { apiUrl: string; isProd: boolean };

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Biến môi trường không hợp lệ:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

function formatIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => {
    const key = i.path.join('.') || '(root)';
    return `${key}: ${i.message}`;
  });
}

/** Thuần — không đọc process.env, để test được. */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const r = serverSchema.safeParse(raw);
  if (!r.success) throw new EnvError(formatIssues(r.error));
  return {
    ...r.data,
    apiUrl: r.data.API_URL ?? r.data.NEXT_PUBLIC_API_URL,
    isProd: r.data.NODE_ENV === 'production',
  };
}

export function parsePublicEnv(raw: Record<string, string | undefined>): PublicEnv {
  const r = publicSchema.safeParse(raw);
  if (!r.success) throw new EnvError(formatIssues(r.error));
  return r.data;
}

/**
 * Biến public — an toàn import ở Client Component. Phải liệt kê từng key theo tên
 * để Next inline được (process.env[dynamic] không hoạt động ở browser).
 */
export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
});

let serverEnvCache: ServerEnv | undefined;

/** Chỉ gọi từ code server (route handler, RSC, middleware). Ném EnvError khi thiếu. */
export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() chỉ dùng ở server — browser dùng publicEnv');
  }
  serverEnvCache ??= parseServerEnv({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    API_URL: process.env.API_URL,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_COOKIE_PREFIX: process.env.AUTH_COOKIE_PREFIX,
  });
  return serverEnvCache;
}
