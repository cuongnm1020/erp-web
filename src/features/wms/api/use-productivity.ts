import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type Productivity = components['schemas']['TaskProductivityDto'];
export type ProductivitySection = components['schemas']['ProductivitySectionDto'];
export type ProductivityRow = components['schemas']['ProductivityRowDto'];

export interface ProductivityParams {
  /** YYYY-MM-DD giờ VN, bao gồm hai đầu. */
  from: string;
  to: string;
  warehouseId?: string;
}

/** Phễu key (luật 3): ['wms','productivity', params]. */
export const productivityKeys = {
  all: ['wms', 'productivity'] as const,
  detail: (p: ProductivityParams) => [...productivityKeys.all, p] as const,
};

/**
 * GET /tasks/productivity — đơn đã lấy / đã đóng theo nhân viên trong khoảng ngày + việc đang giao
 * cho từng người + hàng chờ chưa giao. Mọi con số do API tính (luật 10). Làm tươi mỗi 60 s: cột
 * "đang giao" là số lúc gọi, điều phối nhìn để chia việc.
 */
export function useProductivity(params: ProductivityParams) {
  return useQuery({
    queryKey: productivityKeys.detail(params),
    queryFn: () =>
      unwrap(
        api.GET('/tasks/productivity', {
          params: {
            query: {
              from: params.from,
              to: params.to,
              warehouseId: params.warehouseId || undefined,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
