/**
 * Chạy một lần khi server Next khởi động (Node runtime). Validate env ở đây để app
 * KHÔNG boot khi thiếu biến — thay vì chết ở request đầu tiên.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverEnv } = await import('./lib/env');
    serverEnv();
  }
}
