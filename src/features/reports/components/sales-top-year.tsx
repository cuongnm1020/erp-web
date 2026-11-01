'use client';

import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { downloadCsv } from '@/lib/export-csv';
import { formatDate } from '@/lib/format';
import {
  useSalesTopProductsMonthly,
  type SalesFilter,
  type SalesTopMonth,
  type SalesTopProductItem,
  type TopRankBy,
} from '../api/use-sales-report';
import { csvMoney, csvQty, ExportButton } from './report-parts';

/** Tiêu chí → CSV: tiền / số lượng / số nguyên. */
function csvValue(v: string, rankBy: TopRankBy): string | number {
  if (rankBy === 'revenue' || rankBy === 'grossProfit') return csvMoney(v);
  if (rankBy === 'qty') return csvQty(v);
  return v;
}

/** Một tháng: danh sách hạng gọn (hạng · SKU · giá trị tiêu chí). */
function MonthCard({
  m,
  rankBy,
  formatValue,
}: {
  m: SalesTopMonth;
  rankBy: TopRankBy;
  formatValue: (v: string | null, r: TopRankBy) => string;
}) {
  return (
    <section className="rounded-md border bg-card" aria-label={`Tháng ${m.month}`}>
      <header className="flex items-baseline justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Tháng {m.month}</h3>
        <span className="text-xs text-muted-foreground">
          {formatDate(m.from)} – {formatDate(m.to)}
        </span>
      </header>
      {m.items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Chưa có SKU nào bán ra</p>
      ) : (
        <ol className="divide-y">
          {m.items.map((x) => (
            <li key={x.sku.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="w-5 text-right font-semibold tabular-nums">{x.rank}</span>
              <span className="min-w-0 flex-1 truncate" title={`${x.sku.code} · ${x.sku.name}`}>
                {x.sku.name}
              </span>
              <span className="tabular-nums">{formatValue(x.value, rankBy)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Bán chạy theo tháng trong năm (RPT-06b, 2026-11-02): top cả năm (bảng đầy đủ cột) + mỗi tháng
 * một thẻ top N. Không lọc POS / kênh = toàn sàn (trong phạm vi người xem). Năm hiện tại tính tới
 * hôm nay, tháng chưa tới không hiện.
 */
export function SalesTopYearView({
  filter,
  year,
  rankBy,
  rankLabel,
  limit,
  supplierId,
  columns,
  formatValue,
}: {
  filter: SalesFilter;
  year: number;
  rankBy: TopRankBy;
  rankLabel: string;
  limit: number;
  supplierId?: string;
  columns: ColumnDef<SalesTopProductItem, unknown>[];
  formatValue: (v: string | null, r: TopRankBy) => string;
}) {
  const query = useSalesTopProductsMonthly(filter, year, rankBy, limit, supplierId);

  const exportCsv = (months: SalesTopMonth[], yearItems: SalesTopProductItem[]) =>
    downloadCsv(
      `ban-chay-${year}-theo-thang_${rankBy}`,
      ['Kỳ', 'Hạng', 'Mã SKU', 'Tên SKU', 'Sản phẩm', rankLabel, 'SL bán', 'Doanh thu', 'Số đơn'],
      [
        ...yearItems.map((r) => ({ period: `Cả năm ${year}`, r })),
        ...months.flatMap((m) => m.items.map((r) => ({ period: `Tháng ${m.month}`, r }))),
      ].map(({ period, r }) => [
        period,
        r.rank,
        r.sku.code,
        r.sku.name,
        r.product.name,
        csvValue(r.value, rankBy),
        csvQty(r.qty),
        csvMoney(r.revenue),
        r.orderCount,
      ]),
    );

  return (
    <QueryState
      query={query}
      skeleton={<ListSkeleton rows={10} columns={10} />}
      isEmpty={(d) => d.yearItems.length === 0}
      empty={
        <EmptyState
          title={`Chưa có SKU nào bán ra trong năm ${year}`}
          description="Bảng xếp hạng tính trên đơn đã chốt theo ngày đặt hàng. Chọn năm khác hoặc bỏ bớt lọc."
        />
      }
    >
      {(d) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold">
              Top {limit} cả năm {year}
              {d.months.length < 12 ? ` (tới hết tháng ${d.months.length})` : ''}
            </h2>
            <ExportButton onClick={() => exportCsv(d.months, d.yearItems)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Hạng / tăng giảm cả năm so với cùng số ngày năm trước; mỗi tháng so với tháng liền
            trước.
          </p>
          <DataTable
            columns={columns}
            rows={d.yearItems}
            getRowId={(r) => r.sku.id}
            total={d.yearItems.length}
            page={1}
            size={Math.max(d.yearItems.length, 1)}
            sort={null}
            onPageChange={() => undefined}
            onSizeChange={() => undefined}
            onSortChange={() => undefined}
            pagination={false}
          />
          <h2 className="text-sm font-semibold">Top {limit} từng tháng</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.months.map((m) => (
              <MonthCard key={m.month} m={m} rankBy={rankBy} formatValue={formatValue} />
            ))}
          </div>
        </div>
      )}
    </QueryState>
  );
}
