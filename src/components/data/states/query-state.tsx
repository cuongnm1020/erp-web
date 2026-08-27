import type { ReactNode } from 'react';
import { ErrorState } from './error-state';

/**
 * Gom 4 trạng thái (luật 13) cho một useQuery: loading → skeleton, error → ErrorState,
 * rỗng → empty, còn lại → children(data). Màn hình chỉ cần truyền 3 phần tử.
 *
 *   <QueryState query={q} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0}
 *               empty={<EmptyState … />}>{(d) => <Table … />}</QueryState>
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
    refetch: () => unknown;
  };
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <>{skeleton}</>;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
