'use client';

import { useMemo, type ReactNode } from 'react';
import { BarList } from '@/components/data/charts';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { GrowthIndicator } from '@/components/data/growth-indicator';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { downloadCsv } from '@/lib/export-csv';
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatQuantity, toDecimal } from '@/lib/format';
import type { SortState } from '@/lib/url-state';
import {
  EXPORT_MAX_ROWS,
  useExportSalesByProduct,
  useSalesByProduct,
  type ByProductParams,
  type ProductGroupBy,
  type ProductSort,
  type SalesByProductItem,
} from '../api/use-sales-report';
import {
  DataAsOfNotice,
  ExportButton,
  GroupKeyLabel,
  Segmented,
  count,
  csvMoney,
  csvQty,
  money,
  pct,
  profitCell,
} from './report-parts';
import { useSalesReportState } from './report-state';

const GROUPS: ReadonlyArray<readonly [ProductGroupBy, string]> = [
  ['sku', 'SKU'],
  ['product', 'Sản phẩm'],
  ['category', 'Danh mục'],
  ['brand', 'Thương hiệu'],
];
const GROUP_NOUN: Record<ProductGroupBy, string> = {
  sku: 'SKU',
  product: 'sản phẩm',
  category: 'danh mục',
  brand: 'thương hiệu',
};
const SORTABLE: readonly ProductSort[] = ['revenue', 'qty', 'grossProfit'];

function toProductSort(sort: SortState | null): { sort: ProductSort; order: 'asc' | 'desc' } {
  if (!sort || !(SORTABLE as readonly string[]).includes(sort.id))
    return { sort: 'revenue', order: 'desc' };
  return { sort: sort.id as ProductSort, order: sort.desc ? 'desc' : 'asc' };
}

/**
 * Tab "Sản phẩm": doanh thu theo SKU / sản phẩm / danh mục / thương hiệu (đã phân bổ KM cấp đơn).
 * Tìm + sắp xếp + phân trang phía server (luật 8). Xuất CSV toàn bộ kết quả (lặp trang).
 */
export function SalesProductTab() {
  const { state, set, setFilters, filter, range } = useSalesReportState();
  const groupBy: ProductGroupBy = GROUPS.some(([k]) => k === state.filters.group)
    ? (state.filters.group as ProductGroupBy)
    : 'sku';
  const { sort, order } = toProductSort(state.sort);
  const params = useMemo<ByProductParams>(
    () => ({
      groupBy,
      q: state.q,
      sort,
      order,
      take: state.size,
      skip: (state.page - 1) * state.size,
    }),
    [groupBy, state.q, sort, order, state.size, state.page],
  );
  const query = useSalesByProduct(filter, params);
  const exporter = useExportSalesByProduct();
  const noun = GROUP_NOUN[groupBy];
  const fallback = groupBy === 'category' ? 'Chưa phân loại' : 'Chưa gán';

  const columns = useMemo<ColumnDef<SalesByProductItem, unknown>[]>(
    () => [
      {
        id: 'key',
        header: groupBy === 'sku' ? 'SKU' : GROUPS.find(([k]) => k === groupBy)![1],
        cell: ({ row }) => (
          <GroupKeyLabel
            id={row.original.key.id}
            name={row.original.key.name}
            code={row.original.key.code}
            fallback={fallback}
          />
        ),
      },
      {
        id: 'qty',
        header: 'SL bán',
        meta: { align: 'right', width: 100, sortable: true },
        cell: ({ row }) => <span className="tabular-nums">{formatQuantity(row.original.qty)}</span>,
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 140, sortable: true },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: 'cogs',
        header: 'Giá vốn',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.cogs),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130, sortable: true },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'marginPct',
        header: '% lãi',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.marginPct)}</span>,
      },
      {
        id: 'sharePct',
        header: '% đóng góp',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.sharePct)}</span>,
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.orderCount),
      },
      {
        id: 'previousRevenue',
        header: 'Doanh thu kỳ trước',
        meta: { align: 'right', width: 150 },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoney(row.original.previousRevenue)}
          </span>
        ),
      },
      {
        id: 'growthPct',
        header: 'Tăng/giảm',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <GrowthIndicator
            pct={row.original.growthPct}
            hasCurrent={!(toDecimal(row.original.revenue)?.isZero() ?? true)}
          />
        ),
      },
    ],
    [groupBy, fallback],
  );

  const runExport = () =>
    exporter.mutate(
      { filter, params },
      {
        onSuccess: ({ items, total }) => {
          downloadCsv(
            `doanh-thu-theo-${groupBy}_${range.from}_${range.to}`,
            [
              'Mã',
              'Tên',
              'SL bán',
              'Doanh thu',
              'Giá vốn',
              'Lãi gộp',
              '% lãi',
              '% đóng góp',
              'Số đơn',
              'Doanh thu kỳ trước',
              'Tăng/giảm %',
            ],
            items.map((r) => [
              r.key.code ?? '',
              r.key.name,
              csvQty(r.qty),
              csvMoney(r.revenue),
              csvMoney(r.cogs),
              csvMoney(r.grossProfit),
              r.marginPct ?? '',
              r.sharePct ?? '',
              r.orderCount,
              csvMoney(r.previousRevenue),
              r.growthPct ?? '',
            ]),
          );
          if (total > items.length)
            toast.warning(`Đã xuất ${items.length}/${total} dòng — thu hẹp bộ lọc để xuất đủ.`);
          else toast.success(`Đã xuất CSV ${items.length} dòng`);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={() => undefined}
        searchPlaceholder={`Tìm mã / tên ${noun}…`}
        right={
          <>
            <Segmented
              label="Xem theo"
              value={groupBy}
              options={GROUPS}
              onChange={(g) => setFilters({ group: g === 'sku' ? undefined : g })}
            />
            <ExportButton
              onClick={runExport}
              pending={exporter.isPending}
              title={`Xuất toàn bộ kết quả theo bộ lọc đang xem (tối đa ${formatMoney(String(EXPORT_MAX_ROWS), { unit: '' })} dòng)`}
            />
          </>
        }
      />
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={10} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              state.q
                ? `Không có ${noun} khớp “${state.q}”`
                : `Chưa bán ${noun} nào trong khoảng này`
            }
            description="Doanh thu tính trên đơn đã chốt theo ngày đặt hàng — đổi khoảng ngày hoặc bộ lọc."
            action={
              state.q ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa từ khóa
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(d) => (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <section className="rounded-md border bg-card p-3" aria-label="Biểu đồ doanh thu">
                <h2 className="mb-2 text-sm font-semibold">
                  Doanh thu {Math.min(10, d.items.length)} dòng đầu trang
                </h2>
                <BarList
                  ariaLabel={`Doanh thu theo ${noun}`}
                  items={d.items.slice(0, 10).map((r, i) => ({
                    key: r.key.id ?? `null-${i}`,
                    label: r.key.name,
                    value: r.revenue,
                    display: formatMoney(r.revenue),
                    muted: r.key.id === null,
                  }))}
                />
              </section>
              <section className="flex flex-col gap-1 rounded-md border bg-card p-3 text-sm">
                <h2 className="text-sm font-semibold">
                  Tổng {d.total} {noun}
                </h2>
                <Total label="Doanh thu" value={formatMoney(d.totals.revenue)} />
                <Total label="SL bán" value={formatQuantity(d.totals.qty)} />
                <Total label="Giá vốn" value={formatMoney(d.totals.cogs)} />
                <Total
                  label="Lãi gộp"
                  value={`${formatMoney(d.totals.grossProfit)} · ${pct(d.totals.marginPct)}`}
                />
                <Total
                  label="Kỳ trước"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {formatMoney(d.totals.previousRevenue)}
                      <GrowthIndicator pct={d.totals.growthPct} />
                    </span>
                  }
                />
              </section>
            </div>
            <DataAsOfNotice
              dataAsOf={d.dataAsOf}
              previousFrom={d.previousFrom}
              previousTo={d.previousTo}
            />
            <DataTable
              columns={columns}
              rows={d.items}
              getRowId={(r) => r.key.id ?? 'null'}
              total={d.total}
              page={state.page}
              size={state.size}
              sort={{ id: sort, desc: order === 'desc' }}
              onPageChange={(page) => set({ page })}
              onSizeChange={(size) => set({ size })}
              onSortChange={(s) => set({ sort: s })}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

function Total({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
