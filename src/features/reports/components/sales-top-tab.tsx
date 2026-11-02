'use client';

import { useMemo } from 'react';
import { useCsvExport } from '@/components/data/export-delivery';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { GrowthIndicator } from '@/components/data/growth-indicator';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatMoney, formatQuantity } from '@/lib/format';
import {
  useSalesTopProducts,
  type SalesTopProductItem,
  type TopRankBy,
} from '../api/use-sales-report';
import {
  DataAsOfNotice,
  ExportButton,
  Segmented,
  count,
  csvMoney,
  csvQty,
  money,
  profitCell,
  SupplierFilterChip,
} from './report-parts';
import { useSalesReportState } from './report-state';
import { SalesTopYearView } from './sales-top-year';

const RANKS: ReadonlyArray<readonly [TopRankBy, string]> = [
  ['revenue', 'Doanh thu'],
  ['qty', 'Số lượng'],
  ['grossProfit', 'Lãi gộp'],
  ['orders', 'Số đơn'],
  ['customers', 'Số khách'],
];
const LIMITS = [10, 20, 50, 100] as const;
const DEFAULT_LIMIT = 20;

/** Định dạng `value` / `previousValue` theo tiêu chí (qty 6 chữ số, tiền 4, đơn/khách số nguyên). */
export function formatRankValue(v: string | null, rankBy: TopRankBy): string {
  if (v === null) return '—';
  if (rankBy === 'qty') return formatQuantity(v);
  if (rankBy === 'revenue' || rankBy === 'grossProfit') return formatMoney(v);
  return formatMoney(v, { unit: '' });
}

/** Thay đổi hạng so kỳ trước: ▲ lên hạng, ▼ xuống hạng, "Mới" = kỳ trước không bán. */
function RankMove({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank === null) return <span className="text-xs font-semibold text-info">Mới</span>;
  const diff = previousRank - rank;
  if (diff === 0)
    return (
      <span className="text-xs text-muted-foreground" title={`Kỳ trước hạng ${previousRank}`}>
        =
      </span>
    );
  return (
    <span
      className={cn('text-xs font-semibold', diff > 0 ? 'text-success' : 'text-destructive')}
      title={`Kỳ trước hạng ${previousRank}`}
      aria-label={`${diff > 0 ? 'Lên' : 'Xuống'} ${Math.abs(diff)} hạng, kỳ trước hạng ${previousRank}`}
    >
      <span aria-hidden>{diff > 0 ? '▲' : '▼'}</span>
      {Math.abs(diff)}
    </span>
  );
}

type TopView = 'range' | 'year';
const VIEWS: ReadonlyArray<readonly [TopView, string]> = [
  ['range', 'Khoảng ngày đang chọn'],
  ['year', 'Theo tháng trong năm'],
];
/** Theo tháng: top mỗi tháng tối đa 50 (API) — chọn 5 / 10 / 20, mặc định 10. */
const YEAR_LIMITS = [5, 10, 20] as const;
const YEAR_DEFAULT_LIMIT = 10;

/**
 * Tab "Bán chạy": top N SKU theo 5 tiêu chí, kèm hạng + giá trị kỳ trước. Hai chế độ (2026-11-02):
 * theo khoảng ngày của thanh lọc, hoặc theo từng tháng của một năm + top cả năm (`topView=year`).
 */
export function SalesTopTab() {
  const { state, setFilters, filter, range, today } = useSalesReportState();
  const view: TopView = state.filters.topView === 'year' ? 'year' : 'range';
  const thisYear = Number.parseInt(today.slice(0, 4), 10);
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
  const yearRaw = Number.parseInt(state.filters.topYear ?? '', 10);
  const year = years.includes(yearRaw) ? yearRaw : thisYear;
  const rankBy: TopRankBy = RANKS.some(([k]) => k === state.filters.rank)
    ? (state.filters.rank as TopRankBy)
    : 'revenue';
  const limitRaw = Number.parseInt(state.filters.limit ?? '', 10);
  const limits: readonly number[] = view === 'year' ? YEAR_LIMITS : LIMITS;
  const defaultLimit = view === 'year' ? YEAR_DEFAULT_LIMIT : DEFAULT_LIMIT;
  const limit = limits.includes(limitRaw) ? limitRaw : defaultLimit;
  const supplierId = state.filters.supplierId || undefined;
  const query = useSalesTopProducts(filter, rankBy, limit, supplierId, view === 'range');
  const rankLabel = RANKS.find(([k]) => k === rankBy)![1];

  const columns = useMemo<ColumnDef<SalesTopProductItem, unknown>[]>(
    () => [
      {
        id: 'rank',
        header: 'Hạng',
        meta: { width: 80 },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span className="w-6 text-right font-semibold tabular-nums">{row.original.rank}</span>
            <RankMove rank={row.original.rank} previousRank={row.original.previousRank} />
          </span>
        ),
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.sku.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.sku.code}</span>
          </span>
        ),
      },
      {
        id: 'product',
        header: 'Sản phẩm',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.product.name}</span>
        ),
      },
      {
        id: 'value',
        header: rankLabel,
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {formatRankValue(row.original.value, rankBy)}
          </span>
        ),
      },
      {
        id: 'qty',
        header: 'SL bán',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => <span className="tabular-nums">{formatQuantity(row.original.qty)}</span>,
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.orderCount),
      },
      {
        id: 'customerCount',
        header: 'Số khách',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.customerCount),
      },
      {
        id: 'previousValue',
        header: `${rankLabel} kỳ trước`,
        meta: { align: 'right', width: 150 },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatRankValue(row.original.previousValue, rankBy)}
          </span>
        ),
      },
      {
        id: 'growthPct',
        header: 'Tăng/giảm',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => <GrowthIndicator pct={row.original.growthPct} hasCurrent />,
      },
    ],
    [rankBy, rankLabel],
  );

  const downloadCsv = useCsvExport('Báo cáo sản phẩm bán chạy');
  const exportCsv = (items: SalesTopProductItem[]) =>
    downloadCsv(
      `ban-chay-theo-${rankBy}_${range.from}_${range.to}`,
      [
        'Hạng',
        'Hạng kỳ trước',
        'Mã SKU',
        'Tên SKU',
        'Sản phẩm',
        'SL bán',
        'Doanh thu',
        'Lãi gộp',
        'Số đơn',
        'Số khách',
        `${rankLabel} kỳ trước`,
        'Tăng/giảm %',
      ],
      items.map((r) => [
        r.rank,
        r.previousRank ?? '',
        r.sku.code,
        r.sku.name,
        r.product.name,
        csvQty(r.qty),
        csvMoney(r.revenue),
        csvMoney(r.grossProfit),
        r.orderCount,
        r.customerCount,
        r.previousValue === null
          ? ''
          : rankBy === 'revenue' || rankBy === 'grossProfit'
            ? csvMoney(r.previousValue)
            : rankBy === 'qty'
              ? csvQty(r.previousValue)
              : r.previousValue,
        r.growthPct ?? '',
      ]),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Kỳ xếp hạng"
          value={view}
          options={VIEWS}
          onChange={(v) =>
            setFilters({ topView: v === 'year' ? 'year' : undefined, limit: undefined })
          }
        />
        {view === 'year' ? (
          <Select
            value={String(year)}
            onValueChange={(v) => setFilters({ topYear: Number(v) === thisYear ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-28" aria-label="Năm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Năm {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Xếp hạng theo</span>
        <Segmented
          label="Xếp hạng theo"
          value={rankBy}
          options={RANKS}
          onChange={(r) => setFilters({ rank: r === 'revenue' ? undefined : r })}
        />
        <Select
          value={String(limit)}
          onValueChange={(v) => setFilters({ limit: Number(v) === defaultLimit ? undefined : v })}
        >
          <SelectTrigger className="h-8 w-28" aria-label="Số SKU">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {limits.map((l) => (
              <SelectItem key={l} value={String(l)}>
                Top {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {supplierId ? (
          <SupplierFilterChip
            name={state.filters.supplierName}
            onClear={() => setFilters({ supplierId: undefined, supplierName: undefined })}
          />
        ) : null}
        {view === 'range' && query.data && query.data.items.length > 0 ? (
          <span className="ml-auto">
            <ExportButton onClick={() => exportCsv(query.data.items)} />
          </span>
        ) : null}
      </div>
      {view === 'year' ? (
        <SalesTopYearView
          filter={filter}
          year={year}
          rankBy={rankBy}
          rankLabel={rankLabel}
          limit={limit}
          supplierId={supplierId}
          columns={columns}
          formatValue={formatRankValue}
        />
      ) : (
        <QueryState
          query={query}
          skeleton={<ListSkeleton rows={10} columns={10} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              title="Chưa có SKU nào bán ra trong khoảng này"
              description="Bảng xếp hạng tính trên đơn đã chốt theo ngày đặt hàng."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      supplierId: undefined,
                      supplierName: undefined,
                      channel: undefined,
                      teamId: undefined,
                      teamName: undefined,
                      ownerId: undefined,
                      ownerName: undefined,
                    })
                  }
                >
                  {supplierId
                    ? 'Bỏ lọc NCC / kênh / team / nhân viên'
                    : 'Bỏ lọc kênh / team / nhân viên'}
                </Button>
              }
            />
          }
        >
          {(d) => (
            <>
              <DataAsOfNotice
                dataAsOf={d.dataAsOf}
                previousFrom={d.previousFrom}
                previousTo={d.previousTo}
              />
              <DataTable
                columns={columns}
                rows={d.items}
                getRowId={(r) => r.sku.id}
                total={d.items.length}
                page={1}
                size={Math.max(d.items.length, 1)}
                sort={null}
                onPageChange={() => undefined}
                onSizeChange={() => undefined}
                onSortChange={() => undefined}
                pagination={false}
              />
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}
