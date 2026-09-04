import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type LotRow = components['schemas']['LotRowDto'];
export type UpdateLotInput = components['schemas']['UpdateLotDto'];

export interface LotListParams {
  q?: string;
  skuId?: string;
  warehouseId?: string;
  /** Lô hết hạn trong N ngày tới (gồm cả đã hết hạn). */
  expiringInDays?: number;
  hasStock?: boolean;
  take: number;
  skip: number;
}

/** F4 — màn Lô & hạn dùng (GET /lots — FEFO view, D1 backend). */
export const lotKeys = {
  all: ['catalog', 'lots'] as const,
  lists: () => [...lotKeys.all, 'list'] as const,
  list: (p: LotListParams) => [...lotKeys.lists(), p] as const,
};

export function useLots(params: LotListParams) {
  return useQuery({
    queryKey: lotKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/lots', {
          params: {
            query: {
              q: params.q || undefined,
              skuId: params.skuId,
              warehouseId: params.warehouseId,
              expiringInDays: params.expiringInDays,
              hasStock: params.hasStock,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Đếm nhanh cho KPI — chỉ đọc `total`, take nhỏ nhất. */
export function useLotCount(filter: Pick<LotListParams, 'expiringInDays' | 'hasStock'>) {
  return useQuery({
    queryKey: [...lotKeys.all, 'count', filter] as const,
    queryFn: () => unwrap(api.GET('/lots', { params: { query: { ...filter, take: 1, skip: 0 } } })),
    select: (d) => d.total,
    staleTime: 30_000,
  });
}

/** PATCH /lots/{id} — sửa HSD/NSX khai sai (cần stock.adjust; server audit). */
export function useUpdateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLotInput }) =>
      unwrap(api.PATCH('/lots/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lotKeys.all });
      // /wms/stock tab "Theo lô" đọc cùng dữ liệu — làm tươi luôn
      void qc.invalidateQueries({ queryKey: ['wms', 'stock'] });
    },
  });
}
