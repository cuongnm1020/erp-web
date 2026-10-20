'use client';

import { useEffect, useRef } from 'react';

/**
 * Phím tắt cấp màn hình cho nút chính (design system: nút chính hiện phím tắt dạng kbd).
 * `combo`: "F2", "Ctrl+S", "Ctrl+Enter", "E"… — Ctrl khớp cả ⌘ trên macOS.
 * Phím chữ đơn (không Ctrl/Alt, không phải F-key) bị bỏ qua khi đang gõ trong ô nhập.
 * Có hộp thoại đang mở thì không kích hoạt (trừ khi `allowInDialog`).
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  { enabled = true, allowInDialog = false }: { enabled?: boolean; allowInDialog?: boolean } = {},
) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.split('+').map((p) => p.trim().toLowerCase());
    const key = parts[parts.length - 1]!;
    const ctrl = parts.includes('ctrl');
    const alt = parts.includes('alt');
    const shift = parts.includes('shift');
    const isFn = /^f\d{1,2}$/.test(key);

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.key.toLowerCase() !== key) return;
      if (ctrl !== (e.ctrlKey || e.metaKey) || alt !== e.altKey || shift !== e.shiftKey) return;
      if (!allowInDialog && document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      if (!ctrl && !alt && !isFn) {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      }
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, enabled, allowInDialog]);
}
