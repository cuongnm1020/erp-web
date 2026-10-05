import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/** CRM-05 — dòng của GET /customers/{id}/orders. */
export type CustomerOrderItem = components['schemas']['CustomerOrderItemDto'];
export type CustomerOrderList = components['schemas']['CustomerOrderListDto'];
/** CRM-05 — GET /customers/{id}/stats (mọi thời điểm, đơn APPROVED / POSTED). */
export type CustomerSalesStats = components['schemas']['CustomerSalesStatsDto'];
export type CustomerTopSku = components['schemas']['CustomerTopSkuDto'];
export type CustomerOrderStatus = NonNullable<
  NonNullable<paths['/customers/{id}/orders']['get']['parameters']['query']>['status']
>;

export interface CustomerOrderParams {
  status?: CustomerOrderStatus;
  /** YYYY-MM-DD theo ngày VN, bao gồm hai đầu. */
  from?: string;
  to?: string;
  take: number;
  skip: number;
}

/**
 * Key nằm dưới detail(id) → invalidate hồ sơ (prefix) kéo theo lịch sử mua hàng của khách đó:
 * ['crm','customers','detail',id,'orders',params] / [...,'stats'].
 */
export const customerSalesKeys = {
  orders: (id: string) => [...customerKeys.detail(id), 'orders'] as const,
  orderList: (id: string, p: CustomerOrderParams) => [...customerSalesKeys.orders(id), p] as const,
  stats: (id: string) => [...customerKeys.detail(id), 'stats'] as const,
};

/** GET /customers/{id}/orders — mới nhất trước; khách ngoài scope → 404. */
export function useCustomerOrders(id: string, params: CustomerOrderParams) {
  return useQuery({
    queryKey: customerSalesKeys.orderList(id, params),
    queryFn: () =>
      unwrap(
        api.GET('/customers/{id}/orders', {
          params: {
            path: { id },
            query: {
              status: params.status,
              from: params.from || undefined,
              to: params.to || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /customers/{id}/stats — chỉ số mọi thời điểm, không theo bộ lọc của bảng đơn. */
export function useCustomerStats(id: string) {
  return useQuery({
    queryKey: customerSalesKeys.stats(id),
    queryFn: () => unwrap(api.GET('/customers/{id}/stats', { params: { path: { id } } })),
  });
}
