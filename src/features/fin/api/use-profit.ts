import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type ProfitReport = components['schemas']['ProfitReportDto'];
export type ProfitOrderRow = components['schemas']['ProfitOrderRowDto'];
export type ProfitSkuRow = components['schemas']['ProfitSkuRowDto'];
export type ProfitCostStatus = ProfitOrderRow['costStatus'];

export interface ProfitParams {
  /** YYYY-MM-DD giờ VN, gồm cả hai đầu. */
  from: string;
  to: string;
  groupBy: 'order' | 'sku';
  q: string;
  take: number;
  skip: number;
}

/** Phễu key (luật 3): ['fin','profit', params]. */
export const profitKeys = {
  all: ['fin', 'profit'] as const,
  detail: (p: ProfitParams) => [...profitKeys.all, p] as const,
};

/**
 * GET /reports/profit — doanh thu − giá vốn FIFO. Giá vốn đơn đã đóng gói là snapshot lúc PACK
 * (đúng giá các lô nhập đã xuất); đơn chưa đóng gói tạm tính theo lô đang mở. Mọi con số do API
 * tính (luật 10) — màn chỉ định dạng.
 */
export function useProfitReport(params: ProfitParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: profitKeys.detail(params),
    queryFn: () =>
      unwrap(
        api.GET('/reports/profit', {
          params: {
            query: {
              from: params.from,
              to: params.to,
              groupBy: params.groupBy,
              q: params.q || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** POST /reports/profit/backfill — chốt giá vốn cho đơn đóng gói trước khi có tính năng. */
export function useProfitBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { from: string; to: string }) =>
      unwrap(api.POST('/reports/profit/backfill', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: profitKeys.all }),
  });
}
