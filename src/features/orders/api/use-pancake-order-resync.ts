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

export interface StartPancakeResyncInput {
  shopId: string;
  /** Có cả hai (`YYYY-MM-DD`, giờ VN) → quét mọi đơn Pancake cập nhật trong khoảng, kể cả đơn ERP chưa có. */
  fromDate?: string;
  toDate?: string;
}

/** Khoảng tối đa server nhận (RESYNC_MAX_DAYS bên api). */
export const RESYNC_MAX_DAYS = 31;

/**
 * POST /pancake-sync/transform/orders/resync — xếp job nền: không khoảng ngày thì ghi đè các đơn
 * "Chờ xử lý kho" của POS; có khoảng ngày thì lấy mọi đơn Pancake cập nhật trong khoảng (tạo đơn
 * ERP chưa có). Không phải chứng từ nên không cần Idempotency-Key: server dùng jobId theo shop,
 * đang chạy thì bấm lại chỉ trả trạng thái lượt đó.
 */
export function useStartPancakeOrderResync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, fromDate, toDate }: StartPancakeResyncInput) =>
      unwrap(
        api.POST('/pancake-sync/transform/orders/resync', {
          body: {
            shopId: Number(shopId),
            ...(fromDate && toDate ? { fromDate, toDate } : {}),
          },
        }),
      ),
    onSuccess: (_d, { shopId }) =>
      void qc.invalidateQueries({ queryKey: pancakeResyncKeys.shop(shopId) }),
  });
}
