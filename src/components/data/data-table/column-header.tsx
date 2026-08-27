'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SortState } from '@/lib/url-state';

/** Tiêu đề cột có sort (server-side): bấm/Enter xoay none → asc → desc → none. aria-sort đặt ở <th> (DataTable). */
export function ariaSort(id: string, sort: SortState | null): 'ascending' | 'descending' | 'none' {
  if (sort?.id !== id) return 'none';
  return sort.desc ? 'descending' : 'ascending';
}

export function ColumnHeader({
  id,
  title,
  sortable,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  id: string;
  title: string;
  sortable?: boolean;
  sort: SortState | null;
  onSort?: (next: SortState | null) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  if (!sortable || !onSort) {
    return <span className={cn(align === 'right' && 'block text-right', className)}>{title}</span>;
  }
  const active = sort?.id === id;
  const dir = active ? (sort.desc ? 'desc' : 'asc') : null;
  const next = () =>
    onSort(dir === null ? { id, desc: false } : dir === 'asc' ? { id, desc: true } : null);
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Sắp xếp theo ${title}${dir === 'asc' ? ' (đang tăng dần)' : dir === 'desc' ? ' (đang giảm dần)' : ''}`}
      className={cn(
        '-ml-2 inline-flex h-8 items-center gap-1 rounded px-2 hover:bg-accent hover:text-accent-foreground',
        align === 'right' && 'ml-0 -mr-2 w-full justify-end',
        active && 'text-foreground',
        className,
      )}
    >
      {title}
      {dir === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      ) : dir === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
      )}
    </button>
  );
}
