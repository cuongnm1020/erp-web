import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

export type CustomerGroup = components['schemas']['CustomerGroupDto'];
export type CreateCustomerGroupInput = components['schemas']['CreateCustomerGroupDto'];
export type UpdateCustomerGroupInput = components['schemas']['UpdateCustomerGroupDto'];
export type CustomerTier = components['schemas']['CustomerTierDto'];
export type CreateCustomerTierInput = components['schemas']['CreateCustomerTierDto'];
export type UpdateCustomerTierInput = components['schemas']['UpdateCustomerTierDto'];
export type CustomerTag = components['schemas']['TagDto'];
export type CreateCustomerTagInput = components['schemas']['CreateTagDto'];
export type UpdateCustomerTagInput = components['schemas']['UpdateTagDto'];
export type RunTierPromotionInput = components['schemas']['RunTierPromotionDto'];
export type TierPromotionResult = components['schemas']['TierPromotionResultDto'];
export type SetCustomerSegmentInput = components['schemas']['SetCustomerSegmentDto'];

/**
 * Danh mục nhóm / cấp độ / tag (CRM-02) — query key theo phễu ['crm','segments',…].
 * Tên nhóm/cấp/tag còn được nhúng trong GET /customers (CRM-03) → mutation đổi danh mục
 * invalidate thêm prefix ['crm','customers'] để danh sách + hồ sơ không hiện tên cũ.
 */
export const segmentKeys = {
  all: ['crm', 'segments'] as const,
  groups: () => [...segmentKeys.all, 'groups'] as const,
  groupList: (p: { includeInactive: boolean }) => [...segmentKeys.groups(), p] as const,
  tiers: () => [...segmentKeys.all, 'tiers'] as const,
  tags: () => [...segmentKeys.all, 'tags'] as const,
};

// ───────────────────────────── Nhóm ─────────────────────────────

/** GET /customer-groups — `includeInactive` để màn danh mục thấy cả nhóm đã ngừng dùng. */
export function useCustomerGroups({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: segmentKeys.groupList({ includeInactive }),
    queryFn: () =>
      unwrap(
        api.GET('/customer-groups', {
          params: { query: includeInactive ? { includeInactive: 'true' } : {} },
        }),
      ),
    staleTime: 60_000,
  });
}

function useInvalidateCatalog(prefix: readonly unknown[]) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: prefix });
    void qc.invalidateQueries({ queryKey: customerKeys.all });
  };
}

export function useCreateCustomerGroup() {
  const invalidate = useInvalidateCatalog(segmentKeys.groups());
  return useMutation({
    mutationFn: (body: CreateCustomerGroupInput) => unwrap(api.POST('/customer-groups', { body })),
    onSuccess: invalidate,
  });
}

/** PATCH /customer-groups/{id} — cũng dùng để "Dùng lại" nhóm đã ngừng (`isActive: true`). */
export function useUpdateCustomerGroup() {
  const invalidate = useInvalidateCatalog(segmentKeys.groups());
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCustomerGroupInput }) =>
      unwrap(api.PATCH('/customer-groups/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/**
 * DELETE /customer-groups/{id} — mặc định chỉ NGỪNG DÙNG; `hard: true` xóa hẳn (nhóm tạo nhầm).
 * Xóa hẳn khi còn khách (kể cả khách ngoài scope) → 409 GROUP_IN_USE.
 */
export function useDeleteCustomerGroup() {
  const invalidate = useInvalidateCatalog(segmentKeys.groups());
  return useMutation({
    mutationFn: ({ id, hard }: { id: string; hard: boolean }) =>
      unwrap(
        api.DELETE('/customer-groups/{id}', {
          params: { path: { id }, query: hard ? { hard: 'true' } : {} },
        }),
      ),
    onSuccess: invalidate,
  });
}

// ──────────────────────────── Cấp độ ────────────────────────────

export function useCustomerTiers() {
  return useQuery({
    queryKey: segmentKeys.tiers(),
    queryFn: () => unwrap(api.GET('/customer-tiers')),
    staleTime: 60_000,
  });
}

export function useCreateCustomerTier() {
  const invalidate = useInvalidateCatalog(segmentKeys.tiers());
  return useMutation({
    mutationFn: (body: CreateCustomerTierInput) => unwrap(api.POST('/customer-tiers', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomerTier() {
  const invalidate = useInvalidateCatalog(segmentKeys.tiers());
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCustomerTierInput }) =>
      unwrap(api.PATCH('/customer-tiers/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** DELETE /customer-tiers/{id} — 409 TIER_IN_USE khi còn khách mang cấp này. */
export function useDeleteCustomerTier() {
  const invalidate = useInvalidateCatalog(segmentKeys.tiers());
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/customer-tiers/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

/**
 * POST /customer-tiers/promotion/run — `dryRun: true` chỉ tính, không ghi. Chạy thật đổi cấp
 * của khách → invalidate danh sách/hồ sơ khách. Dry-run không đổi gì nên không invalidate.
 */
export function useRunTierPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RunTierPromotionInput) =>
      unwrap(api.POST('/customer-tiers/promotion/run', { body })),
    onSuccess: (res) => {
      if (!res.dryRun) void qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

// ───────────────────────────── Tag ─────────────────────────────

export function useCustomerTags() {
  return useQuery({
    queryKey: segmentKeys.tags(),
    queryFn: () => unwrap(api.GET('/customer-tags')),
    staleTime: 60_000,
  });
}

export function useCreateCustomerTag() {
  const invalidate = useInvalidateCatalog(segmentKeys.tags());
  return useMutation({
    mutationFn: (body: CreateCustomerTagInput) => unwrap(api.POST('/customer-tags', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomerTag() {
  const invalidate = useInvalidateCatalog(segmentKeys.tags());
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCustomerTagInput }) =>
      unwrap(api.PATCH('/customer-tags/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** DELETE /customer-tags/{id} — gỡ tag khỏi mọi khách (cascade), trả số dòng gán bị gỡ. */
export function useDeleteCustomerTag() {
  const invalidate = useInvalidateCatalog(segmentKeys.tags());
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/customer-tags/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

// ──────────────────── Gán cho một khách (CRM-04) ────────────────────
// customerId nằm trong biến của mutation (không trong hook) để form TẠO khách gọi được ngay
// sau khi POST /customers trả id mới.

function useInvalidateCustomer() {
  const qc = useQueryClient();
  return (customerId: string) => {
    void qc.invalidateQueries({ queryKey: customerKeys.lists() });
    void qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) });
  };
}

/** PATCH /customer-segments/{customerId} — groupId/tierId: null = gỡ, bỏ trống = giữ nguyên. */
export function useSetCustomerSegment() {
  const invalidate = useInvalidateCustomer();
  return useMutation({
    mutationFn: ({ customerId, ...body }: { customerId: string } & SetCustomerSegmentInput) =>
      unwrap(
        api.PATCH('/customer-segments/{customerId}', { params: { path: { customerId } }, body }),
      ),
    onSuccess: (_d, v) => invalidate(v.customerId),
  });
}

/** POST /customer-segments/{customerId}/tags — gán thêm (idempotent với tag đã gán). */
export function useAssignCustomerTags() {
  const invalidate = useInvalidateCustomer();
  return useMutation({
    mutationFn: ({ customerId, tagIds }: { customerId: string; tagIds: string[] }) =>
      unwrap(
        api.POST('/customer-segments/{customerId}/tags', {
          params: { path: { customerId } },
          body: { tagIds },
        }),
      ),
    onSuccess: (_d, v) => invalidate(v.customerId),
  });
}

/** DELETE /customer-segments/{customerId}/tags/{tagId} — gỡ một tag (idempotent). */
export function useUnassignCustomerTag() {
  const invalidate = useInvalidateCustomer();
  return useMutation({
    mutationFn: ({ customerId, tagId }: { customerId: string; tagId: string }) =>
      unwrap(
        api.DELETE('/customer-segments/{customerId}/tags/{tagId}', {
          params: { path: { customerId, tagId } },
        }),
      ),
    onSuccess: (_d, v) => invalidate(v.customerId),
  });
}
