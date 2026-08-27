'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { visibleModules, type NavModule } from '@/lib/navigation';
import { useAbility } from '@/lib/permission';

function isActive(pathname: string, href: string): boolean {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Sidebar theo module + quyền (luật 7: ẩn theo ability, API vẫn là nơi chặn). */
export function Sidebar({ brand = 'ERP' }: { brand?: string }) {
  const ability = useAbility();
  const pathname = usePathname();
  const modules = visibleModules((a, s) => ability.can(a, s));

  return (
    <aside
      aria-label="Điều hướng chính"
      className="hidden w-60 shrink-0 flex-col border-r bg-muted/40 md:flex"
    >
      <div className="flex h-14 items-center border-b px-4 text-sm font-semibold">
        <Link href="/">{brand}</Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {modules.map((m) => (
            <SidebarModule key={m.href} module={m} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SidebarModule({ module: m, pathname }: { module: NavModule; pathname: string }) {
  const active = isActive(pathname, m.href);
  const Icon = m.icon;
  return (
    <li>
      <Link
        href={m.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
          active && 'bg-accent text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {m.label}
      </Link>
      {active && m.children && m.children.length > 1 ? (
        <ul className="ml-6 mt-1 space-y-0.5 border-l pl-2">
          {m.children.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className={cn(
                  'block rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground',
                  pathname === (c.href.split('?')[0] ?? c.href) && 'text-foreground',
                )}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
