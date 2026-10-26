import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/**
 * Mục đích sử dụng + lịch sử chăm sóc khách (biên bản họp CSKH 2026-10-26). Ai lên đơn cũng xem /
 * tạo / gắn mục đích và ghi chú; chỉ người viết sửa / xóa ghi chú; đổi tên / gộp / xóa mục đích
 * cần quyền `customer.purpose_manage`.
 */
export type Purpose = components['schemas']['PurposeDto'];
export type CustomerPurpose = components['schemas']['CustomerPurposeDto'];
export type CustomerNote = components['schemas']['CustomerNoteDto'];

export const careKeys = {
  purposes: () => ['crm', 'purposes'] as const,
  customerPurposes: (customerId: string) => [...customerKeys.all, 'purposes', customerId] as const,
  notes: (customerId: string) => [...customerKeys.all, 'notes', customerId] as const,
};

/** GET /customer-purposes — danh mục mục đích (sắp theo tên). */
export function usePurposes() {
  return useQuery({
    queryKey: careKeys.purposes(),
    queryFn: () => unwrap(api.GET('/customer-purposes')),
    staleTime: 5 * 60_000,
  });
}

/** POST /customer-purposes — trùng không dấu với mục đích đã có thì trả bản đã có. */
export function useCreatePurpose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.POST('/customer-purposes', { body: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: careKeys.purposes() }),
  });
}

function useInvalidatePurposeCatalog() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: careKeys.purposes() });
    // Tên mục đích nhúng trong danh sách khách của team + hồ sơ khách.
    void qc.invalidateQueries({ queryKey: customerKeys.all });
  };
}

export function useUpdatePurpose() {
  const invalidate = useInvalidatePurposeCatalog();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(api.PATCH('/customer-purposes/{id}', { params: { path: { id } }, body: { name } })),
    onSuccess: invalidate,
  });
}

export function useMergePurpose() {
  const invalidate = useInvalidatePurposeCatalog();
  return useMutation({
    mutationFn: ({ id, intoId }: { id: string; intoId: string }) =>
      unwrap(
        api.POST('/customer-purposes/{id}/merge', { params: { path: { id } }, body: { intoId } }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeletePurpose() {
  const invalidate = useInvalidatePurposeCatalog();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/customer-purposes/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

/** Mục đích đang gắn cho khách — mới gắn trước. */
export function useCustomerPurposes(customerId: string | undefined) {
  return useQuery({
    queryKey: careKeys.customerPurposes(customerId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/customer-care/customers/{customerId}/purposes', {
          params: { path: { customerId: customerId! } },
        }),
      ),
    enabled: !!customerId,
  });
}

function useInvalidateCustomerCare(customerId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: careKeys.customerPurposes(customerId) });
    void qc.invalidateQueries({ queryKey: careKeys.notes(customerId) });
    void qc.invalidateQueries({ queryKey: careKeys.purposes() });
    void qc.invalidateQueries({ queryKey: [...customerKeys.all, 'team'] });
  };
}

export function useAddCustomerPurposes(customerId: string) {
  const invalidate = useInvalidateCustomerCare(customerId);
  return useMutation({
    mutationFn: (tagIds: string[]) =>
      unwrap(
        api.POST('/customer-care/customers/{customerId}/purposes', {
          params: { path: { customerId } },
          body: { tagIds },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveCustomerPurpose(customerId: string) {
  const invalidate = useInvalidateCustomerCare(customerId);
  return useMutation({
    mutationFn: (tagId: string) =>
      unwrap(
        api.DELETE('/customer-care/customers/{customerId}/purposes/{tagId}', {
          params: { path: { customerId, tagId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** GET /customer-care/customers/{id}/notes — mới nhất trước. */
export function useCustomerNotes(customerId: string | undefined, take = 50) {
  return useQuery({
    queryKey: [...careKeys.notes(customerId ?? ''), take],
    queryFn: () =>
      unwrap(
        api.GET('/customer-care/customers/{customerId}/notes', {
          params: { path: { customerId: customerId! }, query: { take, skip: 0 } },
        }),
      ),
    enabled: !!customerId,
  });
}

export function useCreateCustomerNote(customerId: string) {
  const invalidate = useInvalidateCustomerCare(customerId);
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST('/customer-care/customers/{customerId}/notes', {
          params: { path: { customerId } },
          body: { body },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomerNote(customerId: string) {
  const invalidate = useInvalidateCustomerCare(customerId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      unwrap(api.PATCH('/customer-care/notes/{id}', { params: { path: { id } }, body: { body } })),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomerNote(customerId: string) {
  const invalidate = useInvalidateCustomerCare(customerId);
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/customer-care/notes/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}
