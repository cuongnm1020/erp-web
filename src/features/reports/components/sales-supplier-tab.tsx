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
  useExportSalesBySupplier,
  useSalesBySupplier,
  type BySupplierParams,
  type SalesBySupplierItem,
  type SupplierSort,
} from '../api/use-sales-report';
import {
  DataAsOfNotice,
  ExportButton,
  GroupKeyLabel,
  count,
  csvMoney,
  csvQty,
  money,
  pct,
  profitCell,
} from './report-parts';
import { useSalesReportState } from './report-state';

const SORTABLE: readonly SupplierSort[] = ['revenue', 'grossProfit', 'qty'];

function toSupplierSort(sort: SortState | null): { sort: SupplierSort; order: 'asc' | 'desc' } {
  if (!sort || !(SORTABLE as readonly string[]).includes(sort.id))
    return { sort: 'revenue', order: 'desc' };
  return { sort: sort.id as SupplierSort, order: sort.desc ? 'desc' : 'asc' };
}

/**
 * Tab "Nhà cung cấp" (RPT-05c / RPT-07): doanh thu, giá nhập thuần, chi phí nhập, lãi gộp theo NCC
 * chính HIỆN TẠI của sản phẩm (GET /reports/sales/by-supplier). Dòng id null = "Chưa gán NCC".
 * Tìm + sắp xếp + phân trang phía server (luật 8). "Xem sản phẩm" chuyển sang tab Sản phẩm với
 * bộ lọc supplierId (chip bỏ được).
 */
export function SalesSupplierTab() {
  const { state, set, filter, range } = useSalesReportState();
  const { sort, order } = toSupplierSort(state.sort);
  const params = useMemo<BySupplierParams>(
    () => ({
      q: state.q,
      sort,
      order,
      take: state.size,
      skip: (state.page - 1) * state.size,
    }),
    [state.q, sort, order, state.size, state.page],
  );
  const query = useSalesBySupplier(filter, params);
  const exporter = useExportSalesBySupplier();

  const columns = useMemo<ColumnDef<SalesBySupplierItem, unknown>[]>(() => {
    const viewProducts = (r: SalesBySupplierItem) =>
      set({
        page: 1,
        q: '',
        sort: { id: 'revenue', desc: true },
        filters: {
          ...state.filters,
          tab: 'product',
          group: 'product',
          supplierId: r.key.id ?? undefined,
          supplierName: r.key.name,
        },
      });
    return [
      {
        id: 'key',
        header: 'Nhà cung cấp',
        cell: ({ row }) => (
          <GroupKeyLabel
            id={row.original.key.id}
            name={row.original.key.name}
            code={row.original.key.code}
            fallback="Chưa gán NCC"
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
        id: 'purchaseCost',
        header: 'Giá nhập',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.purchaseCost),
      },
      {
        id: 'importCost',
        header: 'Chi phí nhập',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) => money(row.original.importCost),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130, sortable: true },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'marginPct',
        header: 'Biên %',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.marginPct)}</span>,
      },
      {
        id: 'sharePct',
        header: 'Tỷ trọng',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.sharePct)}</span>,
      },
      {
        id: 'skuCount',
        header: 'Số SKU',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.skuCount),
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
      {
        id: 'actions',
        header: '',
        meta: { title: 'Thao tác', align: 'right', width: 120 },
        // Dòng "Chưa gán NCC" không có id để lọc — API sản phẩm chỉ nhận supplierId.
        cell: ({ row }) =>
          row.original.key.id ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Xem sản phẩm của ${row.original.key.name}`}
              onClick={() => viewProducts(row.original)}
            >
              Xem sản phẩm
            </Button>
          ) : null,
      },
    ];
  }, [set, state.filters]);

  const runExport = () =>
    exporter.mutate(
      { filter, params },
      {
        onSuccess: ({ items, total }) => {
          downloadCsv(
            `doanh-thu-theo-ncc_${range.from}_${range.to}`,
            [
              'Mã NCC',
              'Nhà cung cấp',
              'SL bán',
              'Doanh thu',
              'Giá nhập',
              'Chi phí nhập',
              'Giá vốn',
              'Lãi gộp',
              'Biên %',
              'Tỷ trọng %',
              'Số SKU',
              'Số đơn',
              'Doanh thu kỳ trước',
              'Tăng/giảm %',
            ],
            items.map((r) => [
              r.key.code ?? '',
              r.key.name,
              csvQty(r.qty),
              csvMoney(r.revenue),
              csvMoney(r.purchaseCost),
              csvMoney(r.importCost),
              csvMoney(r.cogs),
              csvMoney(r.grossProfit),
              r.marginPct ?? '',
              r.sharePct ?? '',
              r.skuCount,
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
        searchPlaceholder="Tìm mã / tên nhà cung cấp…"
        right={
          <ExportButton
            onClick={runExport}
            pending={exporter.isPending}
            title={`Xuất toàn bộ kết quả theo bộ lọc đang xem (tối đa ${formatMoney(String(EXPORT_MAX_ROWS), { unit: '' })} dòng)`}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        Doanh thu gán theo <span className="font-semibold">nhà cung cấp chính hiện tại</span> của
        sản phẩm — đổi NCC trên sản phẩm thì cả số kỳ trước cũng chuyển theo. Giá nhập / chi phí
        nhập là giá vốn đã chốt lúc đóng gói: chi phí nhập phân bổ sau khi đơn đã đóng gói không
        được tính.
      </p>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={12} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              state.q
                ? `Không có nhà cung cấp khớp “${state.q}”`
                : 'Chưa bán hàng của nhà cung cấp nào trong khoảng này'
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
                  Doanh thu {Math.min(10, d.items.length)} nhà cung cấp đầu trang
                </h2>
                <BarList
                  ariaLabel="Doanh thu theo nhà cung cấp"
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
                <h2 className="text-sm font-semibold">Tổng {d.total} nhà cung cấp</h2>
                <Total label="Doanh thu" value={formatMoney(d.totals.revenue)} />
                <Total label="SL bán" value={formatQuantity(d.totals.qty)} />
                <Total label="Giá nhập" value={formatMoney(d.totals.purchaseCost)} />
                <Total label="Chi phí nhập" value={formatMoney(d.totals.importCost)} />
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
