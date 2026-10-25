import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI. */
export type WaitingStockSummary = components['schemas']['WaitingStockSummaryDto'];
export type WaitingStockSku = components['schemas']['WaitingStockSkuDto'];
export type WaitingMatch = components['schemas']['WaitingMatchDto'];
export type WaitingMatchOrder = components['schemas']['WaitingMatchOrderDto'];

/** Màn chạy cả ca — tự làm mới mỗi phút như theo dõi giao hàng. */
const WAITING_REFRESH_MS = 60_000;

export const waitingStockKeys = {
  all: ['wms', 'waiting-stock'] as const,
  summary: (q: string) => [...waitingStockKeys.all, 'summary', q] as const,
  match: (receiptId: string) => [...waitingStockKeys.all, 'match', receiptId] as const,
};

/**
 * GET /waiting-stock/summary — màn "Hàng chờ" (2026-10-25): SKU thiếu cho đơn chờ hàng / tổng
 * đơn chờ; `q` lọc dòng SKU ở server (luật 8), số tổng tính mọi SKU. Kho theo ô chọn kho (header).
 */
export function useWaitingStockSummary(q: string) {
  return useQuery({
    queryKey: waitingStockKeys.summary(q),
    queryFn: () =>
      unwrap(api.GET('/waiting-stock/summary', { params: { query: { q: q || undefined } } })),
    placeholderData: keepPreviousData,
    refetchInterval: WAITING_REFRESH_MS,
  });
}

/** GET /goods-receipts/:id/waiting-match — hàng của phiếu nhập khớp đơn chờ hàng (chỉ thống kê). */
export function useReceiptWaitingMatch(receiptId: string) {
  return useQuery({
    queryKey: waitingStockKeys.match(receiptId),
    queryFn: () =>
      unwrap(
        api.GET('/goods-receipts/{id}/waiting-match', { params: { path: { id: receiptId } } }),
      ),
    enabled: receiptId !== '',
  });
}
