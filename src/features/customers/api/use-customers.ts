import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
