'use client';

import { useEffect, useRef } from 'react';
import {
  IDLE_TIMEOUT_MS,
  isIdleExpired,
  readLastActivity,
  writeLastActivity,
} from '@/lib/auth/idle';

/** Thao tác của người dùng (máy quét barcode gõ phím → keydown). Polling nền không tính. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
/** Ghi mốc tối đa mỗi 5 giây — pointermove bắn liên tục. */
const WRITE_THROTTLE_MS = 5_000;
const CHECK_INTERVAL_MS = 15_000;

/**
 * Gọi `onIdle` một lần khi không thao tác đủ `timeoutMs` (mặc định 30 phút) trên mọi tab.
 * Máy ngủ thì timer đứng: lúc thức dậy, tab hiện lại (visibilitychange/focus) hoặc thao tác đầu
 * tiên đều kiểm tra mốc TRƯỚC khi ghi mốc mới — nên mở máy sau 30 phút là bị đăng xuất ngay.
 */
export function useIdleLogout(onIdle: () => void, timeoutMs = IDLE_TIMEOUT_MS): void {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    // Bộ nhớ của tab: dùng khi trình duyệt chặn localStorage.
    let memLast = readLastActivity() ?? Date.now();
    let fired = false;

    const check = (): boolean => {
      if (fired) return true;
      const last = Math.max(readLastActivity() ?? 0, memLast);
      if (!isIdleExpired(last, Date.now(), timeoutMs)) return false;
      fired = true;
      onIdleRef.current();
      return true;
    };

    const onActivity = () => {
      if (check()) return;
      const now = Date.now();
      if (now - memLast < WRITE_THROTTLE_MS) return;
      memLast = now;
      writeLastActivity(now);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    if (!check() && readLastActivity() === null) writeLastActivity(memLast);

    const opts = { passive: true, capture: true } as const;
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, opts);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity, opts);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [timeoutMs]);
}
