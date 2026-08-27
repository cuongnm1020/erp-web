import 'server-only';
import { cookies } from 'next/headers';
import { cookieNames } from '../auth/cookie-names';
import { serverEnv } from '../env';
import { createApiClient, type ApiClient } from './client';

/**
 * Client cho Server Component / route handler: gọi thẳng apps/api (serverEnv().apiUrl),
 * Bearer lấy từ cookie httpOnly. Không refresh ở đây — RSC gặp 401 thì middleware đã
 * đẩy về /login; nếu vẫn tới đây, trả lỗi để error.tsx hiển thị.
 * Luật 14: màn hình lấy dữ liệu từ MỘT nơi — dùng cho layout/shell/danh mục tĩnh.
 */
export async function serverApi(): Promise<ApiClient> {
  const env = serverEnv();
  const jar = await cookies();
  const token = jar.get(cookieNames(env.AUTH_COOKIE_PREFIX).access)?.value;
  return createApiClient({
    baseUrl: env.apiUrl,
    refresh: undefined,
    onUnauthorized: () => undefined,
    headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
  });
}
