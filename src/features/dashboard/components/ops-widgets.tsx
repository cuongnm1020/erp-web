'use client';

import Link from 'next/link';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useDashboardPendingOrders, useDashboardShipping } from '../api/use-dashboard';
import { WidgetFrame } from './sales-widgets';

export const PENDING_TAKE = 8;
/** Ngưỡng "hãng giữ quá N ngày" — cùng mặc định với màn Theo dõi giao hàng. */
export const HOLD_DAYS = 5;

const DENSE_HEAD = 'h-8 px-2.5 text-xs';
const DENSE_CELL = 'whitespace-nowrap px-2.5 py-1.5';
const PENDING_HREF = '/crm/orders?status=PENDING_APPROVAL';

/** Đơn chờ duyệt mới nhất trong phạm vi khách của người xem (API scope). */
export function PendingOrdersWidget() {
  const q = useDashboardPendingOrders(PENDING_TAKE, true);
  const d = q.data;
  return (
    <WidgetFrame
      title="Đơn chờ duyệt"
      note={d ? `· ${formatMoney(String(d.total), { unit: '' })} đơn` : undefined}
      href={PENDING_HREF}
      linkLabel="Xem tất cả"
      className="rounded-md border bg-card p-3"
    >
      {q.isPending ? (
        <ListSkeleton rows={4} columns={4} />
      ) : q.error ? (
        <ErrorState className="min-h-40" error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <ListSkeleton rows={4} columns={4} />
      ) : d.items.length === 0 ? (
        <EmptyState
          className="min-h-40 p-4"
          title="Không có đơn nào chờ duyệt"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/orders">Mở danh sách đơn</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className={DENSE_HEAD}>Số đơn</TableHead>
                <TableHead className={DENSE_HEAD}>Khách hàng</TableHead>
                <TableHead className={cn(DENSE_HEAD, 'text-right')}>Giá trị</TableHead>
                <TableHead className={DENSE_HEAD}>Ngày đặt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className={cn(DENSE_CELL, 'font-mono text-xs')}>
                    <Link href={`/crm/orders/${o.id}`} className="text-primary hover:underline">
                      {o.docNumber}
                    </Link>
                  </TableCell>
                  <TableCell className={cn(DENSE_CELL, 'max-w-56 truncate')}>
                    {o.customer.name}
                  </TableCell>
                  <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                    {formatMoney(o.total)}
                  </TableCell>
                  <TableCell className={cn(DENSE_CELL, 'tabular-nums text-muted-foreground')}>
                    {formatDateTime(o.orderDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </WidgetFrame>
  );
}

/** Giao hàng trong ngày — số từ /shipment-monitor/summary, bấm ô mở đúng danh sách bên màn theo dõi. */
export function ShippingWidget({ today }: { today: string }) {
  const q = useDashboardShipping(today, HOLD_DAYS, true);
  const d = q.data;
  const href = (view: string) => `/wms/shipping?view=${view}`;
  return (
    <WidgetFrame
      title="Giao hàng hôm nay"
      note={d ? `cập nhật ${formatDateTime(d.asOf)} · tự làm mới mỗi phút` : undefined}
      href="/wms/shipping"
      linkLabel="Mở theo dõi giao hàng"
    >
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4" role="status" aria-label="Đang tải">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState className="min-h-40" error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? null : d.totals.packed === 0 &&
        d.totals.handedOver === 0 &&
        d.totals.holding === 0 ? (
        <EmptyState
          className="min-h-24 p-4"
          title="Hôm nay chưa có đơn đóng gói hay bàn giao, hãng không giữ đơn nào"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/wms/shipping">Mở theo dõi giao hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {(
            [
              ['PACKED', 'Đã đóng gói', d.totals.packed, false],
              ['HANDED_OVER', 'Đã bàn giao hãng', d.totals.handedOver, false],
              ['HOLDING', 'Hãng đang giữ', d.totals.holding, false],
              ['OVERDUE', `Giữ quá ${d.holdDays} ngày`, d.totals.holdingOverdue, true],
            ] as const
          ).map(([view, label, n, alarm]) => (
            <Link
              key={view}
              href={href(view)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <KpiCard
                className="h-full hover:border-primary"
                label={label}
                value={
                  <span className={alarm && n > 0 ? 'text-destructive' : undefined}>
                    {formatMoney(String(n), { unit: '' })}
                  </span>
                }
              />
            </Link>
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}
