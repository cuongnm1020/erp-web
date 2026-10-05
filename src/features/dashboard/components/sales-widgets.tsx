'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarList, ComparisonLineChart, type ComparisonPoint } from '@/components/data/charts';
import { shiftDay } from '@/components/data/date-range-picker';
import { GrowthIndicator, growthPct, ratioPct } from '@/components/data/growth-indicator';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ErrorState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  useDashboardSalesSummary,
  useDashboardSalesTimeseries,
  useDashboardTopProducts,
  type DayRange,
  type SalesKpis,
} from '../api/use-dashboard';

/** Số ngày của biểu đồ doanh thu. */
export const CHART_DAYS = 30;
/** Số SKU của ô bán chạy. */
export const TOP_LIMIT = 5;

/** Link sang /reports/sales đúng tab + khoảng của widget (tab overview là mặc định, không ghi). */
export function reportHref(r: DayRange, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ ...extra, from: r.from, to: r.to });
  return `/reports/sales?${p.toString()}`;
}

const rangeText = (from: string, to: string) =>
  from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;

const isZero = (v: string) => /^-?0(\.0+)?$/.test(v);

export function WidgetFrame({
  title,
  note,
  href,
  linkLabel = 'Xem báo cáo',
  children,
  className,
}: {
  title: string;
  note?: ReactNode;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className} aria-label={title}>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
        <h2 className="font-semibold">{title}</h2>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
        {href ? (
          <Link href={href} className="ml-auto text-primary hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4" role="status" aria-label="Đang tải">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

/**
 * Một dải 4 KPI (doanh thu, số đơn, TB/đơn, lãi gộp) cho khoảng `range`, so với kỳ trước cùng độ
 * dài mà API trả về (hôm nay → hôm qua; tháng này → số ngày tương đương liền trước).
 */
export function SalesKpiWidget({
  title,
  range,
  previousLabel,
  emptyTitle,
}: {
  title: string;
  range: DayRange;
  /** Tiền tố dòng phụ: "Hôm qua" / "Kỳ trước". */
  previousLabel: string;
  emptyTitle: string;
}) {
  const q = useDashboardSalesSummary(range, true);
  const href = reportHref(range);
  const s = q.data;
  return (
    <WidgetFrame
      title={title}
      note={
        s
          ? `so với ${rangeText(s.previousFrom, s.previousTo)}${s.dataAsOf ? ` · số liệu đến ${formatDateTime(s.dataAsOf)}` : ''}`
          : undefined
      }
      href={href}
    >
      {q.isPending ? (
        <KpiSkeleton />
      ) : q.error ? (
        <ErrorState className="min-h-40" error={q.error} onRetry={() => void q.refetch()} />
      ) : !s ? (
        <KpiSkeleton />
      ) : s.current.orderCount === 0 && s.previous.orderCount === 0 ? (
        <EmptyState
          className="min-h-24 p-4"
          title={emptyTitle}
          description="Doanh thu tính trên đơn đã chốt theo ngày đặt hàng."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <KpiRow current={s.current} previous={s.previous} previousLabel={previousLabel} />
      )}
    </WidgetFrame>
  );
}

function KpiRow({
  current: c,
  previous: p,
  previousLabel,
}: {
  current: SalesKpis;
  previous: SalesKpis;
  previousLabel: string;
}) {
  const count = (n: number) => formatMoney(String(n), { unit: '' });
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      <KpiCard
        label="Doanh thu"
        value={formatMoney(c.revenue)}
        detail={
          <Delta
            pct={growthPct(c.revenue, p.revenue)}
            hasCurrent={!isZero(c.revenue)}
            text={`${previousLabel} ${formatMoney(p.revenue)}`}
          />
        }
      />
      <KpiCard
        label="Số đơn"
        value={count(c.orderCount)}
        detail={
          <Delta
            pct={growthPct(String(c.orderCount), String(p.orderCount))}
            hasCurrent={c.orderCount > 0}
            text={`${previousLabel} ${count(p.orderCount)}`}
          />
        }
      />
      <KpiCard
        label="Giá trị TB/đơn"
        value={formatMoney(c.aov)}
        detail={
          <Delta
            pct={growthPct(c.aov, p.aov)}
            hasCurrent={!isZero(c.aov)}
            text={`${previousLabel} ${formatMoney(p.aov)}`}
          />
        }
      />
      <KpiCard
        label="Lãi gộp"
        value={
          <span className={c.grossProfit.startsWith('-') ? 'text-destructive' : undefined}>
            {formatMoney(c.grossProfit)}
          </span>
        }
        detail={
          <Delta
            pct={growthPct(c.grossProfit, p.grossProfit)}
            hasCurrent={!isZero(c.grossProfit)}
            text={(() => {
              const m = ratioPct(c.grossProfit, c.revenue);
              return m === null
                ? `${previousLabel} ${formatMoney(p.grossProfit)}`
                : `${m.replace('.', ',')}% trên doanh thu`;
            })()}
          />
        }
      />
    </div>
  );
}

function Delta({
  pct,
  hasCurrent,
  text,
}: {
  pct: string | null;
  hasCurrent: boolean;
  text: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <GrowthIndicator pct={pct} hasCurrent={hasCurrent} />
      <span>{text}</span>
    </span>
  );
}

const dayLabel = (period: string) => `${period.slice(8, 10)}/${period.slice(5, 7)}`;

/** Doanh thu theo ngày 30 ngày gần nhất (gồm hôm nay), đường kỳ trước 30 ngày liền trước. */
export function RevenueChartWidget({ today }: { today: string }) {
  const range: DayRange = { from: shiftDay(today, -(CHART_DAYS - 1)), to: today };
  const q = useDashboardSalesTimeseries(range, true);
  const t = q.data;
  return (
    <WidgetFrame
      title={`Doanh thu ${CHART_DAYS} ngày`}
      note="hôm nay chưa hết ngày"
      href={reportHref(range, { gran: 'day' })}
      className="rounded-md border bg-card p-3 xl:col-span-2"
    >
      {q.isPending ? (
        <div role="status" aria-label="Đang tải biểu đồ">
          <Skeleton className="h-60" />
        </div>
      ) : q.error ? (
        <ErrorState className="min-h-60" error={q.error} onRetry={() => void q.refetch()} />
      ) : !t ? (
        <Skeleton className="h-60" />
      ) : t.totals.orderCount === 0 && t.previousTotals.orderCount === 0 ? (
        <EmptyState
          className="min-h-60"
          title={`Chưa có đơn đã chốt trong ${CHART_DAYS * 2} ngày gần đây`}
          description="Biểu đồ hiện khi có đơn đã chốt."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ComparisonLineChart
            points={t.points.map<ComparisonPoint>((p, i) => {
              const prev = t.previousPoints[i];
              return {
                key: p.period,
                label: dayLabel(p.period),
                current: p.revenue,
                previous: prev?.revenue ?? null,
                previousLabel: prev ? `Kỳ trước (${dayLabel(prev.period)})` : 'Kỳ trước',
              };
            })}
            format={(v) => formatMoney(v)}
            currentLabel={`${CHART_DAYS} ngày này`}
            previousLabel={`${CHART_DAYS} ngày trước`}
            ariaLabel={`Doanh thu theo ngày, ${CHART_DAYS} ngày gần nhất so với ${CHART_DAYS} ngày trước`}
            tooltipExtra={(p) => <GrowthIndicator pct={growthPct(p.current, p.previous)} />}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tổng {formatMoney(t.totals.revenue)} ·{' '}
            {formatMoney(String(t.totals.orderCount), { unit: '' })} đơn · {CHART_DAYS} ngày trước{' '}
            {formatMoney(t.previousTotals.revenue)}{' '}
            <GrowthIndicator
              pct={growthPct(t.totals.revenue, t.previousTotals.revenue)}
              hasCurrent={!isZero(t.totals.revenue)}
            />
          </p>
        </>
      )}
    </WidgetFrame>
  );
}

/** Top 5 SKU theo doanh thu, tháng này. */
export function TopProductsWidget({ today }: { today: string }) {
  const range: DayRange = { from: `${today.slice(0, 8)}01`, to: today };
  const q = useDashboardTopProducts(range, 'revenue', TOP_LIMIT, true);
  const d = q.data;
  return (
    <WidgetFrame
      title="Bán chạy tháng này"
      note="theo doanh thu"
      href={reportHref(range, { tab: 'top' })}
      className="rounded-md border bg-card p-3"
    >
      {q.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Đang tải">
          {Array.from({ length: TOP_LIMIT }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState className="min-h-40" error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <Skeleton className="h-32" />
      ) : d.items.length === 0 ? (
        <EmptyState
          className="min-h-40 p-4"
          title="Tháng này chưa bán được sản phẩm nào"
          description="Xếp hạng tính trên đơn đã chốt."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <BarList
          ariaLabel="Top sản phẩm bán chạy theo doanh thu tháng này"
          items={d.items.map((it) => ({
            key: it.sku.id,
            label: (
              <span title={`${it.sku.code} · ${it.sku.name}`}>
                <span className="mr-1 tabular-nums text-muted-foreground">{it.rank}.</span>
                {it.sku.name}
              </span>
            ),
            value: it.revenue,
            display: (
              <span className="flex items-center justify-end gap-1.5">
                {formatMoney(it.revenue)}
                <GrowthIndicator pct={it.growthPct} hasCurrent={it.previousRank === null} />
              </span>
            ),
          }))}
        />
      )}
    </WidgetFrame>
  );
}
