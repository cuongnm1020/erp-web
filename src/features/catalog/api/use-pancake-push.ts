import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type PancakeBulkPushStatus = components['schemas']['PancakeBulkPushStatusDto'];

/** Query key theo phễu (luật 3): ['catalog','pancake-push','bulk']. */
export const pancakePushKeys = {
  all: ['catalog', 'pancake-push'] as const,
  bulk: () => [...pancakePushKeys.all, 'bulk'] as const,
};

export const isBulkPushRunning = (s: PancakeBulkPushStatus | undefined): boolean =>
  s?.state === 'waiting' || s?.state === 'active';

/**
 * GET /pancake-sync/push/products/bulk — trạng thái lượt đẩy toàn bộ sản phẩm lên Pancake.
 * Hỏi lại mỗi 3 s khi lượt đang chạy, đứng yên khi xong.
 */
export function usePancakeBulkPushStatus(enabled = true) {
  return useQuery({
    queryKey: pancakePushKeys.bulk(),
    queryFn: () => unwrap(api.GET('/pancake-sync/push/products/bulk')),
    enabled,
    refetchInterval: (q) => (isBulkPushRunning(q.state.data) ? 3_000 : false),
  });
}

/**
 * POST /pancake-sync/push/products/bulk — xếp job nền đẩy TOÀN BỘ sản phẩm lên mọi shop.
 * Không phải chứng từ nên không cần Idempotency-Key: server dùng jobId cố định, đang chạy thì
 * bấm lại chỉ trả trạng thái lượt đó.
 */
export function useStartPancakeBulkPush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/pancake-sync/push/products/bulk')),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakePushKeys.bulk() }),
  });
}
