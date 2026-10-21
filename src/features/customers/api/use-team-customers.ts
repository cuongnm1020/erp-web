import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/** CSKH (2026-10-21, docs/PLAN-cskh.md §3.7) — khách được gán cho team CSKH. */
export type TeamCustomer = components['schemas']['TeamCustomerDto'];
export type TeamCustomerList = components['schemas']['TeamCustomerListDto'];

export interface TeamCustomersParams {
  /** Ngày gán từ / đến (YYYY-MM-DD giờ VN); bỏ trống cả hai = mọi lúc. */
  assignedFrom?: string;
  assignedTo?: string;
  q?: string;
  take: number;
  skip: number;
}

export const teamCustomerKeys = {
  all: () => [...customerKeys.all, 'team'] as const,
  list: (p: TeamCustomersParams) => [...teamCustomerKeys.all(), 'list', p] as const,
};

/** GET /customer-care/customers — khách của team CSKH người xem, mới gán trước (API đã scope). */
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
