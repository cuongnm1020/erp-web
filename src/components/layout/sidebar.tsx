'use client';

import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { visibleModules, type NavItem, type NavModule, type NavTone } from '@/lib/navigation';
import { useAbility } from '@/lib/permission';

const COLLAPSE_KEY = 'erp.sidebar.collapsed';
/** Nhóm người dùng đã đóng (href module) — mặc định mọi nhóm mở. */
const CLOSED_KEY = 'erp.sidebar.closed-groups';

/**
 * Màu module (token --mod-*). Viết nguyên class — Tailwind chỉ sinh class thấy được trong mã nguồn.
 * `text` = nhãn nhóm khi mở + mục đang chọn, `tile` = ô icon, `line` = đường dọc dưới nhóm.
 */
const TONE: Record<NavTone, { text: string; tile: string; line: string; active: string }> = {
  sales: {
    text: 'text-mod-sales',
    tile: 'bg-mod-sales-weak text-mod-sales',
    line: 'border-mod-sales-line',
    active: 'bg-mod-sales-weak text-mod-sales',
  },
  cust: {
    text: 'text-mod-cust',
    tile: 'bg-mod-cust-weak text-mod-cust',
    line: 'border-mod-cust-line',
    active: 'bg-mod-cust-weak text-mod-cust',
  },
  prod: {
    text: 'text-mod-prod',
    tile: 'bg-mod-prod-weak text-mod-prod',
    line: 'border-mod-prod-line',
    active: 'bg-mod-prod-weak text-mod-prod',
  },
  wh: {
    text: 'text-mod-wh',
    tile: 'bg-mod-wh-weak text-mod-wh',
    line: 'border-mod-wh-line',
    active: 'bg-mod-wh-weak text-mod-wh',
  },
  rpt: {
    text: 'text-mod-rpt',
    tile: 'bg-mod-rpt-weak text-mod-rpt',
    line: 'border-mod-rpt-line',
    active: 'bg-mod-rpt-weak text-mod-rpt',
  },
  adm: {
    text: 'text-mod-adm',
    tile: 'bg-mod-adm-weak text-mod-adm',
    line: 'border-mod-adm-line',
    active: 'bg-mod-adm-weak text-mod-adm',
  },
};

function isActive(pathname: string, href: string): boolean {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Mục đang mở của module — chọn href dài nhất khớp (Đơn hàng vs Tạo đơn cùng tiền tố). */
function activeHref(items: NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const it of items) {
    if (isActive(pathname, it.href) && (!best || it.href.length > best.length)) best = it.href;
  }
  return best;
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

/** Nhóm đã đóng, nhớ theo người dùng — cùng cách đọc sau mount như useCollapsed. */
function useClosedGroups(): [Set<string>, (href: string) => void] {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLOSED_KEY);
      const arr: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setClosed(new Set(arr.filter((x) => typeof x === 'string')));
    } catch {
      // dữ liệu hỏng / bị chặn — mọi nhóm mở
    }
  }, []);
  const toggle = (href: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      try {
        localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
      } catch {
        // không lưu được thì thôi
      }
      return next;
    });
  return [closed, toggle];
}

/**
 * Sidebar theo module + quyền (luật 7: ẩn theo ability, API vẫn là nơi chặn). Redesign 2026-10-17:
 * nền sáng, mỗi module một màu (ô icon nhạt, nhãn đổi màu khi nhóm mở, đường dọc dưới nhóm).
 * - Mở rộng (240px): module có con = nhóm mở/đóng được (nhớ theo người dùng), mục con có icon,
 *   chia nhóm con theo `section`; module không con = mục thường.
 * - Thu gọn (60px): chỉ còn ô icon màu; bấm ô mở danh sách mục con ở bên phải.
 * - Dưới 768px: ngăn kéo (`mobileOpen`), mở bằng nút ☰ ở thanh trên, luôn ở dạng mở rộng.
 * Phím `[` bật/tắt thu gọn (không ăn khi đang gõ trong ô nhập).
 */
export function Sidebar({
  brand = 'Thiên Nông',
  subtitle = 'ERP nội bộ',
  mobileOpen = false,
  onMobileClose,
}: {
  brand?: string;
  subtitle?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const ability = useAbility();
  const pathname = usePathname();
  const modules = visibleModules((a, s) => ability.can(a, s));
  const [collapsedPref, toggle] = useCollapsed();
  const [closed, toggleGroup] = useClosedGroups();
  // Ngăn kéo mobile luôn mở rộng — thu gọn chỉ có nghĩa trên màn rộng.
  const collapsed = collapsedPref && !mobileOpen;

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

  // Đổi trang hoặc Esc → đóng ngăn kéo mobile.
  useEffect(() => {
    onMobileClose?.();
    // chỉ theo đường dẫn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {mobileOpen ? (
        <div
          aria-hidden
          className="fixed inset-0 z-50 bg-foreground/40 md:hidden"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        aria-label="Điều hướng chính"
        data-collapsed={collapsed || undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-sidebar shrink-0 flex-col border-r bg-card shadow-lg',
          'md:sticky md:top-0 md:z-auto md:flex md:h-screen md:shadow-none',
          mobileOpen ? 'flex' : 'hidden',
          collapsed && 'md:w-sidebar-collapsed',
        )}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center gap-2.5 border-b',
            collapsed ? 'justify-center' : 'px-3.5',
          )}
        >
          <Link
            href="/"
            aria-label={collapsed ? brand : undefined}
            className="flex min-w-0 items-center gap-2.5 rounded-md"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            >
              {initials(brand)}
            </span>
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold leading-4">{brand}</span>
                <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
              </span>
            )}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-2">
          <ul className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-1')}>
            {modules.map((m) =>
              collapsed ? (
                <CollapsedModule key={m.href} module={m} pathname={pathname} />
              ) : (
                <ExpandedModule
                  key={m.href}
                  module={m}
                  pathname={pathname}
                  open={!closed.has(m.href)}
                  onToggle={() => toggleGroup(m.href)}
                />
              ),
            )}
          </ul>
        </nav>
        <div
          className={cn('hidden border-t p-2 md:block', collapsed && 'md:flex md:justify-center')}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggle}
                aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed ? 'w-8 justify-center' : 'w-full',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4" aria-hidden />
                    Thu gọn
                    <kbd className="ml-auto rounded border px-1 font-mono text-xs leading-4">[</kbd>
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
    </>
  );
}

/** "Thiên Nông" → "TN"; một từ → 1 chữ cái. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Ô icon 32px của module — luôn có màu nhạt theo module; module không con dùng màu brand. */
function Tile({ module: m, className }: { module: NavModule; className?: string }) {
  const Icon = m.icon;
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
        m.tone ? TONE[m.tone].tile : 'text-primary',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Thanh màu ở mép trái cho mục / ô đang chọn. */
const ACTIVE_BAR =
  'relative before:absolute before:-left-2 before:bottom-2 before:top-2 before:w-1 before:rounded-r before:bg-current';

function ExpandedModule({
  module: m,
  pathname,
  open,
  onToggle,
}: {
  module: NavModule;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (!m.children || m.children.length === 0) {
    const active = isActive(pathname, m.href) && (m.href !== '/' || pathname === '/');
    return (
      <li className="mb-1">
        <Link
          href={m.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-10 items-center gap-3 rounded-md px-2 py-1 text-base font-semibold hover:bg-muted',
            active && cn('bg-accent text-primary hover:bg-accent', ACTIVE_BAR),
          )}
        >
          <Tile module={m} />
          <span className="truncate">{m.label}</span>
        </Link>
      </li>
    );
  }
  const tone = m.tone ? TONE[m.tone] : null;
  const current = activeHref(m.children, pathname);
  const listId = `nav-${m.href.replace(/\W+/g, '-')}`;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          'flex min-h-10 w-full items-center gap-3 rounded-md px-2 py-1 text-left text-base font-semibold hover:bg-muted',
          open && tone?.text,
        )}
      >
        <Tile module={m} />
        <span className="min-w-0 flex-1 truncate">{m.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul id={listId} className={cn('mb-2 ml-6 mt-0.5 border-l-2 pl-3', tone?.line)}>
          {m.children.map((c, i) => {
            const prev = m.children?.[i - 1];
            const showSection = c.section && c.section !== prev?.section;
            return (
              <Fragment key={c.href}>
                {showSection ? (
                  <li
                    className={cn(
                      'px-2 pb-0.5 text-sm font-semibold',
                      i === 0 ? 'pt-1' : 'pt-2',
                      tone?.text,
                    )}
                  >
                    {c.section}
                  </li>
                ) : null}
                <li>
                  <ExpandedItem
                    item={c}
                    icon={c.icon ?? m.icon}
                    active={c.href === current}
                    activeClass={tone?.active ?? 'bg-accent text-accent-foreground'}
                  />
                </li>
              </Fragment>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function ExpandedItem({
  item,
  icon: Icon,
  active,
  activeClass,
}: {
  item: NavItem;
  icon: NavModule['icon'];
  active: boolean;
  activeClass: string;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-8 items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-muted',
        active && cn('font-semibold hover:bg-transparent', activeClass),
      )}
    >
      <Icon
        aria-hidden
        className={cn('h-4 w-4 shrink-0', active ? 'text-current' : 'text-muted-foreground')}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Thu gọn: một ô icon màu cho mỗi module (design canvas redesign 2026-10-17). Module không con =
 * link; có con = nút mở danh sách mục con bên phải (vẫn tới mọi màn trong 2 lần bấm).
 */
function CollapsedModule({ module: m, pathname }: { module: NavModule; pathname: string }) {
  if (!m.children || m.children.length === 0) {
    const active = isActive(pathname, m.href) && (m.href !== '/' || pathname === '/');
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={m.href}
              aria-label={m.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex rounded-md text-primary hover:bg-muted',
                active && cn('bg-accent', ACTIVE_BAR),
              )}
            >
              <Tile module={m} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{m.label}</TooltipContent>
        </Tooltip>
      </li>
    );
  }
  const tone = m.tone ? TONE[m.tone] : null;
  const current = activeHref(m.children, pathname);
  return (
    <li>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={m.label}
                className={cn(
                  'flex rounded-md hover:opacity-90',
                  current && cn(tone?.text, ACTIVE_BAR),
                )}
              >
                <Tile module={m} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{m.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" className="w-60">
          <DropdownMenuLabel className={cn('text-sm', tone?.text)}>{m.label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {m.children.map((c, i) => {
            const Icon = c.icon ?? m.icon;
            const showSection = c.section && c.section !== m.children?.[i - 1]?.section;
            return (
              <Fragment key={c.href}>
                {showSection ? (
                  <DropdownMenuLabel className="pb-0.5 text-xs font-semibold text-muted-foreground">
                    {c.section}
                  </DropdownMenuLabel>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link
                    href={c.href}
                    aria-current={c.href === current ? 'page' : undefined}
                    className={cn(c.href === current && cn('font-semibold', tone?.active))}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {c.label}
                  </Link>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
