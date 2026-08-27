import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type SalesOrder = components['schemas']['SalesOrderHeaderDto'];
export type SalesOrderDetail = components['schemas']['SalesOrderDetailDto'];
export type SalesOrderLine = components['schemas']['SalesOrderLineDto'];
export type SalesOrderListResponse = components['schemas']['SalesOrderListResponseDto'];
export type SalesOrderStatus = SalesOrder['status'];
export type SalesOrderChannel = SalesOrder['channel'];

export interface OrderListParams {
  q?: string;
  status?: SalesOrderStatus;
  customerId?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['crm','orders','list', params] / ['crm','orders','detail', id]. */
export const orderKeys = {
  all: ['crm', 'orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (p: OrderListParams) => [...orderKeys.lists(), p] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

/**
 * GET /sales-orders — đã scope sẵn theo khách hàng ở API (bất biến 8, luật 7).
 * API sắp cố định `orderDate` giảm dần và KHÔNG nhận tham số sort, nên không cột nào
 * được đánh `sortable`: hứa sort rồi không sort được còn tệ hơn là không hứa.
 */
export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders', {
          params: {
            query: {
              q: params.q || undefined,
              status: params.status,
              customerId: params.customerId || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /sales-orders/{id} — 404 khi đơn thuộc khách ngoài scope của người đang xem. */
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => unwrap(api.GET('/sales-orders/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}
