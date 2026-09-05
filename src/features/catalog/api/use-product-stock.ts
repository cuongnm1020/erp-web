import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/**
 * Tồn kho cho màn CHI TIẾT SẢN PHẨM — hook riêng của catalog (luật 12: không import
 * từ features/wms). Ba con số onHand / reserved / available là API tính sẵn,
 * frontend chỉ hiển thị, không tự cộng trừ.
 */
export type StockRow = components['schemas']['StockRowDto'];
export type StockByLocationRow = components['schemas']['StockByLocationRowDto'];
export type StockByLotRow = components['schemas']['StockByLotRowDto'];

export const productStockKeys = {
  all: ['catalog', 'sku-stock'] as const,
  summary: (skuCode: string) => [...productStockKeys.all, 'summary', skuCode] as const,
  byLocation: (skuId: string) => [...productStockKeys.all, 'by-location', skuId] as const,
  byLot: (skuId: string) => [...productStockKeys.all, 'by-lot', skuId] as const,
};

/** GET /stock — tồn gộp; q theo mã SKU rồi khớp đúng skuId ở component (API không có filter skuId). */
export function useSkuStockSummary(skuCode: string) {
  return useQuery({
    queryKey: productStockKeys.summary(skuCode),
    queryFn: () =>
      unwrap(api.GET('/stock', { params: { query: { q: skuCode, take: 50, skip: 0 } } })),
    enabled: skuCode !== '',
  });
}

/** GET /stock/by-location — bóc theo vị trí của MỘT SKU, API sắp theo thứ tự đi kho. */
export function useSkuStockByLocation(skuId: string) {
  return useQuery({
    queryKey: productStockKeys.byLocation(skuId),
    queryFn: () =>
      unwrap(api.GET('/stock/by-location', { params: { query: { skuId, take: 200, skip: 0 } } })),
    enabled: skuId !== '',
  });
}

/** GET /stock/by-lot — bóc theo lô của MỘT SKU, sắp theo HSD tăng dần (FEFO). */
export function useSkuStockByLot(skuId: string) {
  return useQuery({
    queryKey: productStockKeys.byLot(skuId),
    queryFn: () =>
      unwrap(api.GET('/stock/by-lot', { params: { query: { skuId, take: 200, skip: 0 } } })),
    enabled: skuId !== '',
  });
}
