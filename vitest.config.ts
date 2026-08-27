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
    css: false,
  },
});
