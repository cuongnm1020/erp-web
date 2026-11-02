import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3100' } },
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // env.ts fail-fast lúc import — test cần bộ biến hợp lệ cố định, không đọc .env.local
    env: {
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NODE_ENV: 'test',
    },
    include: ['src/**/*.test.{ts,tsx}'],
    // Màn nhiều bước (chọn nhiều → hộp thoại → gửi) chạy 3–5 s khi cả bộ chạy song song ngay ở máy
    // dev; runner CI chậm hơn ~9× nên mặc định 5 s đỏ ngẫu nhiên (2026-11-02: order-list "Gán hãng /
    // cân nặng" — máy dev 970 ms chạy riêng). Hạn chung 20 s; test chờ lâu hơn tự đặt riêng.
    testTimeout: 20_000,
    css: false,
  },
});
