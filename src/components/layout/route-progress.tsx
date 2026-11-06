'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingBar } from '@/components/ui/loading-bar';

/** Tự tắt nếu trang mới không về (lỗi mạng, link tải file…) để thanh không chạy mãi. */
const GIVE_UP_MS = 15_000;

/**
 * Thanh 2px dưới thanh trên khi bấm link sang màn KHÁC (mockup trạng thái tải 2026-11-06).
 * App Router không có sự kiện router → bắt click vào `<a>` cùng origin khác pathname, tắt khi
 * pathname đổi. Đổi query (lọc, phân trang) không bật thanh này — `QueryState` lo phần đó.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [active]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      setActive(true);
    };
    // capture: next/link gọi preventDefault rồi tự router.push → không dựa vào defaultPrevented.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Đang mở trang" aria-busy="true">
      <LoadingBar variant="route" className="-bottom-px top-auto" />
    </div>
  );
}
