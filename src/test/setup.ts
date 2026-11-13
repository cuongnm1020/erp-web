import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { forgetSavedListStates } from '@/lib/list-state-memory';
import { forgetOrderDefaults } from '@/lib/order-defaults-memory';
import { server } from './msw/server';

// Node fetch không nhận URL tương đối ('/api/...') như browser → gắn origin của jsdom.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/')) {
    return nativeFetch(new URL(input, window.location.origin), init);
  }
  return nativeFetch(input, init);
}) as typeof fetch;

// jsdom không có scrollIntoView; Radix Select gọi nó trên item đang chọn khi mở → không stub
// thì passive effect ném lỗi và React unmount cả cây (test thấy <body> trống).
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom không có ResizeObserver; Radix Popper (DatePicker / Popover) đo kích thước bằng nó
// lúc mount → stub rỗng, kích thước không quan trọng trong test.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// MSW: request không có handler → lỗi rõ ràng thay vì treo/timeout.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  // Bộ lọc lần gần nhất của danh sách (lib/list-state-memory) không được rò sang test sau.
  if (typeof window !== 'undefined') forgetSavedListStates();
  // Giá trị điền sẵn của đơn trước (lib/order-defaults-memory) cũng vậy.
  if (typeof window !== 'undefined') forgetOrderDefaults();
});
afterAll(() => server.close());
