import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI. */
export type CleanupTaskRow = components['schemas']['CleanupTaskRowDto'];
export type CleanupReservationRow = components['schemas']['CleanupReservationRowDto'];
export type CleanupActionResult = components['schemas']['CleanupActionResultDto'];
export type CleanupTaskQuery = NonNullable<
  operations['WmsCleanupController_tasks']['parameters']['query']
>;
export type CleanupReservationQuery = NonNullable<
  operations['WmsCleanupController_reservations']['parameters']['query']
>;

export const wmsCleanupKeys = {
  all: ['wms', 'cleanup'] as const,
  tasks: (q: CleanupTaskQuery) => [...wmsCleanupKeys.all, 'tasks', q] as const,
  reservations: (q: CleanupReservationQuery) => [...wmsCleanupKeys.all, 'reservations', q] as const,
};

/** GET /wms-cleanup/tasks — việc PICK / PACK (chỉ superadmin, 2026-11-10). */
export function useCleanupTasks(q: CleanupTaskQuery) {
  return useQuery({
    queryKey: wmsCleanupKeys.tasks(q),
    queryFn: () => unwrap(api.GET('/wms-cleanup/tasks', { params: { query: q } })),
    placeholderData: keepPreviousData,
  });
}

/** GET /wms-cleanup/reservations — phiếu giữ chỗ theo kệ (chỉ superadmin). */
export function useCleanupReservations(q: CleanupReservationQuery, enabled = true) {
  return useQuery({
    queryKey: wmsCleanupKeys.reservations(q),
    queryFn: () => unwrap(api.GET('/wms-cleanup/reservations', { params: { query: q } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** POST /wms-cleanup/tasks/cancel — "xóa" = hủy mềm, từng việc; lỗi từng việc trong `failed`. */
export function useCancelCleanupTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; reason: string }) =>
      unwrap(api.POST('/wms-cleanup/tasks/cancel', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: wmsCleanupKeys.all }),
  });
}

/** POST /wms-cleanup/reservations/release — nhả giữ chỗ ACTIVE. */
export function useReleaseCleanupReservations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; reason: string }) =>
      unwrap(api.POST('/wms-cleanup/reservations/release', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: wmsCleanupKeys.all }),
  });
}
