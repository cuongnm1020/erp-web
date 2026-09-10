import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type SalesOrder = components['schemas']['SalesOrderHeaderDto'];
export type SalesOrderDetail = components['schemas']['SalesOrderDetailDto'];
export type SalesOrderLine = components['schemas']['SalesOrderLineDto'];
export type SalesOrderListResponse = components['schemas']['SalesOrderListResponseDto'];
export type ShippingQuote = components['schemas']['ShippingQuoteResultDto'];
export type PickupWarehouse = components['schemas']['PickupWarehouseDto'];
export type SalesOrderStatus = SalesOrder['status'];
export type SalesOrderChannel = SalesOrder['channel'];

export interface OrderListParams {
  q?: string;
  status?: SalesOrderStatus;
  customerId?: string;
  /** Cân nặng gửi hãng hiệu lực (kg, chuỗi decimal) — cận dưới / cận trên. */
  weightMin?: string;
  weightMax?: string;
  /** true = chỉ đơn chưa chọn hãng. */
  noCarrier?: boolean;
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
  shippingQuote: (id: string, carrierId: string | null, warehouseId: string | null) =>
    [...orderKeys.detail(id), 'shipping-quote', carrierId, warehouseId] as const,
  pickupWarehouses: () => [...orderKeys.all, 'pickup-warehouses'] as const,
};

/**
 * GET /sales-orders — đã scope sẵn theo khách hàng ở API (bất biến 8, luật 7).
 * API sắp cố định `orderDate` giảm dần và KHÔNG nhận tham số sort, nên không cột nào
 * được đánh `sortable`: hứa sort rồi không sort được còn tệ hơn là không hứa.
 */
export function useOrders(params: OrderListParams) {
  return useQuery({ ...orderListQuery(params), placeholderData: keepPreviousData });
}

/** Key + fetcher của GET /sales-orders — dùng chung cho useOrders và tra cứu một lần (quét mã). */
export function orderListQuery(params: OrderListParams) {
  return {
    queryKey: orderKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders', {
          params: {
            query: {
              q: params.q || undefined,
              status: params.status,
              customerId: params.customerId || undefined,
              weightMin: params.weightMin || undefined,
              weightMax: params.weightMax || undefined,
              noCarrier: params.noCarrier ? 'true' : undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
  };
}

/**
 * Tra một đơn theo số chứng từ gõ/quét vào (dialog "Gửi sang ĐVVC" thêm đơn ngoài trang hiện
 * tại). Đi qua cache của TanStack Query (luật 3) — không fetch trong component.
 */
export function useOrderLookup() {
  const qc = useQueryClient();
  return async (docNumber: string): Promise<SalesOrder | null> => {
    const q = docNumber.trim();
    if (!q) return null;
    const res = await qc.fetchQuery({ ...orderListQuery({ q, take: 10, skip: 0 }), staleTime: 0 });
    return res.items.find((o) => o.docNumber.toLowerCase() === q.toLowerCase()) ?? null;
  };
}

export type ShippingOptions = components['schemas']['ShippingOptionsDto'];
export type SendOrdersToCarrierBody = components['schemas']['SendOrdersToCarrierDto'];
export type SendOrdersToCarrierResult = components['schemas']['SendOrdersToCarrierResultDto'];
export type SendOrderToCarrierItem = components['schemas']['SendOrderToCarrierItemDto'];

/**
 * POST /sales-orders/send-to-carrier — "Gửi sang ĐVVC": một hãng + một bộ tuỳ chọn gửi hãng
 * cho nhiều đơn. Đơn đã pick thì hãng cấp vận đơn ngay (ISSUED / QUEUED), đơn chưa pick →
 * SAVED (cấp lúc đóng gói). Không optimistic (luật 5); gọi lại cùng lô là an toàn (server
 * không cấp vận đơn lần hai).
 */
export function useSendOrdersToCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendOrdersToCarrierBody) =>
      unwrap(api.POST('/sales-orders/send-to-carrier', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
      void qc.invalidateQueries({ queryKey: orderKeys.details() });
    },
  });
}

export type BulkUpdateOrdersBody = components['schemas']['BulkUpdateOrdersDto'];
export type BulkUpdateOrdersResult = components['schemas']['BulkUpdateOrdersResultDto'];

/**
 * POST /sales-orders/bulk-update — gán hãng / đặt cân nặng gửi hãng cho nhiều đơn chọn trên
 * danh sách. Server sửa từng đơn một transaction; đơn hỏng (đã chốt/hủy, ngoài scope) về
 * trong `failed`, phần còn lại vẫn lưu. Không optimistic (luật 5).
 */
export function useBulkUpdateOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkUpdateOrdersBody) =>
      unwrap(api.POST('/sales-orders/bulk-update', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
      void qc.invalidateQueries({ queryKey: orderKeys.details() });
    },
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

export type CreateOrderBody = components['schemas']['CreateOrderDto'];
export type CreateOrderResult = components['schemas']['CreateOrderResultDto'];

/**
 * POST /sales-orders — giá do server chốt qua core.resolve_price(), client không gửi giá.
 * Idempotency-Key sinh LÚC BẤM (luật 4), giữ nguyên khi retry; server dedupe 24h qua Redis.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateOrderBody; key: string }) =>
      unwrap(
        api.POST('/sales-orders', {
          params: { header: { 'idempotency-key': key } },
          headers: idempotency(key),
          body,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/**
 * POST /sales-orders/{id}/cancel — hủy được từ mọi trạng thái trừ CANCELLED (server giữ luật
 * chuyển trạng thái); server tự nhả reservation. Không optimistic (luật 5: đụng tồn kho).
 */
export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason?: string }) =>
      unwrap(api.POST('/sales-orders/{id}/cancel', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

export type UpdateOrderBody = components['schemas']['UpdateOrderDto'];
export type UpdateOrderResult = components['schemas']['UpdateOrderResultDto'];

/**
 * PATCH /sales-orders/{id} — sửa trạng thái + hãng vận chuyển (quyền `sales_order.update`).
 * Server giữ máy trạng thái chứng từ và quyền theo đích (approve/post/cancel); client chỉ
 * hiện đúng các đích được phép (labels.ts `manualStatusTargets`). Không optimistic:
 * chuyển trạng thái đụng reservation / task kho (luật 5).
 */
export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrderBody) =>
      unwrap(api.PATCH('/sales-orders/{id}', { params: { path: { id } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/**
 * GET /sales-orders/{id}/shipping-quote?carrierId= — cước hãng báo cho đơn này với hãng đang
 * chọn trên màn sửa (gọi hãng thật, chỉ đọc). `carrierId` null = chưa chọn → không gọi.
 * Không retry: hãng lỗi (502) hay đơn thiếu địa chỉ (422) thì hiện thông điệp, gọi lại vô ích.
 */
export function useShippingQuote(
  orderId: string,
  carrierId: string | null,
  warehouseId: string | null,
) {
  return useQuery({
    queryKey: orderKeys.shippingQuote(orderId, carrierId, warehouseId),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders/{id}/shipping-quote', {
          params: {
            path: { id: orderId },
            query: { carrierId: carrierId as string, ...(warehouseId ? { warehouseId } : {}) },
          },
        }),
      ),
    enabled: carrierId !== null,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * GET /pickup-warehouses — kho chọn được làm KHO LẤY HÀNG trên đơn (quyền đơn bán, không cần
 * stock.read như GET /warehouses). Danh mục ít đổi → cache 10 phút.
 */
export function usePickupWarehouses() {
  return useQuery({
    queryKey: orderKeys.pickupWarehouses(),
    queryFn: () => unwrap(api.GET('/pickup-warehouses')),
    staleTime: 10 * 60_000,
  });
}
