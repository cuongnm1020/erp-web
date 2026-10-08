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

/**
 * PATCH /warehouses/{id} { isDefault: true } — đặt kho MẶC ĐỊNH hệ thống (tối đa một kho;
 * server tự bỏ cờ kho cũ). Đơn đồng bộ từ Pancake giữ chỗ và nhận kho này lúc tạo.
 * Không optimistic (luật 5 — ảnh hưởng tồn giữ chỗ), chờ server rồi invalidate.
 */
export function useSetDefaultWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.PATCH('/warehouses/{id}', { params: { path: { id } }, body: { isDefault: true } }),
      ),
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

/** Ảnh 3D mặt bằng kho: jpg/png/webp ≤ 10MB (khớp server, luật 11). */
export const LAYOUT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LAYOUT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * PUT /warehouses/{id}/layout-image — multipart 'file', thay ảnh cũ. `layoutImageUrl` là
 * presigned S3 hết hạn ~1h — chỉ hiển thị, đừng cất lâu.
 */
export function useUploadWarehouseLayoutImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return unwrap(
        api.PUT('/warehouses/{id}/layout-image', {
          params: { path: { id } },
          body: fd as never,
          // Giữ nguyên FormData + bỏ Content-Type json để browser tự đặt multipart boundary
          bodySerializer: (body: unknown) => body as FormData,
          headers: { 'Content-Type': null },
        }),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

/** DELETE /warehouses/{id}/layout-image — gỡ ảnh 3D (S3 + DB). */
export function useDeleteWarehouseLayoutImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/warehouses/{id}/layout-image', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}
