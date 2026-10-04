import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { warehouseKeys } from './use-warehouses';

export type LocationNode = components['schemas']['LocationTreeNodeDto'];
export type LocationType = LocationNode['type'];
export type CreateLocationInput = components['schemas']['CreateLocationDto'];
export type UpdateLocationInput = components['schemas']['UpdateLocationDto'];

/** Phễu key nối tiếp warehouseKeys: ['wms','warehouses','detail',id,'locations','tree']. */
export const locationKeys = {
  tree: (warehouseId: string) =>
    [...warehouseKeys.all, 'detail', warehouseId, 'locations', 'tree'] as const,
  skuSearch: (q: string) => ['wms', 'locations', 'sku-search', q] as const,
  skuConversions: (skuId: string) => ['wms', 'locations', 'sku-conversions', skuId] as const,
  barcode: (code: string) => ['wms', 'locations', 'barcode', code] as const,
};

/**
 * Tìm SKU đang bán cho EntityPicker gán SKU cố định — GET /skus (q ăn mã/tên SKU và barcode).
 * Bản riêng của wms: luật 12 cấm import hook từ features/orders.
 */
export function useSkuSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: locationKeys.skuSearch(q),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: { query: { q: q || undefined, status: 'active', take: 20, skip: 0 } },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items.map((s) => ({
    id: s.skuId,
    label: s.name,
    hint: `${s.code} · ${s.productName}`,
    // F4 — form GRN đòi số lô ngay khi chọn SKU theo lô; ĐVT cơ sở để quy đổi thùng / pallet
    meta: { trackingMode: s.trackingMode, baseUomCode: s.baseUomCode },
  }));
  return { options, isPending: query.isPending, error: query.error };
}

/**
 * GET /skus/{id}/conversions — quy đổi ĐVT của một SKU (thùng / pallet = factor × ĐVT cơ sở).
 * Form nhập kho dùng để cho nhập theo thùng / pallet và tự quy ra đơn vị bán chính.
 */
export function useSkuConversions(skuId: string) {
  return useQuery({
    queryKey: locationKeys.skuConversions(skuId),
    queryFn: () => unwrap(api.GET('/skus/{id}/conversions', { params: { path: { id: skuId } } })),
    enabled: skuId !== '',
    staleTime: 60_000,
  });
}

export type BarcodeLookup = components['schemas']['BarcodeLookupDto'];

/** Kết quả quét cho form nhập kho: barcode + quy đổi của ĐVT gắn mã (null = ĐVT cơ sở). */
export interface ScannedBarcode {
  lookup: BarcodeLookup;
  /** `wms.ContainerType.id` khi mã dán trên thùng / pallet (ĐVT là cấp đóng gói). */
  containerTypeId: string | null;
}

/**
 * Tra barcode quét được (mã nhà sản xuất dán trên sản phẩm / thùng / pallet) — GET /barcodes/{code}
 * rồi GET /skus/{id}/conversions để biết ĐVT gắn mã có phải cấp đóng gói không. Đi qua cache
 * TanStack Query (luật 3) — hàm gọi trong handler quét, không fetch trong component.
 */
export function useBarcodeLookup() {
  const qc = useQueryClient();
  return async (code: string): Promise<ScannedBarcode> => {
    const lookup = await qc.fetchQuery({
      queryKey: locationKeys.barcode(code),
      queryFn: () => unwrap(api.GET('/barcodes/{code}', { params: { path: { code } } })),
      staleTime: 0,
    });
    if (lookup.uom.id === lookup.baseUom.id) return { lookup, containerTypeId: null };
    const conversions = await qc.fetchQuery({
      queryKey: locationKeys.skuConversions(lookup.sku.id),
      queryFn: () =>
        unwrap(api.GET('/skus/{id}/conversions', { params: { path: { id: lookup.sku.id } } })),
      staleTime: 60_000,
    });
    const conv = conversions.find((c) => c.uomId === lookup.uom.id);
    return { lookup, containerTypeId: conv?.containerTypeId ?? null };
  };
}

/** GET /warehouses/{id}/locations/tree — cây ZONE/AISLE/RACK/BIN; cần stock.read. */
export function useLocationTree(warehouseId: string | null) {
  return useQuery({
    queryKey: locationKeys.tree(warehouseId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/warehouses/{id}/locations/tree', { params: { path: { id: warehouseId! } } }),
      ),
    enabled: warehouseId !== null,
  });
}

export function useCreateLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLocationInput) =>
      unwrap(
        api.POST('/warehouses/{id}/locations', {
          params: { path: { id: warehouseId } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}

export function useUpdateLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLocationInput }) =>
      unwrap(
        api.PATCH('/warehouses/locations/{locationId}', {
          params: { path: { locationId: id } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}

/** DELETE — soft delete: vị trí chuyển Ngừng dùng; server chặn 422 khi còn vị trí con đang dùng. */
export function useDeleteLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/warehouses/locations/{locationId}', { params: { path: { locationId: id } } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}
