'use client';

import { useMemo, type ReactNode } from 'react';
import { useCsvExport } from '@/components/data/export-delivery';
import { BarList } from '@/components/data/charts';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { GrowthIndicator } from '@/components/data/growth-indicator';
import { SearchableMultiSelect } from '@/components/data/searchable-multi-select';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatQuantity, toDecimal } from '@/lib/format';
import type { SortState } from '@/lib/url-state';
import {
  EXPORT_MAX_ROWS,
  useExportSalesByTag,
  useReportProductTags,
  useSalesByTag,
  type ByTagParams,
  type SalesByTagItem,
  type TagGroupBy,
  type TagSort,
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

const SORTABLE: readonly TagSort[] = ['revenue', 'grossProfit', 'qty'];

const GROUPS: ReadonlyArray<readonly [TagGroupBy, string]> = [
  ['tag', 'Theo tag'],
  ['tag_owner', 'Tag × nhân viên lên đơn'],
];

function toTagSort(sort: SortState | null): { sort: TagSort; order: 'asc' | 'desc' } {
  if (!sort || !(SORTABLE as readonly string[]).includes(sort.id))
    return { sort: 'revenue', order: 'desc' };
  return { sort: sort.id as TagSort, order: sort.desc ? 'desc' : 'asc' };
}

const rowKey = (r: SalesByTagItem) => `${r.key.tagId ?? 'null'}|${r.key.ownerId ?? ''}`;

/**
 * Tab "Tag sản phẩm" (RPT-TAG, 2026-11-03): doanh thu / SL / giá vốn / lãi gộp theo tag HIỆN TẠI
 * của sản phẩm, hoặc tag × nhân viên lên đơn (GET /reports/sales/by-tag). Lọc nhân viên / team /
 * kênh dùng thanh lọc chung; ô Tag chọn nhiều tag. Sản phẩm nhiều tag tính ở mọi tag — cộng các
 * dòng có thể lớn hơn ô Tổng (Tổng tính mỗi dòng đơn một lần). Sắp xếp + phân trang phía server.
 */
export function SalesTagTab() {
  const { state, set, setFilters, filter, range } = useSalesReportState();
  const groupBy: TagGroupBy = state.filters.tagGroup === 'tag_owner' ? 'tag_owner' : 'tag';
  const byOwner = groupBy === 'tag_owner';
  const tagIds = useMemo(
    () => (state.filters.tagIds ? state.filters.tagIds.split(',').filter(Boolean) : []),
    [state.filters.tagIds],
  );
  const { sort, order } = toTagSort(state.sort);
  const params = useMemo<ByTagParams>(
    () => ({
      groupBy,
      tagIds,
      sort,
      order,
      take: state.size,
      skip: (state.page - 1) * state.size,
    }),
    [groupBy, tagIds, sort, order, state.size, state.page],
  );
  const query = useSalesByTag(filter, params);
  const tags = useReportProductTags();
  const exporter = useExportSalesByTag();

  const columns = useMemo<ColumnDef<SalesByTagItem, unknown>[]>(
    () => [
      {
        id: 'tag',
        header: 'Tag',
        cell: ({ row }) => (
          <GroupKeyLabel
            id={row.original.key.tagId}
            name={row.original.key.tagName}
            fallback="Chưa gắn tag"
          />
        ),
      },
      ...(byOwner
        ? [
            {
              id: 'owner',
              header: 'Nhân viên lên đơn',
              meta: { width: 200 },
              cell: ({ row }: { row: { original: SalesByTagItem } }) =>
                row.original.key.ownerId ? (
                  row.original.key.ownerName
                ) : (
                  <span className="italic text-muted-foreground">
                    {row.original.key.ownerName ?? 'Chưa gán'}
                  </span>
                ),
            } satisfies ColumnDef<SalesByTagItem, unknown>,
          ]
        : []),
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
        id: 'returnedRevenue',
        header: 'Hoàn',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) => money(row.original.returnedRevenue),
      },
      {
        id: 'netRevenue',
        header: 'Thực thu',
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => money(row.original.netRevenue),
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
    ],
    [byOwner],
  );

  const downloadCsv = useCsvExport('Báo cáo doanh thu theo tag sản phẩm');
  const runExport = () =>
    exporter.mutate(
      { filter, params },
      {
        onSuccess: ({ items, total }) => {
          downloadCsv(
            `doanh-thu-theo-tag${byOwner ? '-nhan-vien' : ''}_${range.from}_${range.to}`,
            [
              'Tag',
              ...(byOwner ? ['Nhân viên lên đơn'] : []),
              'SL bán',
              'Doanh thu',
              'Hoàn',
              'Thực thu',
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
              r.key.tagName,
              ...(byOwner ? [r.key.ownerName ?? ''] : []),
              csvQty(r.qty),
              csvMoney(r.revenue),
              csvMoney(r.returnedRevenue),
              csvMoney(r.netRevenue),
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
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Xem theo"
          value={groupBy}
          options={GROUPS}
          onChange={(g) =>
            set({ page: 1, filters: { ...state.filters, tagGroup: g === 'tag' ? undefined : g } })
          }
        />
        <SearchableMultiSelect
          label="Tag"
          unit="tag"
          values={tagIds}
          options={(tags.data ?? []).map((t) => ({
            value: t.id,
            label: t.name,
            hint: `${t.productCount} SP`,
          }))}
          onChange={(vs) => setFilters({ tagIds: vs.length ? vs.join(',') : undefined })}
        />
        <span className="mr-auto" />
        <ExportButton
          onClick={runExport}
          pending={exporter.isPending}
          title={`Xuất toàn bộ kết quả theo bộ lọc đang xem (tối đa ${formatMoney(String(EXPORT_MAX_ROWS), { unit: '' })} dòng)`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Doanh thu gán theo <span className="font-semibold">tag hiện tại</span> của sản phẩm — đổi
        tag thì cả số kỳ trước cũng chuyển theo. Sản phẩm nhiều tag được tính ở mọi tag của nó, nên
        cộng các dòng có thể lớn hơn ô Tổng. Nhân viên lên đơn = người phụ trách đơn (như tab Nhân
        viên); lọc một nhân viên / team ở thanh lọc phía trên.
      </p>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={byOwner ? 13 : 12} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="Chưa bán sản phẩm có tag nào trong khoảng này"
            description="Doanh thu tính trên đơn đã chốt theo ngày đặt hàng. Gắn tag ở màn Sản phẩm, hoặc đổi khoảng ngày / bộ lọc."
            action={
              tagIds.length ? (
                <Button variant="outline" onClick={() => setFilters({ tagIds: undefined })}>
                  Bỏ lọc tag
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
                  ariaLabel="Doanh thu theo tag"
                  items={d.items.slice(0, 10).map((r) => ({
                    key: rowKey(r),
                    label: byOwner ? `${r.key.tagName} · ${r.key.ownerName ?? ''}` : r.key.tagName,
                    value: r.revenue,
                    display: formatMoney(r.revenue),
                    muted: r.key.tagId === null,
                  }))}
                />
              </section>
              <section className="flex flex-col gap-1 rounded-md border bg-card p-3 text-sm">
                <h2 className="text-sm font-semibold">
                  Tổng {d.totals.orderCount} đơn · {d.total} dòng
                </h2>
                <Total label="Doanh thu" value={formatMoney(d.totals.revenue)} />
                <Total label="SL bán" value={formatQuantity(d.totals.qty)} />
                <Total label="Hoàn" value={formatMoney(d.totals.returnedRevenue)} />
                <Total label="Thực thu" value={formatMoney(d.totals.netRevenue)} />
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
              getRowId={rowKey}
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
