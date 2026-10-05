import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/schema';

/**
 * Hook riêng của dashboard (RPT-08). Luật 12 cấm import `features/reports` / `features/wms`, luật 3
 * bắt mọi truy cập API nằm trong `features/<mod>/api/` → không nâng hook lên `lib/`. Đây chỉ là
 * lớp bọc mỏng quanh client sinh sẵn; shape vẫn lấy từ schema.d.ts (luật 2), không khai lại.
 * Key có tiền tố riêng ['dashboard', …] — cache độc lập với màn báo cáo, không ai invalidate chéo.
 */
export type SalesSummary = components['schemas']['SalesSummaryDto'];
export type SalesKpis = components['schemas']['SalesKpisDto'];
export type SalesTimeseries = components['schemas']['SalesTimeseriesDto'];
export type SalesTopProducts = components['schemas']['SalesTopProductsDto'];
export type SalesOrderList = components['schemas']['SalesOrderListResponseDto'];
export type ShipmentMonitorSummary = components['schemas']['ShipmentMonitorSummaryDto'];
type TopRankBy = paths['/reports/sales/top-products']['get']['parameters']['query']['rankBy'];

/** Khoảng ngày YYYY-MM-DD giờ VN, gồm cả hai đầu. */
export interface DayRange {
  from: string;
  to: string;
}

/** Số liệu bảng tổng hợp cập nhật mỗi 5 phút — dashboard để ngoài lâu không cần gọi lại liên tục. */
const STALE_MS = 60_000;
/** Ô giao hàng: cùng nhịp tự làm mới với màn theo dõi giao hàng. */
const SHIPPING_REFRESH_MS = 60_000;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  salesSummary: (r: DayRange) => [...dashboardKeys.all, 'sales', 'summary', r] as const,
  salesTimeseries: (r: DayRange) => [...dashboardKeys.all, 'sales', 'timeseries', r] as const,
  salesTop: (r: DayRange, rankBy: TopRankBy, limit: number) =>
    [...dashboardKeys.all, 'sales', 'top-products', r, rankBy, limit] as const,
  pendingOrders: (take: number) => [...dashboardKeys.all, 'orders', 'pending', take] as const,
  shipping: (date: string, holdDays: number) =>
    [...dashboardKeys.all, 'shipping', 'summary', date, holdDays] as const,
};

/** GET /reports/sales/summary (report.sales) — KPI khoảng + kỳ trước cùng độ dài, API scope theo D-CR2. */
export function useDashboardSalesSummary(r: DayRange, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.salesSummary(r),
    queryFn: () =>
      unwrap(api.GET('/reports/sales/summary', { params: { query: { from: r.from, to: r.to } } })),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** GET /reports/sales/timeseries theo ngày — kèm điểm kỳ trước để vẽ đường so sánh. */
export function useDashboardSalesTimeseries(r: DayRange, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.salesTimeseries(r),
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/timeseries', {
          params: { query: { from: r.from, to: r.to, granularity: 'day' } },
        }),
      ),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** GET /reports/sales/top-products — top N SKU. */
export function useDashboardTopProducts(
  r: DayRange,
  rankBy: TopRankBy,
  limit: number,
  enabled: boolean,
) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.salesTop(r, rankBy, limit),
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/top-products', {
          params: { query: { from: r.from, to: r.to, rankBy, limit } },
        }),
      ),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** GET /sales-orders?status=PENDING_APPROVAL (sales_order.read) — API scope theo khách được phân. */
export function useDashboardPendingOrders(take: number, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.pendingOrders(take),
    queryFn: () =>
      unwrap(
        api.GET('/sales-orders', {
          params: { query: { status: 'PENDING_APPROVAL', take, skip: 0 } },
        }),
      ),
    staleTime: STALE_MS,
  });
}

/** GET /shipment-monitor/summary (shipment.read) — đóng gói / bàn giao trong ngày, hãng đang giữ. */
export function useDashboardShipping(date: string, holdDays: number, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: dashboardKeys.shipping(date, holdDays),
    queryFn: () =>
      unwrap(api.GET('/shipment-monitor/summary', { params: { query: { date, holdDays } } })),
    refetchInterval: SHIPPING_REFRESH_MS,
  });
}
