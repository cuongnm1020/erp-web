'use client';

import type { LucideIcon } from 'lucide-react';
import { CircleAlert, Clock3, Package, TrendingDown, Truck } from 'lucide-react';
import Link from 'next/link';
import { shiftDay } from '@/components/data/date-range-picker';
import { GrowthIndicator, growthPct } from '@/components/data/growth-indicator';
import { EmptyState, ErrorState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatMoney, formatQuantity } from '@/lib/format';
import {
  useDashboardFlowCounts,
  useDashboardLowStock,
  type ReplenishmentRow,
} from '../api/use-dashboard';

/** Số SKU của ô sắp hết hàng — dải "Cần xử lý" dùng chung truy vấn này (cùng key, một request). */
export const LOW_STOCK_TAKE = 5;

const count = (n: number) => formatMoney(String(n), { unit: '' });

/**
 * Mốc "hôm qua cùng giờ" (ISO) làm tròn xuống phút — key truy vấn chỉ đổi mỗi phút, không đổi mỗi
 * lần render.
 */
function yesterdaySameTime(): string {
  const minute = Math.floor(Date.now() / 60_000) * 60_000;
  return new Date(minute - 24 * 60 * 60_000).toISOString();
}

/**
 * Hàng đầu Tổng quan (redesign 2026-10-17): tổng đơn hôm nay | sản phẩm sắp hết | đơn mới theo giờ.
 * Mỗi cột hiện theo quyền (sales_order.read / stock.read); số liệu theo kho đang chọn (header).
 */
export function TodayCard({
  today,
  canOrders,
  canStock,
}: {
  today: string;
  canOrders: boolean;
  canStock: boolean;
}) {
  return (
    <section
      aria-label="Đơn hôm nay"
      className={cn(
        'grid divide-y rounded-lg border bg-card lg:divide-x lg:divide-y-0',
        canOrders && canStock
          ? 'lg:grid-cols-[minmax(180px,220px)_minmax(0,1.3fr)_minmax(0,1fr)]'
          : canOrders
            ? 'lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]'
            : 'lg:grid-cols-1',
      )}
    >
      {canOrders ? <TodayTotal today={today} /> : null}
      {canStock ? <LowStock /> : null}
      {canOrders ? <HourlyPlaceholder /> : null}
    </section>
  );
}

/**
 * Mọi đơn đặt trong ngày (giờ VN) — tab "Tất cả" của danh sách đơn, GỒM CẢ ĐƠN HỦY (user chốt
 * 2026-10-17). So hôm qua đến cùng giờ + cả ngày hôm qua.
 */
function TodayTotal({ today }: { today: string }) {
  const yesterday = shiftDay(today, -1);
  const qToday = useDashboardFlowCounts({ from: today, to: today }, true);
  const qSame = useDashboardFlowCounts({ from: yesterday, to: yesterdaySameTime() }, true);
  const qYest = useDashboardFlowCounts({ from: yesterday, to: yesterday }, true);
  const t = qToday.data;
  const failed = qToday.error ?? qSame.error ?? qYest.error;

  return (
    <div className="flex min-w-0 flex-col gap-1 p-4">
      <span className="text-sm font-semibold">Tổng đơn hôm nay</span>
      {qToday.isPending ? (
        <div role="status" aria-label="Đang tải" className="flex flex-col gap-2">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : failed ? (
        <ErrorState
          className="min-h-24 p-2"
          error={failed}
          onRetry={() => {
            if (qToday.error) void qToday.refetch();
            if (qSame.error) void qSame.refetch();
            if (qYest.error) void qYest.refetch();
          }}
        />
      ) : t ? (
        <>
          <Link
            href={`/crm/orders?from=${today}&to=${today}`}
            className="w-fit text-4xl font-semibold leading-tight text-primary hover:underline"
          >
            {count(t.total)}
          </Link>
          <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {qSame.data ? (
              <span>
                <GrowthIndicator
                  pct={growthPct(String(t.total), String(qSame.data.total))}
                  hasCurrent={t.total > 0}
                />{' '}
                so với hôm qua cùng giờ ({count(qSame.data.total)})
              </span>
            ) : null}
            {qYest.data ? (
              <span>
                Cả ngày hôm qua:{' '}
                <span className="font-semibold text-foreground">{count(qYest.data.total)}</span> đơn
              </span>
            ) : null}
            <span>gồm {count(t.CANCELLED)} đơn đã hủy</span>
          </span>
        </>
      ) : null}
    </div>
  );
}

const STOCK_STATUS: Record<ReplenishmentRow['status'], [StatusTone, string]> = {
  OUT: ['err', 'Hết hàng'],
  BELOW: ['warn', 'Dưới mức tồn'],
  SOON: ['draft', 'Sắp hết'],
  OK: ['neutral', 'Đủ hàng'],
};

/** 5 SKU cần nhập (GET /stock/replenishment) — hết / dưới mức tồn / sắp hết, theo kho đang chọn. */
function LowStock() {
  const q = useDashboardLowStock(LOW_STOCK_TAKE, true);
  const d = q.data;
  return (
    <section aria-label="Sản phẩm sắp hết hàng" className="min-w-0 p-4">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-semibold">Sản phẩm sắp hết hàng</h3>
        <span className="text-xs text-muted-foreground">kho đang chọn · theo mức tồn đã đặt</span>
        <Link
          href="/wms/reorder-points"
          className="ml-auto whitespace-nowrap text-xs font-semibold text-primary hover:underline"
        >
          Cảnh báo nhập hàng
        </Link>
      </div>
      {q.isPending ? (
        <div role="status" aria-label="Đang tải" className="flex flex-col gap-2 pt-1">
          {Array.from({ length: LOW_STOCK_TAKE }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState className="min-h-32" error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? null : d.items.length === 0 ? (
        <EmptyState
          className="min-h-32 p-3"
          title="Không có sản phẩm nào dưới mức tồn"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/wms/reorder-points">Mở cảnh báo nhập hàng</Link>
            </Button>
          }
        />
      ) : (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b text-right text-xs text-muted-foreground">
              <th className="w-1/2 py-1 pr-1.5 text-left font-normal">Sản phẩm</th>
              <th className="px-1.5 py-1 font-normal">Tồn khả dụng</th>
              <th className="px-1.5 py-1 font-normal">Bán TB/ngày</th>
              <th className="px-1.5 py-1 font-normal">Đủ bán</th>
              <th className="py-1 pl-1.5 font-normal">
                <span className="sr-only">Trạng thái</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((r) => {
              const [tone, label] = STOCK_STATUS[r.status];
              return (
                <tr key={r.skuId} className="border-b text-right last:border-b-0">
                  <td
                    className="truncate py-1.5 pr-1.5 text-left"
                    title={`${r.skuCode} · ${r.skuName}`}
                  >
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                      {r.skuCode}
                    </span>
                    {r.skuName}
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-1.5 py-1.5',
                      r.status === 'OUT' && 'font-semibold text-destructive',
                    )}
                  >
                    {formatQuantity(r.available)}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5">{formatQuantity(r.avgDaily)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1.5">
                    {r.daysLeft === null ? '—' : `${r.daysLeft.replace('.', ',')} ngày`}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pl-1.5">
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Chờ API: đếm đơn mới theo từng giờ (hôm nay + hôm qua) — chưa có endpoint, không vẽ số giả. */
function HourlyPlaceholder() {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <span className="text-xs text-muted-foreground">Đơn mới theo giờ · hôm nay so hôm qua</span>
      <div className="flex min-h-28 flex-1 items-center justify-center rounded-md border border-dashed px-3 text-center text-sm text-muted-foreground">
        Biểu đồ theo giờ sẽ hiện khi có API đếm đơn theo giờ.
      </div>
    </div>
  );
}

interface ActionTile {
  key: string;
  label: string;
  icon: LucideIcon;
  /** 3 mức của brief: đỏ chặn / vàng cảnh báo / xám thông tin; brand cho việc thường. */
  tone: 'warn' | 'danger' | 'info' | 'brand';
  href?: string;
  value: number | undefined;
  pending: boolean;
  /** Chưa có API — hiện "—" + ghi chú, không link. */
  noApi?: boolean;
}

const TILE_TONE: Record<ActionTile['tone'], string> = {
  warn: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  brand: 'bg-accent text-primary',
};

/**
 * Dải "Cần xử lý" (redesign 2026-10-17): 5 con số dẫn thẳng vào danh sách đã lọc. Đơn đếm qua
 * GET /sales-orders/flow-counts (toàn bộ, không giới hạn ngày), SKU cần nhập = `alertCount` của
 * cảnh báo nhập hàng. "Sự cố / hoàn hàng" chờ API đếm sự cố đang mở.
 */
export function NeedsActionStrip({
  canOrders,
  canStock,
}: {
  canOrders: boolean;
  canStock: boolean;
}) {
  const qAll = useDashboardFlowCounts({}, canOrders);
  const qNoCarrier = useDashboardFlowCounts({ noCarrier: true }, canOrders);
  const qLow = useDashboardLowStock(LOW_STOCK_TAKE, canStock);
  const all = qAll.data;
  const nc = qNoCarrier.data;
  const failed = [qAll, qNoCarrier, qLow].filter((q) => q.error);

  const tiles: ActionTile[] = [];
  if (canOrders) {
    tiles.push(
      {
        key: 'pending',
        label: 'Đơn chờ duyệt',
        icon: Clock3,
        tone: 'warn',
        href: '/crm/orders?flow=PENDING_APPROVAL',
        value: all?.PENDING_APPROVAL,
        pending: qAll.isPending,
      },
      {
        key: 'warehouse',
        label: 'Chờ xử lý kho',
        icon: Package,
        tone: 'brand',
        href: '/crm/orders?flow=WAREHOUSE',
        value: all?.WAREHOUSE,
        pending: qAll.isPending,
      },
      {
        key: 'no-carrier',
        label: 'Chưa gán ĐVVC',
        icon: Truck,
        tone: 'info',
        href: '/crm/orders?noCarrier=true',
        // Đơn còn ở kho (chờ kho / đang pick / đã đóng gói) mà chưa chọn hãng.
        value: nc ? nc.WAREHOUSE + nc.PICKING + nc.PACKED : undefined,
        pending: qNoCarrier.isPending,
      },
      {
        key: 'incident',
        label: 'Sự cố / hoàn hàng',
        icon: CircleAlert,
        tone: 'danger',
        value: undefined,
        pending: false,
        noApi: true,
      },
    );
  }
  if (canStock) {
    tiles.push({
      key: 'reorder',
      label: 'SKU cần nhập thêm',
      icon: TrendingDown,
      tone: 'warn',
      href: '/wms/reorder-points',
      value: qLow.data?.alertCount,
      pending: qLow.isPending,
    });
  }
  if (tiles.length === 0) return null;

  return (
    <section aria-label="Cần xử lý" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <Tile key={t.key} tile={t} />
        ))}
      </div>
      {failed.length > 0 ? (
        <ErrorState
          className="min-h-24 rounded-lg border bg-card p-3"
          error={failed[0]!.error}
          onRetry={() => failed.forEach((q) => void q.refetch())}
        />
      ) : null}
    </section>
  );
}

function Tile({ tile: t }: { tile: ActionTile }) {
  const Icon = t.icon;
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'row-span-2 flex h-8 w-8 items-center justify-center rounded-md',
          TILE_TONE[t.tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          'text-xl font-semibold leading-6',
          t.tone === 'danger' && (t.value ?? 0) > 0 && 'text-destructive',
        )}
      >
        {t.pending ? (
          <Skeleton className="h-6 w-12" />
        ) : t.value === undefined ? (
          '—'
        ) : (
          count(t.value)
        )}
      </span>
      <span className="text-xs leading-4 text-muted-foreground">
        {t.label}
        {t.noApi ? ' · chờ API' : ''}
      </span>
    </>
  );
  // Mỗi ô kẻ viền trên + trái, -mt-px/-ml-px để viền ở mép thẻ bị cắt (overflow-hidden) — ô trống
  // cuối hàng (số ô lẻ) giữ nền trắng. Viền thuộc ô đứng sau nên không bị ô khác đè.
  const cls =
    '-ml-px -mt-px grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 border-l border-t bg-card px-3.5 py-3';
  return t.href ? (
    <Link href={t.href} className={cn(cls, 'hover:bg-muted')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
