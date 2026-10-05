import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type PdaDevice = components['schemas']['DeviceDto'];
export type PdaDeviceStatus = PdaDevice['status'];
export type RegisterPdaDeviceInput = components['schemas']['RegisterDeviceDto'];
export type UpdatePdaDeviceInput = components['schemas']['UpdateDeviceDto'];
export type AdminWarehouse = components['schemas']['WarehouseSummaryDto'];

export interface PdaDeviceListParams {
  q?: string;
  status?: PdaDeviceStatus;
  warehouseId?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['admin','pda-devices','list', params]. */
export const pdaDeviceKeys = {
  all: ['admin', 'pda-devices'] as const,
  lists: () => [...pdaDeviceKeys.all, 'list'] as const,
  list: (p: PdaDeviceListParams) => [...pdaDeviceKeys.lists(), p] as const,
  warehouses: () => ['admin', 'warehouses'] as const,
};

/** GET /devices — lọc + phân trang phía server (luật 8). */
export function usePdaDevices(params: PdaDeviceListParams) {
  return useQuery({
    queryKey: pdaDeviceKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/devices', {
          params: {
            query: {
              q: params.q || undefined,
              status: params.status,
              warehouseId: params.warehouseId,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * GET /warehouses — tên kho cho cột/bộ lọc/select (Device.warehouseId thuộc wms, API không join).
 * Bản riêng của admin (luật 12). Cần stock.read; thiếu quyền thì bảng hiện "Kho khác".
 */
export function useAdminWarehouses() {
  return useQuery({
    queryKey: pdaDeviceKeys.warehouses(),
    queryFn: () => unwrap(api.GET('/warehouses')),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegisterPdaDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterPdaDeviceInput) => unwrap(api.POST('/devices', { body: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pdaDeviceKeys.lists() }),
  });
}

/** PATCH /devices/{id} — sửa mã / serial / model / kho / khóa nhân viên / trạng thái. Trùng → 409. */
export function useUpdatePdaDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePdaDeviceInput) =>
      unwrap(api.PATCH('/devices/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pdaDeviceKeys.lists() }),
  });
}

/** DELETE /devices/{id} — xóa hẳn kèm lịch sử đăng nhập. */
export function useDeletePdaDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/devices/{id}', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pdaDeviceKeys.lists() }),
  });
}

/** POST /devices/bulk-delete — id đã bị xóa trước đó rơi vào `skipped`, không lỗi. */
export function useBulkDeletePdaDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => unwrap(api.POST('/devices/bulk-delete', { body: { ids } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pdaDeviceKeys.lists() }),
  });
}
