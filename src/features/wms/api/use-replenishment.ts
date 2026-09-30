import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type ReplenishmentRow = components['schemas']['ReplenishmentRowDto'];
export type ReplenishmentResponse = components['schemas']['ReplenishmentResponseDto'];
export type ReplenishmentStatus = ReplenishmentRow['status'];

export interface ReplenishmentParams {
  q?: string;
  warehouseId?: string;
  /** true = chỉ dòng cần chú ý (OUT / BELOW / SOON); false = mọi SKU có mức tồn kho. */
  onlyAlert: boolean;
  take: number;
  skip: number;
}

/** Phễu key (luật 3): ['wms','replenishment','list', params]. */
export const replenishmentKeys = {
  all: ['wms', 'replenishment'] as const,
  lists: () => [...replenishmentKeys.all, 'list'] as const,
  list: (p: ReplenishmentParams) => [...replenishmentKeys.lists(), p] as const,
};

/**
 * GET /stock/replenishment — cảnh báo nhập hàng theo mức tồn kho đặt trên form sản phẩm:
 * tồn thực, số bán hôm nay / hôm qua / hôm kia, tốc độ bán, ngày dự kiến hết. Mọi con số do API
 * tính và trả string decimal (luật 10) — màn hình chỉ hiển thị. Làm tươi mỗi 60 s vì số bán
 * đổi theo đơn mới trong ngày.
 */
export function useReplenishment(params: ReplenishmentParams, enabled = true) {
  return useQuery({
    queryKey: replenishmentKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/stock/replenishment', {
          params: {
            query: {
              q: params.q || undefined,
              warehouseId: params.warehouseId || undefined,
              onlyAlert: params.onlyAlert,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    enabled,
  });
}
