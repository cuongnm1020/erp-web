import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI. */
export type SalesSummary = components['schemas']['SalesSummaryDto'];
export type SalesKpis = components['schemas']['SalesKpisDto'];
export type SalesTimeseries = components['schemas']['SalesTimeseriesDto'];
export type SalesTimeseriesPoint = components['schemas']['SalesTimeseriesPointDto'];
export type SalesByProduct = components['schemas']['SalesByProductDto'];
export type SalesByProductItem = components['schemas']['SalesByProductItemDto'];
export type SalesByStaff = components['schemas']['SalesByStaffDto'];
export type SalesByStaffItem = components['schemas']['SalesByStaffItemDto'];
export type SalesTopProducts = components['schemas']['SalesTopProductsDto'];
export type SalesTopProductItem = components['schemas']['SalesTopProductItemDto'];
export type SalesBySupplier = components['schemas']['SalesBySupplierDto'];
export type SalesBySupplierItem = components['schemas']['SalesBySupplierItemDto'];

type SummaryQuery = paths['/reports/sales/summary']['get']['parameters']['query'];
type ByProductQuery = paths['/reports/sales/by-product']['get']['parameters']['query'];
type TopQuery = paths['/reports/sales/top-products']['get']['parameters']['query'];
type BySupplierQuery = paths['/reports/sales/by-supplier']['get']['parameters']['query'];

export type SalesChannel = NonNullable<SummaryQuery['channel']>;
export type Granularity = SalesTimeseries['granularity'];
export type ProductGroupBy = SalesByProduct['groupBy'];
export type ProductSort = NonNullable<ByProductQuery['sort']>;
export type StaffGroupBy = SalesByStaff['groupBy'];
export type TopRankBy = TopQuery['rankBy'];
export type SupplierSort = NonNullable<BySupplierQuery['sort']>;

/** Bộ lọc chung của mọi báo cáo bán hàng — đã chuẩn hoá từ URL. */
export interface SalesFilter {
  /** YYYY-MM-DD giờ VN, gồm cả hai đầu; from = to = một ngày. */
  from: string;
  to: string;
  channel?: SalesChannel;
  teamId?: string;
  ownerId?: string;
}

export interface ByProductParams {
  groupBy: ProductGroupBy;
  /** RPT-05c — chỉ dòng của SP có NCC chính này (NCC hiện tại). */
  supplierId?: string;
  q: string;
  sort: ProductSort;
  order: 'asc' | 'desc';
  take: number;
  skip: number;
}

export interface BySupplierParams {
  q: string;
  sort: SupplierSort;
  order: 'asc' | 'desc';
  take: number;
  skip: number;
}

/** Phễu key (luật 3): ['reports','sales', <loại>, params] — invalidate theo prefix ['reports','sales']. */
export const salesReportKeys = {
  all: ['reports', 'sales'] as const,
  summary: (f: SalesFilter) => [...salesReportKeys.all, 'summary', f] as const,
  timeseries: (f: SalesFilter, g: Granularity) =>
    [...salesReportKeys.all, 'timeseries', f, g] as const,
  byProduct: (f: SalesFilter, p: ByProductParams) =>
    [...salesReportKeys.all, 'by-product', f, p] as const,
  byStaff: (f: SalesFilter, g: StaffGroupBy) => [...salesReportKeys.all, 'by-staff', f, g] as const,
  bySupplier: (f: SalesFilter, p: BySupplierParams) =>
    [...salesReportKeys.all, 'by-supplier', f, p] as const,
  top: (f: SalesFilter, rankBy: TopRankBy, limit: number, supplierId?: string) =>
    [...salesReportKeys.all, 'top-products', f, rankBy, limit, supplierId ?? null] as const,
  teams: () => [...salesReportKeys.all, 'options', 'teams'] as const,
  owners: () => [...salesReportKeys.all, 'options', 'owners'] as const,
};

const filterQuery = (f: SalesFilter) => ({
  from: f.from,
  to: f.to,
  channel: f.channel,
  teamId: f.teamId,
  ownerId: f.ownerId,
});

/** GET /reports/sales/summary — KPI kỳ đang xem + kỳ trước cùng độ dài. */
export function useSalesSummary(f: SalesFilter, enabled = true) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.summary(f),
    queryFn: () => unwrap(api.GET('/reports/sales/summary', { params: { query: filterQuery(f) } })),
    placeholderData: keepPreviousData,
  });
}

/** GET /reports/sales/timeseries — điểm theo ngày / tuần / tháng + điểm kỳ trước cùng chỉ số. */
export function useSalesTimeseries(f: SalesFilter, granularity: Granularity, enabled = true) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.timeseries(f, granularity),
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/timeseries', {
          params: { query: { ...filterQuery(f), granularity } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

const byProductQuery = (f: SalesFilter, p: ByProductParams) => ({
  ...filterQuery(f),
  groupBy: p.groupBy,
  supplierId: p.supplierId,
  q: p.q || undefined,
  sort: p.sort,
  order: p.order,
  take: p.take,
  skip: p.skip,
});

/** GET /reports/sales/by-product — phân trang + sắp xếp phía server (take ≤ 200). */
export function useSalesByProduct(f: SalesFilter, p: ByProductParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.byProduct(f, p),
    queryFn: () =>
      unwrap(api.GET('/reports/sales/by-product', { params: { query: byProductQuery(f, p) } })),
    placeholderData: keepPreviousData,
  });
}

/** Trần số dòng khi xuất toàn bộ báo cáo sản phẩm (50 trang × 200). */
export const EXPORT_MAX_ROWS = 10_000;
const EXPORT_PAGE = 200;

/**
 * Xuất báo cáo sản phẩm: lặp trang 200 dòng tới hết `total` (tối đa EXPORT_MAX_ROWS) với đúng
 * bộ lọc + sắp xếp đang xem. Đi qua useMutation (luật 3) — màn chỉ ghi file CSV từ kết quả.
 */
export function useExportSalesByProduct() {
  return useMutation({
    mutationFn: async ({ filter, params }: { filter: SalesFilter; params: ByProductParams }) => {
      const items: SalesByProductItem[] = [];
      let total = Number.POSITIVE_INFINITY;
      for (let skip = 0; skip < Math.min(total, EXPORT_MAX_ROWS); skip += EXPORT_PAGE) {
        const page = await unwrap(
          api.GET('/reports/sales/by-product', {
            params: { query: byProductQuery(filter, { ...params, take: EXPORT_PAGE, skip }) },
          }),
        );
        total = page.total;
        items.push(...page.items);
        if (page.items.length < EXPORT_PAGE) break;
      }
      return { items, total: Number.isFinite(total) ? total : items.length };
    },
  });
}

const bySupplierQuery = (f: SalesFilter, p: BySupplierParams) => ({
  ...filterQuery(f),
  q: p.q || undefined,
  sort: p.sort,
  order: p.order,
  take: p.take,
  skip: p.skip,
});

/**
 * GET /reports/sales/by-supplier (RPT-05c) — theo NCC chính HIỆN TẠI của sản phẩm; dòng id null =
 * "Chưa gán NCC". Phân trang + sắp xếp + tìm phía server (take ≤ 200).
 */
export function useSalesBySupplier(f: SalesFilter, p: BySupplierParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.bySupplier(f, p),
    queryFn: () =>
      unwrap(api.GET('/reports/sales/by-supplier', { params: { query: bySupplierQuery(f, p) } })),
    placeholderData: keepPreviousData,
  });
}

/** Xuất báo cáo theo NCC — như useExportSalesByProduct (lặp trang 200, tối đa EXPORT_MAX_ROWS). */
export function useExportSalesBySupplier() {
  return useMutation({
    mutationFn: async ({ filter, params }: { filter: SalesFilter; params: BySupplierParams }) => {
      const items: SalesBySupplierItem[] = [];
      let total = Number.POSITIVE_INFINITY;
      for (let skip = 0; skip < Math.min(total, EXPORT_MAX_ROWS); skip += EXPORT_PAGE) {
        const page = await unwrap(
          api.GET('/reports/sales/by-supplier', {
            params: { query: bySupplierQuery(filter, { ...params, take: EXPORT_PAGE, skip }) },
          }),
        );
        total = page.total;
        items.push(...page.items);
        if (page.items.length < EXPORT_PAGE) break;
      }
      return { items, total: Number.isFinite(total) ? total : items.length };
    },
  });
}

/** GET /reports/sales/by-staff — theo người phụ trách hoặc team (snapshot trên đơn), không phân trang. */
export function useSalesByStaff(f: SalesFilter, groupBy: StaffGroupBy, enabled = true) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.byStaff(f, groupBy),
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/by-staff', { params: { query: { ...filterQuery(f), groupBy } } }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /reports/sales/top-products — top N SKU theo tiêu chí, kèm hạng kỳ trước. */
export function useSalesTopProducts(
  f: SalesFilter,
  rankBy: TopRankBy,
  limit: number,
  supplierId?: string,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.top(f, rankBy, limit, supplierId),
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/top-products', {
          params: { query: { ...filterQuery(f), rankBy, limit, supplierId } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** POST /reports/sales/rollup/rebuild (report.sales_all) — 202, worker tính lại dần. */
export function useSalesRollupRebuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { from: string; to: string }) =>
      unwrap(api.POST('/reports/sales/rollup/rebuild', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: salesReportKeys.all }),
  });
}

/** GET /teams (customer.read) — lựa chọn cho bộ lọc team. Danh mục nhỏ → staleTime 5 phút. */
export function useReportTeams(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.teams(),
    queryFn: () => unwrap(api.GET('/teams')),
    staleTime: 300_000,
  });
}

/** GET /users (user.read) — lựa chọn cho bộ lọc người phụ trách: 200 người đang hoạt động. */
export function useReportOwners(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: salesReportKeys.owners(),
    queryFn: () =>
      unwrap(
        api.GET('/users', {
          params: {
            query: { isActive: true, sortBy: 'fullName', sortDir: 'asc', take: 200, skip: 0 },
          },
        }),
      ),
    staleTime: 300_000,
  });
}
