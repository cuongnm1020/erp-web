'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Điều khiển một lượt in qua trình duyệt (không có agent máy in — PLAN-barcode-pick-pack
 * quyết định 3.2). Cách dùng: `const p = usePrint(); <PrintSheet open={p.open} onDone={p.done}>…`
 * rồi `p.print()`. `open` = đang mount tờ in; `PrintSheet` gọi `window.print()` sau khi
 * render xong và báo `onDone` khi hộp thoại in đóng (`afterprint`).
 *
 * Không animation, không chờ transition — kể cả khi người dùng bật prefers-reduced-motion
 * thì lượt in vẫn đi thẳng.
 */
export interface PrintController {
  open: boolean;
  print: () => void;
  done: () => void;
}

export function usePrint(): PrintController {
  const [open, setOpen] = useState(false);
  const print = useCallback(() => setOpen(true), []);
  const done = useCallback(() => setOpen(false), []);
  return { open, print, done };
}

/**
 * Gọi `window.print()` đúng một lần sau khi tờ in đã có trong DOM (rAF hai nhịp để SVG
 * mã vạch và font kịp layout), rồi báo `onDone` khi hộp thoại in đóng.
 * Trình duyệt không bắn `afterprint` (một số WebView) → vẫn gọi `onDone` ngay sau print()
 * vì `window.print()` là đồng bộ trên Chromium/Firefox desktop.
 */
export function useTriggerPrint(active: boolean, onDone: () => void): void {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const finish = () => {
          window.removeEventListener('afterprint', finish);
          doneRef.current();
        };
        window.addEventListener('afterprint', finish);
        window.print();
        // Chromium/Firefox chặn cho tới khi hộp thoại đóng → tới đây là đã xong.
        finish();
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [active]);
}
