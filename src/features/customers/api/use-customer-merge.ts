import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/** CRM-07..09 — gộp khách trùng SĐT. Mọi endpoint cần `customer.merge` (chỉ ADMIN). */
export type DuplicateGroup = components['schemas']['DuplicateGroupDto'];
export type DuplicateCustomer = components['schemas']['DuplicateCustomerDto'];
export type DuplicateGroupList = components['schemas']['DuplicateGroupListDto'];
export type CompareCustomer = components['schemas']['CustomerCompareItemDto'];
export type DuplicateCompare = components['schemas']['DuplicateCompareDto'];
export type MergeFieldChoices = components['schemas']['MergeFieldChoicesDto'];
export type MergeField = keyof MergeFieldChoices;
export type MergeCustomersInput = components['schemas']['MergeCustomersDto'];
export type MergeResult = components['schemas']['MergeResultDto'];
export type MergeUndoResult = components['schemas']['MergeUndoResultDto'];
export type MergeLog = components['schemas']['MergeLogDto'];
export type MergeLogList = components['schemas']['MergeLogListDto'];
export type CustomerRefCount = components['schemas']['CustomerRefCountDto'];

export interface DuplicateListParams {
  take: number;
  skip: number;
}

export interface MergeLogParams {
  /** Không phải super admin thì bắt buộc (API trả 422 nếu thiếu). */
  customerId?: string;
  take: number;
  skip: number;
}

/**
 * Query key theo phễu (luật 3) — nằm dưới ['crm','customers'] vì gộp khách đổi cả danh sách,
 * hồ sơ lẫn nhóm trùng: sau gộp / hoàn tác invalidate đúng tiền tố `customerKeys.all`.
 */
export const mergeKeys = {
  duplicates: () => [...customerKeys.all, 'duplicates'] as const,
  duplicateList: (p: DuplicateListParams) => [...mergeKeys.duplicates(), 'list', p] as const,
  compare: (ids: readonly string[]) => [...mergeKeys.duplicates(), 'compare', ids] as const,
  logs: () => [...customerKeys.all, 'merge-logs'] as const,
  logList: (p: MergeLogParams) => [...mergeKeys.logs(), p] as const,
};

/** GET /customers/duplicates — phân trang theo NHÓM (mỗi nhóm = một SĐT chuẩn hoá). */
export function useDuplicateGroups(params: DuplicateListParams, enabled = true) {
  return useQuery({
    queryKey: mergeKeys.duplicateList(params),
    queryFn: () =>
      unwrap(
        api.GET('/customers/duplicates', {
          params: { query: { take: params.take, skip: params.skip } },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** GET /customers/duplicates/compare?ids=a&ids=b — 2..5 khách, đúng thứ tự gửi lên. */
export function useDuplicateCompare(ids: readonly string[]) {
  return useQuery({
    queryKey: mergeKeys.compare(ids),
    queryFn: () =>
      unwrap(api.GET('/customers/duplicates/compare', { params: { query: { ids: [...ids] } } })),
    enabled: ids.length >= 2,
  });
}

/** GET /customers/merge-logs — mới nhất trước. */
export function useMergeLogs(params: MergeLogParams, enabled = true) {
  return useQuery({
    queryKey: mergeKeys.logList(params),
    queryFn: () =>
      unwrap(
        api.GET('/customers/merge-logs', {
          params: {
            query: { customerId: params.customerId, take: params.take, skip: params.skip },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * POST /customers/merge — `idempotencyKey` sinh LÚC BẤM (luật 4), nằm trong body theo DTO.
 * Không optimistic: gộp chuyển đơn / công nợ (luật 5) — chờ server rồi invalidate.
 */
export function useMergeCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MergeCustomersInput) =>
      unwrap(api.POST('/customers/merge', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

/** POST /customers/merge/{logId}/undo. */
export function useUndoMerge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) =>
      unwrap(api.POST('/customers/merge/{logId}/undo', { params: { path: { logId } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}
