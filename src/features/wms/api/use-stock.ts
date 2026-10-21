import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type StockRow = components['schemas']['StockRowDto'];
export type StockByLocationRow = components['schemas']['StockByLocationRowDto'];
export type StockByLotRow = components['schemas']['StockByLotRowDto'];
export type LocationType = StockByLocationRow['locationType'];
export type SetActualStockBody = components['schemas']['SetActualStockDto'];
export type SetSkuCostsBody = components['schemas']['SetSkuCostsDto'];
export type SetSkuWeightsBody = components['schemas']['SetSkuWeightsDto'];

export interface StockListParams {
  q?: string;
  warehouseId?: string;
  /** Chỉ hàng tạo trong ERP — bỏ hàng đơn Pancake tự sinh, combo, SKU đã xoá. */
  erpOnly?: boolean;
  take: number;
  skip: number;
}

/** Cột sắp được của GET /stock (theo SKU) — id cột trên bảng = sortBy gửi lên API. */
export type StockSortField = NonNullable<
  NonNullable<operations['InventoryController_list']['parameters']['query']>['sortBy']
>;

export interface StockBySkuParams extends StockListParams {
  sortBy?: StockSortField;
  sortDir?: 'asc' | 'desc';
}

export interface StockBreakdownParams extends StockListParams {
  skuId?: string;
  locationId?: string;
}

/** Query key theo phễu (luật 3): ['wms','stock', <mặt>, params]. Invalidate theo prefix. */
export const stockKeys = {
  all: ['wms', 'stock'] as const,
  bySku: (p: StockBySkuParams) => [...stockKeys.all, 'by-sku', p] as const,
  byLocation: (p: StockBreakdownParams) => [...stockKeys.all, 'by-location', p] as const,
  byLot: (p: StockBreakdownParams) => [...stockKeys.all, 'by-lot', p] as const,
};

/**
 * GET /stock — tồn gộp theo SKU, mặc định sắp theo mã SKU; sortBy cân nặng / tồn thực / đang giữ /
 * khả dụng sắp phía server (trên toàn bộ SKU khớp, rồi mới phân trang). Ba con số `onHand` / `reserved` /
 * `available` là ba trường riêng do API tính (bất biến 3) — frontend chỉ hiển thị,
 * không tự cộng trừ.
 */
export function useStockBySku(params: StockBySkuParams, enabled = true) {
  return useQuery({
    queryKey: stockKeys.bySku(params),
    queryFn: () =>
      unwrap(
        api.GET('/stock', {
          params: {
            query: {
              q: params.q || undefined,
              warehouseId: params.warehouseId || undefined,
              erpOnly: params.erpOnly ? 'true' : undefined,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
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
              erpOnly: params.erpOnly ? 'true' : undefined,
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
              erpOnly: params.erpOnly ? 'true' : undefined,
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

/**
 * POST /cycle-counts/actual-stock — nhập tồn thực tế theo kho, server ghi THẲNG phần lệch vào sổ
 * cái + phiếu kiểm kê POSTED. Idempotency-Key sinh LÚC BẤM (luật 4), giữ nguyên khi retry. Không
 * optimistic (luật 5): chờ server rồi invalidate tồn + danh sách phiếu kiểm.
 */
export function useSetActualStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: SetActualStockBody; key: string }) =>
      unwrap(
        api.POST('/cycle-counts/actual-stock', {
          params: { header: { 'idempotency-key': key } },
          headers: idempotency(key),
          body,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: stockKeys.all });
      void qc.invalidateQueries({ queryKey: ['wms', 'cycle-counts'] });
    },
  });
}

/**
 * POST /stock/costs — kế toán đặt giá vốn cho mọi tồn còn lại của SKU (quyền stock.cost). Đặt giá
 * là thao tác tuyệt đối, gửi lại cho cùng kết quả — không cần Idempotency-Key. Không optimistic.
 */
export function useSetSkuCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetSkuCostsBody) => unwrap(api.POST('/stock/costs', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

/**
 * POST /stock/weights — kho nhập cân nặng SKU (kg, Decimal chuỗi) ngay trên màn Tồn kho (quyền
 * stock.adjust, 2026-10-20). Thao tác tuyệt đối, không cần Idempotency-Key. Làm mới tồn kho + danh
 * mục sản phẩm (form SKU đọc cùng trường).
 */
export function useSetSkuWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetSkuWeightsBody) => unwrap(api.POST('/stock/weights', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: stockKeys.all });
      void qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
