import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/schema';

export type Customer = components['schemas']['CustomerDto'];
export type CustomerListResponse = components['schemas']['CustomerListResponseDto'];

/** Cột được API cho phép sắp — lấy thẳng từ union trong schema.d.ts, không tự liệt kê. */
export type CustomerSortBy = NonNullable<
  NonNullable<paths['/customers']['get']['parameters']['query']>['sortBy']
>;
export type CustomerSortDir = NonNullable<
  NonNullable<paths['/customers']['get']['parameters']['query']>['sortDir']
>;

export interface CustomerListParams {
  q?: string;
  sortBy?: CustomerSortBy;
  sortDir?: CustomerSortDir;
  /** P2-04 — lọc cho màn Phân công; API luôn AND với scope của người gọi. */
  teamId?: string;
  ownerId?: string;
  /** true = chưa có người phụ trách (ownerIds rỗng); false = đã phân. */
  unassigned?: boolean;
  isActive?: boolean;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['crm','customers','list', params]. */
export const customerKeys = {
  all: ['crm', 'customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (p: CustomerListParams) => [...customerKeys.lists(), p] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

/**
 * GET /customers — đã scope sẵn ở API (luật 7: không lọc lại ở frontend).
 * Sắp xếp chạy phía server qua `sortBy`/`sortDir`; bỏ trống thì API dùng `name` tăng dần.
 */
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/customers', {
          params: {
            query: {
              q: params.q || undefined,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              teamId: params.teamId,
              ownerId: params.ownerId,
              unassigned: params.unassigned,
              isActive: params.isActive,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

const SORTABLE: readonly CustomerSortBy[] = [
  'name',
  'code',
  'type',
  'creditLimit',
  'createdAt',
  'updatedAt',
];

/** SortState trên URL → tham số API. Cột lạ (do dán link tay) bị bỏ qua, không gửi lên. */
export function toCustomerSort(sort: { id: string; desc: boolean } | null): {
  sortBy?: CustomerSortBy;
  sortDir?: CustomerSortDir;
} {
  if (!sort || !(SORTABLE as readonly string[]).includes(sort.id)) return {};
  return { sortBy: sort.id as CustomerSortBy, sortDir: sort.desc ? 'desc' : 'asc' };
}

/** GET /customers/{id} — 404 khi ngoài scope (backend không phân biệt "không có" và "không thấy"). */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

export type CreateCustomerInput = components['schemas']['CreateCustomerDto'];
export type UpdateCustomerInput = components['schemas']['UpdateCustomerDto'];

/** POST /customers — trả CustomerDto để điều hướng thẳng vào hồ sơ vừa tạo. */
export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => unwrap(api.POST('/customers', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

/**
 * PATCH /customers/{id} — body chỉ chứa field thay đổi (UpdateCustomerDto, mọi field optional).
 * Không optimistic (luật 5: creditLimit/paymentTerm là dữ liệu công nợ) — chờ server rồi invalidate.
 */
export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) =>
      unwrap(api.PATCH('/customers/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.lists() });
      void qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
    },
  });
}

/**
 * DELETE /customers/{id} — soft delete: KH chuyển Ngừng hợp tác, dữ liệu và lịch sử giữ nguyên
 * (dòng vẫn nằm trong danh sách với trạng thái Ngừng). Không optimistic (luật 5: dữ liệu công nợ).
 */
export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/customers/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: customerKeys.lists() });
      void qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
    },
  });
}
