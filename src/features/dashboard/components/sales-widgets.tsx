'use client';

import type { LucideIcon } from 'lucide-react';
import { Banknote, ChartLine, ReceiptText, Scale, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarList, ComparisonLineChart, type ComparisonPoint } from '@/components/data/charts';
import { shiftDay } from '@/components/data/date-range-picker';
import { GrowthIndicator, growthPct, ratioPct } from '@/components/data/growth-indicator';
import { EmptyState, ErrorState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
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

/**
 * Khung thẻ của dashboard (redesign 2026-10-17): nền trắng bo 6px, hàng đầu có tiêu đề + ghi chú +
 * link "xem thêm" bên phải, kẻ dưới. `aria-label` = tiêu đề để test / trình đọc màn hình tìm được.
 */
export function WidgetFrame({
  title,
  note,
  href,
  linkLabel = 'Xem báo cáo',
  icon,
  extra,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  note?: ReactNode;
  href?: string;
  linkLabel?: string;
  /** Ô icon trước tiêu đề. */
  icon?: ReactNode;
  /** Chip / nút cạnh tiêu đề. */
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border bg-card', className)} aria-label={title}>
      <div className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-3.5 py-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
        {extra}
        {href ? (
          <Link href={href} className="ml-auto text-sm font-semibold text-primary hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div className={cn('p-3.5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Ô icon nhỏ cạnh tiêu đề / nhãn dòng — `tone` là cặp class nền nhạt + chữ đậm. */
export function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', tone)}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

type MetricKey = 'revenue' | 'orderCount' | 'aov' | 'grossProfit';

/** Bốn dòng của bảng doanh số — màu ô icon theo design (trang trí, không mang nghĩa trạng thái). */
const METRICS: ReadonlyArray<{ key: MetricKey; label: string; icon: LucideIcon; tone: string }> = [
  { key: 'revenue', label: 'Doanh thu', icon: Banknote, tone: 'bg-mod-prod-weak text-mod-prod' },
  {
    key: 'orderCount',
    label: 'Số đơn',
    icon: ReceiptText,
    tone: 'bg-mod-sales-weak text-mod-sales',
  },
  { key: 'aov', label: 'Giá trị TB/đơn', icon: Scale, tone: 'bg-mod-cust-weak text-mod-cust' },
  { key: 'grossProfit', label: 'Lãi gộp', icon: TrendingUp, tone: 'bg-mod-wh-weak text-mod-wh' },
];

const metricStr = (k: SalesKpis, key: MetricKey) =>
  key === 'orderCount' ? String(k.orderCount) : k[key];

function metricValue(k: SalesKpis, key: MetricKey): ReactNode {
  if (key === 'orderCount') return formatMoney(String(k.orderCount), { unit: '' });
  const v = k[key];
  return (
    <span className={key === 'grossProfit' && v.startsWith('-') ? 'text-destructive' : undefined}>
      {formatMoney(v)}
    </span>
  );
}

/**
 * Doanh số (redesign 2026-10-17, theo ảnh user gửi): bảng 4 chỉ số × Hôm nay | Tháng này (ngày 1 →
 * hôm nay, so cùng số ngày liền trước — kỳ trước do API trả). Mức tăng giảm của hôm nay tô xám vì
 * ngày chưa kết thúc (API so với CẢ NGÀY hôm qua — "cùng giờ" chờ API); lãi gộp hôm nay hiện % trên
 * doanh thu. Dưới bảng là biểu đồ doanh thu 30 ngày.
 */
export function SalesWidget({ today, className }: { today: string; className?: string }) {
  const todayRange: DayRange = { from: today, to: today };
  const monthRange: DayRange = { from: `${today.slice(0, 8)}01`, to: today };
  const qd = useDashboardSalesSummary(todayRange, true);
  const qm = useDashboardSalesSummary(monthRange, true);
  const d = qd.data;
  const m = qm.data;
  const failed = qd.error ?? qm.error;
  const asOf = d?.dataAsOf ?? m?.dataAsOf;

  return (
    <WidgetFrame
      title="Doanh số"
      icon={<IconTile icon={ChartLine} tone="bg-mod-rpt-weak text-mod-rpt" />}
      note={`đơn đã chốt, theo ngày đặt${asOf ? ` · số liệu đến ${formatDateTime(asOf)}` : ''}`}
      href={reportHref(monthRange)}
      className={className}
      bodyClassName="p-0"
    >
      {qd.isPending || qm.isPending ? (
        <div className="flex flex-col gap-2 p-3.5" role="status" aria-label="Đang tải">
          {METRICS.map((r) => (
            <Skeleton key={r.key} className="h-9" />
          ))}
        </div>
      ) : failed ? (
        <ErrorState
          className="min-h-40"
          error={failed}
          onRetry={() => {
            if (qd.error) void qd.refetch();
            if (qm.error) void qm.refetch();
          }}
        />
      ) : !d || !m ? null : m.current.orderCount === 0 && m.previous.orderCount === 0 ? (
        <EmptyState
          className="min-h-24 p-4"
          title="Tháng này và kỳ trước chưa có đơn đã chốt"
          description="Doanh thu tính trên đơn đã chốt theo ngày đặt hàng."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-base">
            <thead>
              <tr className="text-right">
                <th aria-hidden />
                <th
                  colSpan={2}
                  scope="colgroup"
                  className="px-4 pb-1 pt-2.5 font-semibold text-primary"
                >
                  Hôm nay
                </th>
                <th
                  colSpan={2}
                  scope="colgroup"
                  className="border-l px-4 pb-1 pt-2.5 font-semibold"
                >
                  {`Tháng ${today.slice(5, 7)} (1–${Number(today.slice(8, 10))})`}
                </th>
              </tr>
              <tr className="border-y text-right text-sm text-muted-foreground">
                <th className="px-4 py-1.5 text-left font-normal">Chỉ số</th>
                <th className="px-4 py-1.5 font-normal">giá trị</th>
                <th className="px-4 py-1.5 font-normal">so hôm qua</th>
                <th className="border-l px-4 py-1.5 font-normal">giá trị</th>
                <th className="px-4 py-1.5 font-normal">
                  so {rangeText(m.previousFrom, m.previousTo)}
                </th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((r) => {
                const margin =
                  r.key === 'grossProfit'
                    ? ratioPct(d.current.grossProfit, d.current.revenue)
                    : null;
                return (
                  <tr key={r.key} className="border-b text-right last:border-b-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <span className="flex items-center gap-3">
                        <IconTile icon={r.icon} tone={r.tone} />
                        {r.label}
                      </span>
                    </th>
                    <td className="whitespace-nowrap bg-accent/40 px-4 py-2 font-semibold">
                      {metricValue(d.current, r.key)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {r.key === 'grossProfit' ? (
                        <span className="text-sm text-muted-foreground">
                          {margin === null ? '—' : `${margin.replace('.', ',')}% doanh thu`}
                        </span>
                      ) : (
                        <GrowthIndicator
                          muted
                          pct={growthPct(metricStr(d.current, r.key), metricStr(d.previous, r.key))}
                          hasCurrent={!isZero(metricStr(d.current, r.key))}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap border-l bg-muted/60 px-4 py-2 font-semibold">
                      {metricValue(m.current, r.key)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <GrowthIndicator
                        pct={growthPct(metricStr(m.current, r.key), metricStr(m.previous, r.key))}
                        hasCurrent={!isZero(metricStr(m.current, r.key))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <RevenueChart today={today} />
    </WidgetFrame>
  );
}

const dayLabel = (period: string) => `${period.slice(8, 10)}/${period.slice(5, 7)}`;

/**
 * Doanh thu theo ngày 30 ngày gần nhất (gồm hôm nay), đường kỳ trước 30 ngày liền trước. Nằm trong
 * thẻ Doanh số (khối con có tiêu đề riêng, kẻ trên).
 */
function RevenueChart({ today }: { today: string }) {
  const range: DayRange = { from: shiftDay(today, -(CHART_DAYS - 1)), to: today };
  const q = useDashboardSalesTimeseries(range, true);
  const t = q.data;
  const title = `Doanh thu ${CHART_DAYS} ngày`;
  return (
    <section aria-label={title} className="border-t px-3.5 pb-3.5 pt-3">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">hôm nay chưa hết ngày</span>
        <Link
          href={reportHref(range, { gran: 'day' })}
          className="ml-auto text-sm font-semibold text-primary hover:underline"
        >
          Xem báo cáo
        </Link>
      </div>
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
          <p className="mt-2 text-right text-sm text-muted-foreground">
            Tổng{' '}
            <span className="font-semibold text-foreground">{formatMoney(t.totals.revenue)}</span> ·{' '}
            {formatMoney(String(t.totals.orderCount), { unit: '' })} đơn · {CHART_DAYS} ngày trước{' '}
            {formatMoney(t.previousTotals.revenue)}{' '}
            <GrowthIndicator
              pct={growthPct(t.totals.revenue, t.previousTotals.revenue)}
              hasCurrent={!isZero(t.totals.revenue)}
            />
          </p>
        </>
      )}
    </section>
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
