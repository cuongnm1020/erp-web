'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { SEGMENT_LABELS } from '@/lib/navigation';

export interface Crumb {
  label: string;
  href?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Suy breadcrumb từ đường dẫn; segment UUID → "Chi tiết" (màn hình override bằng `items`). */
export function crumbsFromPath(pathname: string): Crumb[] {
  const segs = pathname.split('/').filter(Boolean);
  const out: Crumb[] = [];
  let acc = '';
  for (const s of segs) {
    acc += `/${s}`;
    const label = UUID.test(s) ? 'Chi tiết' : (SEGMENT_LABELS[s] ?? s);
    out.push({ label, href: acc });
  }
  if (out.length) delete out[out.length - 1]!.href;
  return out;
}

export function Breadcrumb({ items }: { items?: Crumb[] }) {
  const pathname = usePathname();
  const crumbs = items ?? crumbsFromPath(pathname);
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
          {c.href ? (
            <Link href={c.href} className="hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-foreground">
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
