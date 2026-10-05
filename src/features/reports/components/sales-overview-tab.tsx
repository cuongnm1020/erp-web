'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ComparisonLineChart, type ComparisonPoint } from '@/components/data/charts';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { daysBetween } from '@/components/data/date-range-picker';
import { GrowthIndicator, growthPct, ratioPct } from '@/components/data/growth-indicator';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadCsv } from '@/lib/export-csv';
import { formatMoney } from '@/lib/format';
import {
  useSalesSummary,
  useSalesTimeseries,
  type Granularity,
  type SalesKpis,
  type SalesTimeseriesPoint,
} from '../api/use-sales-report';
import {
  DataAsOfNotice,
  ExportButton,
  Segmented,
  count,
  csvMoney,
  money,
  pct,
  periodLabel,
  profitCell,
} from './report-parts';
import { useSalesReportState } from './report-state';

type Metric = 'revenue' | 'orderCount' | 'aov' | 'grossProfit' | 'returnedRevenue';
const METRICS: ReadonlyArray<readonly [Metric, string]> = [
  ['revenue', 'Doanh thu'],
  ['orderCount', 'Số đơn'],
  ['aov', 'Giá trị TB/đơn'],
  ['grossProfit', 'Lãi gộp'],
  ['returnedRevenue', 'Hàng hoàn'],
];
const GRANULARITIES: ReadonlyArray<readonly [Granularity, string]> = [
  ['day', 'Ngày'],
  ['week', 'Tuần'],
  ['month', 'Tháng'],
];

/** Độ chia mặc định theo độ dài khoảng: ≤ 62 ngày theo ngày, ≤ 200 ngày theo tuần, còn lại tháng. */
export function autoGranularity(from: string, to: string): Granularity {
  const days = daysBetween(from, to) + 1;
  return days <= 62 ? 'day' : days <= 200 ? 'week' : 'month';
}

const metricValue = (p: SalesTimeseriesPoint | undefined, m: Metric): string | null =>
  p === undefined ? null : m === 'orderCount' ? String(p.orderCount) : p[m];

interface PeriodRow {
  point: SalesTimeseriesPoint;
  previous: SalesTimeseriesPoint | undefined;
}

/**
 * Tab "Tổng quan theo thời gian": KPI kỳ này so kỳ trước (/summary), biểu đồ đường kỳ này / kỳ
 * trước (/timeseries, so theo chỉ số điểm) và bảng từng kỳ. Xuất CSV bảng kỳ đang xem.
 */
export function SalesOverviewTab() {
  const { state, filter, range, setFilters, setRange, today } = useSalesReportState();
  const granRaw = state.filters.gran;
  const gran: Granularity =
    granRaw === 'day' || granRaw === 'week' || granRaw === 'month'
      ? granRaw
      : autoGranularity(range.from, range.to);
  const metric: Metric = METRICS.some(([k]) => k === state.filters.metric)
    ? (state.filters.metric as Metric)
    : 'revenue';

  const summary = useSalesSummary(filter);
  const series = useSalesTimeseries(filter, gran);

  const fmtMetric = useMemo(
    () => (v: string) => (metric === 'orderCount' ? formatMoney(v, { unit: '' }) : formatMoney(v)),
    [metric],
  );

  const columns = useMemo<ColumnDef<PeriodRow, unknown>[]>(
    () => [
      {
        id: 'period',
        header: 'Kỳ',
        meta: { width: 120 },
        cell: ({ row }) => periodLabel(row.original.point.period, gran),
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => money(row.original.point.revenue),
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) => count(row.original.point.orderCount),
      },
      {
        id: 'aov',
        header: 'TB/đơn',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) => money(row.original.point.aov),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.point.grossProfit),
      },
      {
        id: 'returnedRevenue',
        header: 'Hàng hoàn',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) => money(row.original.point.returnedRevenue),
      },
      {
        id: 'previousRevenue',
        header: 'Doanh thu kỳ trước',
        meta: { align: 'right', width: 150 },
        cell: ({ row }) =>
          row.original.previous ? (
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(row.original.previous.revenue)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'growth',
        header: 'Tăng/giảm',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <GrowthIndicator
            pct={growthPct(row.original.point.revenue, row.original.previous?.revenue)}
            hasCurrent={!/^0(\.0+)?$/.test(row.original.point.revenue)}
          />
        ),
      },
    ],
    [gran],
  );

  if (summary.isPending || series.isPending) return <OverviewSkeleton />;
  if (summary.error)
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  if (series.error)
    return <ErrorState error={series.error} onRetry={() => void series.refetch()} />;
  const s = summary.data;
  const t = series.data;
  if (!s || !t) return <OverviewSkeleton />;

  if (s.current.orderCount === 0 && s.previous.orderCount === 0) {
    return (
      <EmptyState
        title="Chưa có đơn đã chốt trong khoảng này và kỳ trước"
        description="Doanh thu tính trên đơn đã chốt theo ngày đặt hàng. Thử khoảng dài hơn hoặc bỏ bớt bộ lọc."
        action={
          today ? (
            <Button
              variant="outline"
              onClick={() => setRange({ from: `${today.slice(0, 4)}-01-01`, to: today })}
            >
              Xem từ đầu năm
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          )
        }
      />
    );
  }

  const points: ComparisonPoint[] = t.points.map((p, i) => ({
    key: p.period,
    label: periodLabel(p.period, gran),
    current: metricValue(p, metric),
    previous: metricValue(t.previousPoints[i], metric),
    previousLabel: t.previousPoints[i]
      ? `Kỳ trước (${periodLabel(t.previousPoints[i]!.period, gran)})`
      : 'Kỳ trước',
  }));
  const rows: PeriodRow[] = t.points.map((p, i) => ({ point: p, previous: t.previousPoints[i] }));
  const metricLabel = METRICS.find(([k]) => k === metric)![1];

  const exportCsv = () =>
    downloadCsv(
      `doanh-thu-theo-${gran === 'day' ? 'ngay' : gran === 'week' ? 'tuan' : 'thang'}_${range.from}_${range.to}`,
      [
        'Kỳ (ngày đầu)',
        'Doanh thu',
        'Số đơn',
        'TB/đơn',
        'Lãi gộp',
        'Hàng hoàn',
        'Kỳ trước (ngày đầu)',
        'Doanh thu kỳ trước',
        'Tăng/giảm %',
      ],
      rows.map(({ point: p, previous: q }) => [
        p.period,
        csvMoney(p.revenue),
        p.orderCount,
        csvMoney(p.aov),
        csvMoney(p.grossProfit),
        csvMoney(p.returnedRevenue),
        q?.period ?? '',
        q ? csvMoney(q.revenue) : '',
        growthPct(p.revenue, q?.revenue) ?? '',
      ]),
    );

  return (
    <div className="flex flex-col gap-3">
      <KpiRow current={s.current} previous={s.previous} />
      <DataAsOfNotice
        dataAsOf={s.dataAsOf}
        previousFrom={s.previousFrom}
        previousTo={s.previousTo}
      />

      <section className="rounded-md border bg-card p-3" aria-label="Biểu đồ theo thời gian">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold">{metricLabel} theo thời gian</h2>
          <Segmented
            label="Chỉ số trên biểu đồ"
            value={metric}
            options={METRICS}
            onChange={(m) => setFilters({ metric: m === 'revenue' ? undefined : m })}
          />
          <Segmented
            label="Độ chia"
            value={gran}
            options={GRANULARITIES}
            onChange={(g) => setFilters({ gran: g })}
          />
        </div>
        <ComparisonLineChart
          points={points}
          format={fmtMetric}
          ariaLabel={`${metricLabel} theo ${gran === 'day' ? 'ngày' : gran === 'week' ? 'tuần' : 'tháng'}, kỳ này so kỳ trước — xem bảng bên dưới`}
          tooltipExtra={(p) => (
            <GrowthIndicator
              pct={growthPct(p.current, p.previous)}
              inverse={metric === 'returnedRevenue'}
            />
          )}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted-foreground">
          Tổng {t.points.length} kỳ: doanh thu {formatMoney(t.totals.revenue)} ·{' '}
          {t.totals.orderCount} đơn · kỳ trước {formatMoney(t.previousTotals.revenue)}
        </p>
        <ExportButton onClick={exportCsv} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.point.period}
        total={rows.length}
        page={1}
        size={Math.max(rows.length, 1)}
        sort={null}
        onPageChange={() => undefined}
        onSizeChange={() => undefined}
        onSortChange={() => undefined}
        pagination={false}
      />
    </div>
  );
}

function KpiRow({ current: c, previous: p }: { current: SalesKpis; previous: SalesKpis }) {
  const prev = (v: string) => `Kỳ trước ${formatMoney(v)}`;
  const margin = ratioPct(c.grossProfit, c.revenue);
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Doanh thu"
        value={formatMoney(c.revenue)}
        detail={<KpiDelta pct={growthPct(c.revenue, p.revenue)} text={prev(p.revenue)} />}
      />
      <KpiCard
        label="Số đơn"
        value={formatMoney(String(c.orderCount), { unit: '' })}
        detail={
          <KpiDelta
            pct={growthPct(String(c.orderCount), String(p.orderCount))}
            text={`Kỳ trước ${formatMoney(String(p.orderCount), { unit: '' })}`}
          />
        }
      />
      <KpiCard
        label="Giá trị TB/đơn"
        value={formatMoney(c.aov)}
        detail={<KpiDelta pct={growthPct(c.aov, p.aov)} text={prev(p.aov)} />}
      />
      <KpiCard
        label="Lãi gộp"
        value={
          <span className={c.grossProfit.startsWith('-') ? 'text-destructive' : undefined}>
            {formatMoney(c.grossProfit)}
          </span>
        }
        detail={
          <KpiDelta
            pct={growthPct(c.grossProfit, p.grossProfit)}
            text={`${pct(margin)} trên doanh thu`}
          />
        }
      />
      <KpiCard
        label="Hàng hoàn"
        value={formatMoney(c.returnedRevenue)}
        detail={
          <KpiDelta
            pct={growthPct(c.returnedRevenue, p.returnedRevenue)}
            inverse
            text={prev(p.returnedRevenue)}
          />
        }
      />
      <KpiCard
        label="Khách mua"
        value={formatMoney(String(c.customerCount), { unit: '' })}
        detail={
          <KpiDelta
            pct={growthPct(String(c.customerCount), String(p.customerCount))}
            text={`${c.newCustomerCount} khách mới`}
          />
        }
      />
    </div>
  );
}

function KpiDelta({
  pct: p,
  text,
  inverse,
}: {
  pct: string | null;
  text: string;
  inverse?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <GrowthIndicator pct={p} inverse={inverse} />
      <span>{text}</span>
    </span>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Đang tải báo cáo">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <ListSkeleton rows={6} columns={8} />
    </div>
  );
}
