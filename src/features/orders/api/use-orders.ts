import type { EntitySearchResult } from '@/components/data/form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
/**
 * Một đơn trên danh sách (GET /sales-orders) — `SalesOrderListItemDto` là header của đơn cộng các
 * trường của màn Quản lý đơn hàng (2026-10-12); spec không còn tách riêng `SalesOrderHeaderDto`.
 */
export type SalesOrder = components['schemas']['SalesOrderListItemDto'];
export type SalesOrderDetail = components['schemas']['SalesOrderDetailDto'];
export type SalesOrderLine = components['schemas']['SalesOrderLineDto'];
export type SalesOrderListResponse = components['schemas']['SalesOrderListResponseDto'];
export type ShippingQuote = components['schemas']['ShippingQuoteResultDto'];
export type PickupWarehouse = components['schemas']['PickupWarehouseDto'];
export type SalesOrderStatus = SalesOrder['status'];
export type SalesOrderChannel = SalesOrder['channel'];
/** Một dòng danh sách đơn — header + SĐT, địa chỉ, sản phẩm đầu, phiếu giao, tab (2026-10-12). */
export type SalesOrderListItem = SalesOrder;
export type OrderFlow = SalesOrderListItem['flow'];
export type OrderFlowCounts = components['schemas']['SalesOrderFlowCountsDto'];

export interface OrderListParams {
  q?: string;
  /** Tab của danh sách (gộp trạng thái chứng từ + kho / giao hàng). */
  flow?: OrderFlow;
  /** Kho lấy hàng chọn trên đơn. */
  warehouseId?: string;
  /** Nguồn: PANCAKE = đồng bộ từ Pancake, ERP = tạo trong ERP. */
  source?: 'PANCAKE' | 'ERP';
  /** Chỉ đơn của một POS Pancake (mã shop) — danh sách POS: usePancakeShops. */
  pancakeShopId?: string;
  status?: SalesOrderStatus;
  customerId?: string;
  /** Cân nặng gửi hãng hiệu lực (kg, chuỗi decimal) — cận dưới / cận trên. */
  weightMin?: string;
  weightMax?: string;
  /** true = chỉ đơn chưa chọn hãng. */
  noCarrier?: boolean;
  /** Đơn đã gán hãng này (wms.Carrier.id). */
  carrierId?: string;
  /** true = chỉ đơn có đơn trùng trong ngày (cùng SĐT, cùng ngày VN, chưa hủy — CSKH-5). */
  duplicate?: boolean;
  /** Khoảng orderDate — ngày `YYYY-MM-DD` (server lấy trọn ngày VN) hoặc ISO datetime. */
  from?: string;
  to?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['crm','orders','list', params] / ['crm','orders','detail', id]. */
export const orderKeys = {
  all: ['crm', 'orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (p: OrderListParams) => [...orderKeys.lists(), p] as const,
  /** Đếm tab nằm dưới prefix `lists` — invalidate danh sách là đếm lại luôn. */
  flowCounts: (p: Omit<OrderListParams, 'flow' | 'take' | 'skip'>) =>
    [...orderKeys.lists(), 'flow-counts', p] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  shippingQuote: (
    id: string,
    carrierId: string | null,
    warehouseId: string | null,
    addressId: string | null = null,
  ) => [...orderKeys.detail(id), 'shipping-quote', carrierId, warehouseId, addressId] as const,
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
            query: { ...listQuery(params), take: params.take, skip: params.skip },
          },
        }),
      ),
  };
}

/** Bộ lọc chung của danh sách + đếm tab (không gồm phân trang). */
function listQuery(params: Omit<OrderListParams, 'take' | 'skip'>) {
  return {
    q: params.q || undefined,
    flow: params.flow,
    warehouseId: params.warehouseId || undefined,
    source: params.source,
    pancakeShopId: params.pancakeShopId || undefined,
    status: params.status,
    customerId: params.customerId || undefined,
    weightMin: params.weightMin || undefined,
    weightMax: params.weightMax || undefined,
    noCarrier: params.noCarrier ? ('true' as const) : undefined,
    carrierId: params.carrierId || undefined,
    duplicate: params.duplicate ? ('true' as const) : undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
}

/**
 * GET /sales-orders/flow-counts — số đơn từng tab với cùng bộ lọc (server bỏ qua `flow`). Scope
 * theo người gọi ở API như danh sách (luật 7).
 */
export type PancakeShopOption = components['schemas']['PancakeShopOptionDto'];

/**
 * GET /pancake-sync/shops — POS Pancake để lọc đơn (mã + tên, không khoá). Quyền xem đơn là đủ;
 * danh mục ít đổi nên giữ 5 phút.
 */
export function usePancakeShops() {
  return useQuery({
    queryKey: [...orderKeys.all, 'pancake-shops'] as const,
    queryFn: () => unwrap(api.GET('/pancake-sync/shops')),
    staleTime: 5 * 60_000,
  });
}

/**
 * Tìm POS đã liên kết (đang bật) cho ô chọn POS trên màn tạo đơn — danh mục nhỏ nên lọc theo tên /
 * mã ngay trên danh sách GET /pancake-sync/shops đã cache.
 */
export function usePosShopSearch(q: string): EntitySearchResult {
  const shops = usePancakeShops();
  const term = q.trim().toLowerCase();
  return {
    options: shops.data
      ?.filter((s) => s.isActive)
      .filter(
        (s) =>
          term === '' || s.shopId.includes(term) || (s.shopName ?? '').toLowerCase().includes(term),
      )
      .map((s) => ({ id: s.shopId, label: s.shopName ?? `POS ${s.shopId}`, hint: s.shopId })),
    isPending: shops.isPending,
    error: shops.error,
  };
}

export function useOrderFlowCounts(params: Omit<OrderListParams, 'flow' | 'take' | 'skip'>) {
  return useQuery({
    queryKey: orderKeys.flowCounts(params),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders/flow-counts', {
          // take / skip vô nghĩa với đếm — spec vẫn đòi vì dùng chung DTO lọc với danh sách.
          params: { query: { ...listQuery(params), take: 1, skip: 0 } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
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

export type BulkCancelOrdersBody = components['schemas']['BulkCancelOrdersDto'];

/**
 * POST /sales-orders/bulk-cancel — hủy các đơn chọn trên danh sách, cùng một lý do. Server hủy
 * từng đơn (nhả giữ chỗ), đơn không hủy được về `failed`. Không optimistic (luật 5: đụng tồn).
 */
export function useBulkCancelOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkCancelOrdersBody) =>
      unwrap(api.POST('/sales-orders/bulk-cancel', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
      void qc.invalidateQueries({ queryKey: orderKeys.details() });
    },
  });
}

export type BulkFulfilOrdersResult = components['schemas']['BulkFulfilOrdersResultDto'];

/**
 * POST /sales-orders/bulk-fulfil — "Đóng gói + in vận đơn" trên danh sách (quyền
 * `sales_order.fulfil_manual`): mỗi đơn như "Đã đóng gói" trên màn sửa — trừ tồn + xin vận đơn.
 * Không retry (mỗi lần gọi hãng là vận đơn thật); server tự idempotent.
 */
export function useBulkFulfilOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) =>
      unwrap(api.POST('/sales-orders/bulk-fulfil', { body: { orderIds } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
      void qc.invalidateQueries({ queryKey: orderKeys.details() });
    },
  });
}

export type MoveOrdersWarehouseBody = components['schemas']['MoveOrdersWarehouseDto'];
export type MoveOrdersWarehouseResult = components['schemas']['MoveOrdersWarehouseResultDto'];

/**
 * POST /sales-orders/move-warehouse — chuyển đơn sang kho khác (PLAN-warehouse-context K3). Chỉ
 * đơn chưa ai bắt đầu lấy hàng; đơn lỗi nằm trong `failed`, lô không rollback.
 */
export function useMoveOrdersWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MoveOrdersWarehouseBody) =>
      unwrap(api.POST('/sales-orders/move-warehouse', { body })),
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
  /** Địa chỉ giao đang chọn trên màn sửa (chưa lưu); null = địa chỉ hiệu lực của đơn. */
  addressId: string | null = null,
) {
  return useQuery({
    queryKey: orderKeys.shippingQuote(orderId, carrierId, warehouseId, addressId),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders/{id}/shipping-quote', {
          params: {
            path: { id: orderId },
            query: {
              carrierId: carrierId as string,
              ...(warehouseId ? { warehouseId } : {}),
              ...(addressId ? { addressId } : {}),
            },
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

export type FulfilOrderBody = components['schemas']['FulfilOrderDto'];
export type FulfilOrderResult = components['schemas']['FulfilOrderResultDto'];

/**
 * POST /sales-orders/{id}/fulfil — "Đã pick xong" / "Đã đóng gói" TAY từ màn sửa đơn (quyền
 * `sales_order.fulfil_manual`). PACKED trừ tồn + xin vận đơn hãng đã chọn trên đơn → không
 * optimistic (luật 5), không retry (mỗi lần gọi hãng là một vận đơn thật); server tự idempotent.
 */
export function useFulfilOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FulfilOrderBody) =>
      unwrap(api.POST('/sales-orders/{id}/fulfil', { params: { path: { id } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
