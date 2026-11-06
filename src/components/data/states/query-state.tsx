'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingBar } from '@/components/ui/loading-bar';
import { Spinner } from '@/components/ui/spinner';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { useDelayedFlag, useElapsedFlag } from '@/lib/use-delayed-flag';
import { ErrorState, TraceId } from './error-state';

/** Quá ngưỡng này (ms) mà vẫn đang tải lại thì báo "phản hồi chậm" để người dùng không bấm lại. */
export const SLOW_FETCH_MS = 3000;

/**
 * Gom 4 trạng thái (luật 13) cho một useQuery: loading → skeleton, error → ErrorState,
 * rỗng → empty, còn lại → children(data). Màn hình chỉ cần truyền 3 phần tử.
 *
 *   <QueryState query={q} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0}
 *               empty={<EmptyState … />}>{(d) => <Table … />}</QueryState>
 *
 * Tải lại (mockup trạng thái tải 2026-11-06): query đổi key (tìm / lọc / chuyển trang) với
 * `placeholderData: keepPreviousData` → giữ dữ liệu cũ mờ đi, khóa bấm, thanh 2px chạy trên đầu;
 * quá 3s thêm dải "phản hồi chậm". Refetch nền (focus cửa sổ, socket invalidate) không hiện gì.
 * Tải lại lỗi mà vẫn còn dữ liệu → giữ bảng, dải đỏ + Thử lại; chỉ khi chưa có dữ liệu mới
 * thay cả khối bằng ErrorState.
 */
export function QueryState<T>({
  query,
  skeleton,
  empty,
  isEmpty,
  children,
}: {
  query: {
    data: T | undefined;
    error: unknown;
    isPending: boolean;
    /** Có khi query dùng `placeholderData` — bật trạng thái "đang tải lại". */
    isPlaceholderData?: boolean;
    refetch: () => unknown;
  };
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  const refreshing = !!query.isPlaceholderData;
  const shown = useDelayedFlag(refreshing);
  const slow = useElapsedFlag(refreshing, SLOW_FETCH_MS);

  if (query.isPending) return <>{skeleton}</>;
  if (query.error && query.data === undefined)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <>{skeleton}</>;

  const data = query.data;
  const body = empty && isEmpty?.(data) ? empty : children(data);
  return (
    <div className="relative" aria-busy={shown || undefined}>
      {shown ? <LoadingBar /> : null}
      {query.error ? (
        <RefetchError error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {shown && slow ? (
        <div
          role="status"
          className="mb-2 flex items-center gap-2 rounded-md bg-warning-weak px-3 py-2 text-sm text-warning"
        >
          <Spinner className="size-3.5" />
          Máy chủ phản hồi chậm hơn thường lệ, vẫn đang tải…
        </div>
      ) : null}
      <div
        className={cn(
          'transition-opacity duration-150',
          shown && 'pointer-events-none select-none opacity-45',
        )}
      >
        {body}
      </div>
    </div>
  );
}

function RefetchError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const traceId = isApiError(error) ? error.traceId : undefined;
  return (
    <div
      role="alert"
      className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-destructive-line bg-destructive-weak px-3 py-1.5 text-sm text-destructive"
    >
      <span className="min-w-0 flex-1">Không tải lại được dữ liệu. {messageFor(error)}</span>
      {traceId ? <TraceId value={traceId} /> : null}
      <Button size="sm" variant="outline" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}
