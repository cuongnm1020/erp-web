import type { ReactNode } from 'react';

/**
 * Một cột trên màn chờ của các màn quét (pick / cất hàng / đóng gói): tiêu đề + đếm + danh
 * sách chạm được. Bốn trạng thái (luật 13): lỗi / đang tải / trống / có dữ liệu.
 */
export function PdaListColumn({
  title,
  hint,
  count,
  error,
  empty,
  children,
}: {
  title: string;
  hint: string;
  /** null = đang tải. */
  count: number | null;
  error: boolean;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card" aria-label={title}>
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="font-semibold">
          {title}
          {count !== null ? ` · ${count}` : ''}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </header>
      {error ? (
        <p className="px-3 py-3 text-sm text-destructive">Không tải được danh sách.</p>
      ) : count === null ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : count === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}
