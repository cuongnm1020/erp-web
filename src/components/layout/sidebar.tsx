'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { visibleModules, type NavItem, type NavModule } from '@/lib/navigation';
import { useAbility } from '@/lib/permission';

const COLLAPSE_KEY = 'erp.sidebar.collapsed';

function isActive(pathname: string, href: string): boolean {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Trạng thái thu gọn nhớ theo người dùng (localStorage — design/hide-sidebar.png: F5 không đổi).
 * Đọc sau mount để SSR và client render giống nhau (tránh lệch hydration); localStorage có thể
 * bị chặn → try/catch, mặc định mở rộng.
 */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // localStorage bị chặn — luôn mở rộng
    }
  }, []);
  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        // không lưu được thì thôi — chỉ mất ghi nhớ giữa các phiên
      }
      return !v;
    });
  return [collapsed, toggle];
}

/**
 * Sidebar theo module + quyền (luật 7: ẩn theo ability, API vẫn là nơi chặn).
 * Hai chế độ theo design canvas:
 * - Mở rộng (240px): module có children = NHÃN NHÓM + mục con phẳng; module không con = mục thường.
 * - Thu gọn (56px): chỉ icon, tên hiện ở tooltip bên phải, nhóm ngăn cách bằng vạch.
 * Phím `[` bật/tắt (không ăn khi đang gõ trong ô nhập).
 */
export function Sidebar({ brand = 'ERP' }: { brand?: string }) {
  const ability = useAbility();
  const pathname = usePathname();
  const modules = visibleModules((a, s) => ability.can(a, s));
  const [collapsed, toggle] = useCollapsed();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // toggle ổn định theo render này — effect chỉ cần gắn một lần
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      aria-label="Điều hướng chính"
      data-collapsed={collapsed || undefined}
      className={cn(
        'hidden shrink-0 flex-col border-r bg-muted/40 md:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b text-sm font-semibold',
          collapsed ? 'justify-center' : 'px-4',
        )}
      >
        <Link href="/" className={collapsed ? 'sr-only' : undefined}>
          {brand}
        </Link>
        {collapsed ? (
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground"
          >
            {brand.slice(0, 1)}
          </span>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {collapsed ? (
          <ul className="flex flex-col items-center gap-1">
            {modules.map((m, i) => (
              <Fragment key={m.href}>
                {i > 0 ? <li aria-hidden className="my-1 h-px w-6 bg-border" /> : null}
                {(m.children ?? [m]).map((item) => (
                  <CollapsedItem
                    key={item.href}
                    item={item}
                    icon={item.icon ?? m.icon}
                    pathname={pathname}
                  />
                ))}
              </Fragment>
            ))}
          </ul>
        ) : (
          <ul className="space-y-4">
            {modules.map((m) => (
              <ExpandedModule key={m.href} module={m} pathname={pathname} />
            ))}
          </ul>
        )}
      </nav>
      <div className={cn('border-t p-2', collapsed && 'flex justify-center')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className={cn(
                'flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed ? 'w-8 justify-center' : 'w-full',
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                  Thu gọn
                  <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">
                    [
                  </kbd>
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Mở rộng' : 'Thu gọn'} <kbd className="font-mono">[</kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

/** Mở rộng: module không con = mục thường; có con = nhãn nhóm + mục con phẳng (design 404.png). */
function ExpandedModule({ module: m, pathname }: { module: NavModule; pathname: string }) {
  if (!m.children || m.children.length === 0) {
    return (
      <li>
        <ExpandedItem item={m} icon={m.icon} pathname={pathname} />
      </li>
    );
  }
  return (
    <li>
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{m.label}</div>
      <ul className="space-y-0.5">
        {m.children.map((c) => (
          <li key={c.href}>
            <ExpandedItem item={c} icon={c.icon ?? m.icon} pathname={pathname} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function ExpandedItem({
  item,
  icon: Icon,
  pathname,
}: {
  item: NavItem;
  icon: NavModule['icon'];
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** Thu gọn: chỉ icon 32px, tên mục nằm trong tooltip bên phải (design hide-sidebar.png). */
function CollapsedItem({
  item,
  icon: Icon,
  pathname,
}: {
  item: NavItem;
  icon: NavModule['icon'];
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    </li>
  );
}
