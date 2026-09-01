'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Thẻ 404 trong shell (design/404.png): mã lỗi + đường dẫn, giải thích không lộ thông tin
 * ngoài scope, một lối về danh sách + tìm toàn cục. Bản ghi ngoài scope trả 404 chứ không
 * 403 — không để lộ là bản ghi tồn tại.
 */
export function NotFoundCard({
  title,
  path,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  path: string;
  description: string;
  backHref: string;
  backLabel: string;
  /** Khối "Có phải bạn tìm:" — chỉ đưa dữ liệu TRONG scope của người xem. */
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto mt-16 w-full max-w-xl rounded-lg border bg-card p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="font-mono text-xs text-muted-foreground">Mã lỗi 404 · {path}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{description}</p>
      {children}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
            )
          }
        >
          Tìm toàn cục
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </Button>
      </div>
    </div>
  );
}
