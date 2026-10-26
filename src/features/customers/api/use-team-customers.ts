import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { EntityOption, EntitySearchResult } from '@/components/data/form/entity-picker';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/** CSKH (2026-10-21, docs/PLAN-cskh.md §3.7; 2026-10-26 biên bản CSKH) — khách của team CSKH. */
export type TeamCustomer = components['schemas']['TeamCustomerDto'];
export type TeamCustomerList = components['schemas']['TeamCustomerListDto'];

export interface TeamCustomersParams {
  /** Ngày gán từ / đến (YYYY-MM-DD giờ VN); bỏ trống cả hai = mọi lúc. */
  assignedFrom?: string;
  assignedTo?: string;
  /** Khoảng tính doanh thu / số đơn (YYYY-MM-DD giờ VN); bỏ trống = mọi lúc. */
  from?: string;
  to?: string;
  sort?: 'lastOrder' | 'revenue';
  top?: number;
  purposeIds?: string[];
  skuIds?: string[];
  q?: string;
  take: number;
  skip: number;
}

export const teamCustomerKeys = {
  all: () => [...customerKeys.all, 'team'] as const,
  list: (p: TeamCustomersParams) => [...teamCustomerKeys.all(), 'list', p] as const,
  skuSearch: (q: string) => [...teamCustomerKeys.all(), 'sku-search', q] as const,
};

const csv = (ids?: string[]) => (ids && ids.length ? ids.join(',') : undefined);

/** GET /customer-care/customers — khách của team CSKH người xem (API đã scope). */
export function useTeamCustomers(params: TeamCustomersParams) {
  return useQuery({
    queryKey: teamCustomerKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/customer-care/customers', {
          params: {
            query: {
              assignedFrom: params.assignedFrom,
              assignedTo: params.assignedTo,
              from: params.from,
              to: params.to,
              sort: params.sort,
              top: params.top,
              purposeIds: csv(params.purposeIds),
              skuIds: csv(params.skuIds),
              q: params.q || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Ô "Đã mua sản phẩm" — tìm SKU đang bán (không combo). */
export function useTeamSkuSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: teamCustomerKeys.skuSearch(q),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: {
            query: { q: q || undefined, status: 'active', isCombo: false, take: 20, skip: 0 },
          },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items.map((s) => ({
    id: s.skuId,
    label: s.name,
    hint: s.code,
  }));
  return { options, isPending: query.isPending, error: query.error };
}
