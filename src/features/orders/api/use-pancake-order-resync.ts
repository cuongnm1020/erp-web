import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { orderKeys } from './use-orders';

export type PancakeOrderResyncStatus = components['schemas']['PancakeOrderResyncStatusDto'];

/** Query key theo phễu (luật 3): ['crm','orders','pancake-resync', shopId]. */
export const pancakeResyncKeys = {
  all: [...orderKeys.all, 'pancake-resync'] as const,
  shop: (shopId: string) => [...pancakeResyncKeys.all, shopId] as const,
};

export const isResyncRunning = (s: PancakeOrderResyncStatus | undefined): boolean =>
  s?.state === 'waiting' || s?.state === 'active';

/**
 * GET /pancake-sync/transform/orders/resync?shopId= — lượt đồng bộ lại đơn gần nhất của một POS.
 * Hỏi lại mỗi 3 s khi đang chạy; chạy xong thì làm mới danh sách đơn.
 */
export function usePancakeOrderResyncStatus(shopId: string) {
  return useQuery({
    queryKey: pancakeResyncKeys.shop(shopId),
    queryFn: () =>
      unwrap(api.GET('/pancake-sync/transform/orders/resync', { params: { query: { shopId } } })),
    enabled: shopId !== '',
    refetchInterval: (q) => (isResyncRunning(q.state.data) ? 3_000 : false),
  });
}

/**
 * POST /pancake-sync/transform/orders/resync — xếp job nền ghi đè các đơn "Chờ xử lý kho" của POS
 * theo bản Pancake mới nhất. Không phải chứng từ nên không cần Idempotency-Key: server dùng jobId
 * theo shop, đang chạy thì bấm lại chỉ trả trạng thái lượt đó.
 */
export function useStartPancakeOrderResync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: string) =>
      unwrap(
        api.POST('/pancake-sync/transform/orders/resync', { body: { shopId: Number(shopId) } }),
      ),
    onSuccess: (_d, shopId) =>
      void qc.invalidateQueries({ queryKey: pancakeResyncKeys.shop(shopId) }),
  });
}
