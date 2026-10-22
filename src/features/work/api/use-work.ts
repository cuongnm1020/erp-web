import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type {
  CreateWorkCategoryBody,
  CreateWorkItemBody,
  UpdateWorkCalendarBody,
  UpdateWorkCategoryBody,
  UpdateWorkItemBody,
  UpdateWorkSlaBody,
  WorkChecklistInput,
  WorkListQuery,
} from './types';

/**
 * Hook module Công việc (docs/PLAN-ticket-sla.md §6–§7). Key theo phễu (luật 3):
 * ['work','items','list',params] · ['work','items','detail',id] · ['work','items','counts'] …
 * Mọi thao tác trên một việc invalidate cả nhánh ['work','items'] (danh sách, đếm, chi tiết đều
 * đổi theo trạng thái / hạn) — không vá cache tay.
 */
export const workKeys = {
  all: ['work'] as const,
  items: () => [...workKeys.all, 'items'] as const,
  list: (p: WorkListQuery) => [...workKeys.items(), 'list', p] as const,
  detail: (id: string) => [...workKeys.items(), 'detail', id] as const,
  counts: () => [...workKeys.items(), 'counts'] as const,
  assignees: (deptId?: string) => [...workKeys.items(), 'assignees', deptId ?? null] as const,
  workload: (deptId?: string) => [...workKeys.items(), 'workload', deptId ?? null] as const,
  notifications: () => [...workKeys.items(), 'notifications'] as const,
  config: () => [...workKeys.all, 'config'] as const,
  categories: (kind?: 'CUSTOMER' | 'INTERNAL') =>
    [...workKeys.all, 'categories', kind ?? null] as const,
  reports: () => [...workKeys.all, 'reports'] as const,
};

/** Tự tải lại danh sách / đếm 30 giây (chưa có realtime cho module này — PLAN §5). */
export const WORK_REFETCH_MS = 30_000;

export function useWorkList(params: WorkListQuery, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: workKeys.list(params),
    queryFn: () => unwrap(api.GET('/work-items', { params: { query: params } })),
    placeholderData: keepPreviousData,
    refetchInterval: WORK_REFETCH_MS,
    enabled: opts.enabled ?? true,
  });
}

export function useWorkCounts(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: workKeys.counts(),
    queryFn: () => unwrap(api.GET('/work-items/counts')),
    refetchInterval: WORK_REFETCH_MS,
    enabled: opts.enabled ?? true,
  });
}

export function useWorkItem(id: string) {
  return useQuery({
    queryKey: workKeys.detail(id),
    queryFn: () => unwrap(api.GET('/work-items/{id}', { params: { path: { id } } })),
    enabled: !!id,
  });
}

export function useWorkAssignees(deptId?: string, enabled = true) {
  return useQuery({
    queryKey: workKeys.assignees(deptId),
    queryFn: () =>
      unwrap(api.GET('/work-items/assignees', { params: { query: deptId ? { deptId } : {} } })),
    enabled,
  });
}

export function useWorkWorkload(deptId?: string, enabled = true) {
  return useQuery({
    queryKey: workKeys.workload(deptId),
    queryFn: () =>
      unwrap(api.GET('/work-items/workload', { params: { query: deptId ? { deptId } : {} } })),
    refetchInterval: WORK_REFETCH_MS,
    enabled,
  });
}

export function useWorkNotifications(enabled = true) {
  return useQuery({
    queryKey: workKeys.notifications(),
    queryFn: () => unwrap(api.GET('/work-items/notifications')),
    refetchInterval: WORK_REFETCH_MS,
    enabled,
  });
}

/** POST /work-items — Idempotency-Key sinh LÚC BẤM (luật 4), giữ nguyên khi retry. */
export function useCreateWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateWorkItemBody; key: string }) =>
      unwrap(
        api.POST('/work-items', {
          params: { header: { 'idempotency-key': key } },
          headers: idempotency(key),
          body,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useUpdateWork(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkItemBody) =>
      unwrap(api.PATCH('/work-items/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

/** Các thao tác POST /work-items/{id}/<action> — một hook cho cả luồng. */
export type WorkActionPath =
  | 'claim'
  | 'assign'
  | 'reply'
  | 'note'
  | 'wait'
  | 'resume'
  | 'resolve'
  | 'reopen'
  | 'close'
  | 'confirm'
  | 'cancel'
  | 'start'
  | 'submit'
  | 'approve'
  | 'rework'
  | 'extension'
  | 'extension/decision'
  | 'watchers'
  | 'checklist';

export function useWorkAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      body = {},
    }: {
      action: WorkActionPath;
      body?: Record<string, unknown>;
    }) =>
      unwrap(
        // openapi-fetch: đường dẫn ghép theo action — mỗi action là một path đã khai trong schema.
        api.POST(`/work-items/{id}/${action}` as '/work-items/{id}/claim', {
          params: { path: { id } },
          body: body as never,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useUpdateChecklistItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      body,
    }: {
      itemId: string;
      body: { done?: boolean; title?: string; note?: string | null };
    }) =>
      unwrap(
        api.PATCH('/work-items/{id}/checklist/{itemId}', {
          params: { path: { id, itemId } },
          body,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useRemoveChecklistItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      unwrap(
        api.DELETE('/work-items/{id}/checklist/{itemId}', { params: { path: { id, itemId } } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useAddChecklist(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: WorkChecklistInput[]) =>
      unwrap(api.POST('/work-items/{id}/checklist', { params: { path: { id } }, body: { items } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useUploadWorkAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return unwrap(
        api.POST('/work-items/{id}/attachments', {
          params: { path: { id } },
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
        }),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.detail(id) }),
  });
}

export function useBulkAssignWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      ids: string[];
      assigneeId?: string | null;
      ownerDeptId?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      note?: string;
    }) => unwrap(api.POST('/work-items/bulk-assign', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

export function useReassignWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      ids: string[];
      assigneeId: string;
      reason: string;
      extendWorkdays?: number;
      keepPreviousAsWatcher?: boolean;
    }) => unwrap(api.POST('/work-items/reassign', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.items() }),
  });
}

// ── Cấu hình ───────────────────────────────────────────────────────────

export function useWorkConfig(enabled = true) {
  return useQuery({
    queryKey: workKeys.config(),
    queryFn: () => unwrap(api.GET('/work-config')),
    enabled,
  });
}

export function useWorkCategories(kind?: 'CUSTOMER' | 'INTERNAL') {
  return useQuery({
    queryKey: workKeys.categories(kind),
    queryFn: () =>
      unwrap(api.GET('/work-config/categories', { params: { query: kind ? { kind } : {} } })),
    staleTime: 60_000,
  });
}

function useConfigMutation<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: workKeys.all }),
  });
}

export function useCreateWorkCategory() {
  return useConfigMutation((body: CreateWorkCategoryBody) =>
    unwrap(api.POST('/work-config/categories', { body })),
  );
}

export function useUpdateWorkCategory() {
  return useConfigMutation(({ id, body }: { id: string; body: UpdateWorkCategoryBody }) =>
    unwrap(api.PATCH('/work-config/categories/{id}', { params: { path: { id } }, body })),
  );
}

export function useDeleteWorkCategory() {
  return useConfigMutation((id: string) =>
    unwrap(api.DELETE('/work-config/categories/{id}', { params: { path: { id } } })),
  );
}

export function useUpdateWorkSla() {
  return useConfigMutation((body: UpdateWorkSlaBody) =>
    unwrap(api.PUT('/work-config/sla', { body })),
  );
}

export function useUpdateWorkCalendar() {
  return useConfigMutation((body: UpdateWorkCalendarBody) =>
    unwrap(api.PUT('/work-config/calendar', { body })),
  );
}

export function useAddWorkHoliday() {
  return useConfigMutation((body: { date: string; toDate?: string; name: string }) =>
    unwrap(api.POST('/work-config/holidays', { body })),
  );
}

export function useRemoveWorkHoliday() {
  return useConfigMutation((date: string) =>
    unwrap(api.DELETE('/work-config/holidays/{date}', { params: { path: { date } } })),
  );
}

// ── Báo cáo ────────────────────────────────────────────────────────────

export interface WorkReportParams {
  from?: string;
  to?: string;
  deptId?: string;
  categoryId?: string;
}

export function useWorkRequestReport(p: WorkReportParams, enabled = true) {
  return useQuery({
    queryKey: [...workKeys.reports(), 'requests', p] as const,
    queryFn: () => unwrap(api.GET('/reports/work/requests', { params: { query: p } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useWorkTaskReport(p: WorkReportParams, enabled = true) {
  return useQuery({
    queryKey: [...workKeys.reports(), 'tasks', p] as const,
    queryFn: () => unwrap(api.GET('/reports/work/tasks', { params: { query: p } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ── Tra cứu cho màn Tạo việc (khách / đơn) ─────────────────────────────

/** GET /customer-care/lookup — tra SĐT toàn hệ thống (CSKH tiếp nhận yêu cầu khách). */
export function useWorkCustomerLookup(phone: string) {
  const p = phone.replace(/\D/g, '');
  return useQuery({
    queryKey: [...workKeys.all, 'customer-lookup', p] as const,
    queryFn: () => unwrap(api.GET('/customer-care/lookup', { params: { query: { phone: p } } })),
    enabled: p.length >= 9,
    staleTime: 30_000,
  });
}

/** GET /customers/{id} — điền sẵn khách khi mở Tạo việc từ hồ sơ khách / mục checklist. */
export function useWorkCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [...workKeys.all, 'customer', id ?? null] as const,
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

/** 10 đơn gần nhất của khách (trong phạm vi người xem) cho ô "Đơn liên quan". */
export function useWorkCustomerOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: [...workKeys.all, 'customer-orders', customerId ?? null] as const,
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders', {
          params: { query: { customerId: customerId!, take: 10, skip: 0 } },
        }),
      ),
    enabled: !!customerId,
  });
}
