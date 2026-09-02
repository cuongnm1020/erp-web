import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Warehouse = components['schemas']['WarehouseSummaryDto'];
export type CreateWarehouseInput = components['schemas']['CreateWarehouseDto'];
export type UpdateWarehouseInput = components['schemas']['UpdateWarehouseDto'];

/**
 * Kho trung chuyển ẢO (PLAN-gdn-transfer bước 4) — tồn "đang trên xe" giữa hai
 * bước của phiếu chuyển kho. Hiện ở màn Tồn kho / Kho & vị trí, nhưng KHÔNG bao
 * giờ là lựa chọn cho nhập kho / kiểm kê / điểm đi-đến của phiếu chuyển.
 */
export const TRANSIT_WAREHOUSE_CODE = 'TRANSIT';

/** Kho vận hành được (chọn trong form nhập/kiểm kê/chuyển): active và không phải kho ảo. */
export function isOperationalWarehouse(w: Pick<Warehouse, 'isActive' | 'code'>): boolean {
  return w.isActive && w.code !== TRANSIT_WAREHOUSE_CODE;
}

/** Phễu key (luật 3): ['wms','warehouses', ...]. */
export const warehouseKeys = {
  all: ['wms', 'warehouses'] as const,
  list: () => [...warehouseKeys.all, 'list'] as const,
};

/** GET /warehouses — danh mục nhỏ (vài kho), không phân trang; cần stock.read. */
export function useWarehouses() {
  return useQuery({
    queryKey: warehouseKeys.list(),
    queryFn: () => unwrap(api.GET('/warehouses')),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) => unwrap(api.POST('/warehouses', { body: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

export function useUpdateWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWarehouseInput) =>
      unwrap(api.PATCH('/warehouses/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

/** DELETE /warehouses/{id} — soft delete: kho chuyển Ngừng dùng, tồn/vị trí/chứng từ giữ nguyên. */
export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/warehouses/{id}', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}
