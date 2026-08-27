import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type StockRow = components['schemas']['StockRowDto'];
export type StockByLocationRow = components['schemas']['StockByLocationRowDto'];
export type StockByLotRow = components['schemas']['StockByLotRowDto'];
export type LocationType = StockByLocationRow['locationType'];

export interface StockListParams {
  q?: string;
  warehouseId?: string;
  take: number;
  skip: number;
}

export interface StockBreakdownParams extends StockListParams {
  skuId?: string;
  locationId?: string;
}

/** Query key theo phễu (luật 3): ['wms','stock', <mặt>, params]. Invalidate theo prefix. */
export const stockKeys = {
  all: ['wms', 'stock'] as const,
  bySku: (p: StockListParams) => [...stockKeys.all, 'by-sku', p] as const,
  byLocation: (p: StockBreakdownParams) => [...stockKeys.all, 'by-location', p] as const,
  byLot: (p: StockBreakdownParams) => [...stockKeys.all, 'by-lot', p] as const,
};

/**
 * GET /stock — tồn gộp theo SKU, sắp theo mã SKU. Ba con số `onHand` / `reserved` /
 * `available` là ba trường riêng do API tính (bất biến 3) — frontend chỉ hiển thị,
 * không tự cộng trừ.
 */
export function useStockBySku(params: StockListParams, enabled = true) {
  return useQuery({
    queryKey: stockKeys.bySku(params),
    queryFn: () =>
      unwrap(
        api.GET('/stock', {
          params: {
            query: {
              q: params.q || undefined,
              warehouseId: params.warehouseId || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** GET /stock/by-location — bóc theo vị trí, API sắp theo `pickSequence` (thứ tự đi kho). */
export function useStockByLocation(params: StockBreakdownParams, enabled = true) {
  return useQuery({
    queryKey: stockKeys.byLocation(params),
    queryFn: () =>
      unwrap(
        api.GET('/stock/by-location', {
          params: {
            query: {
              q: params.q || undefined,
              warehouseId: params.warehouseId || undefined,
              skuId: params.skuId || undefined,
              locationId: params.locationId || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** GET /stock/by-lot — bóc theo lô, API sắp theo hạn dùng tăng dần = đúng thứ tự FEFO. */
export function useStockByLot(params: StockBreakdownParams, enabled = true) {
  return useQuery({
    queryKey: stockKeys.byLot(params),
    queryFn: () =>
      unwrap(
        api.GET('/stock/by-lot', {
          params: {
            query: {
              q: params.q || undefined,
              warehouseId: params.warehouseId || undefined,
              skuId: params.skuId || undefined,
              locationId: params.locationId || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}
