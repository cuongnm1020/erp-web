'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import { useDashboardPendingOrders, useDashboardShipping } from '../api/use-dashboard';
import { WidgetFrame } from './sales-widgets';

export const PENDING_TAKE = 8;
/** Ngưỡng "hãng giữ quá N ngày" — cùng mặc định với màn Theo dõi giao hàng. */
export const HOLD_DAYS = 5;

const DENSE_HEAD = 'h-8 px-3.5 text-xs';
const DENSE_CELL = 'whitespace-nowrap px-3.5 py-1.5';
const PENDING_HREF = '/crm/orders?status=PENDING_APPROVAL';
const count = (n: number) => formatMoney(String(n), { unit: '' });

/**
 * Đơn chờ duyệt mới nhất trong phạm vi khách của người xem (API scope). Cột "Chờ" tính từ lúc tạo
 * đơn. Lý do chờ duyệt (vượt hạn mức, giảm giá tay, nợ quá hạn) chờ API trả trên danh sách.
 */
export function PendingOrdersWidget() {
  const q = useDashboardPendingOrders(PENDING_TAKE, true);
  const d = q.data;
  return (
    <WidgetFrame
      title="Đơn chờ duyệt"
      extra={d ? <StatusBadge tone="warn">{`${count(d.total)} đơn`}</StatusBadge> : undefined}
      href={PENDING_HREF}
      linkLabel="Xem tất cả"
      bodyClassName="p-0"
    >
      {q.isPending ? (
        <ListSkeleton className="p-3.5" rows={4} columns={4} />
      ) : q.error ? (
        <ErrorState className="min-h-40" error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <ListSkeleton className="p-3.5" rows={4} columns={4} />
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
                <TableHead className={cn(DENSE_HEAD, 'text-right')}>Chờ</TableHead>
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
                  <TableCell
                    className={cn(DENSE_CELL, 'text-right tabular-nums text-muted-foreground')}
                    title={`Tạo lúc ${formatDateTime(o.createdAt)}`}
                  >
                    {formatRelative(o.createdAt)}
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

/**
 * Giao hàng trong ngày (/shipment-monitor/summary) dạng luồng 4 bước + bảng theo hãng. Bấm bước mở
 * đúng danh sách bên màn theo dõi. Bước cảnh báo có icon ngoài màu (không chỉ dựa vào màu).
 */
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
      bodyClassName="p-0"
    >
      {q.isPending ? (
        <div
          className="grid grid-cols-2 gap-2 p-3.5 xl:grid-cols-4"
          role="status"
          aria-label="Đang tải"
        >
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
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3.5 xl:grid-cols-4">
            {(
              [
                ['PACKED', 'Đã đóng gói', d.totals.packed, 'bg-primary'],
                ['HANDED_OVER', 'Đã bàn giao hãng', d.totals.handedOver, 'bg-primary/75'],
                ['HOLDING', 'Hãng đang giữ', d.totals.holding, 'bg-primary/50'],
                ['OVERDUE', `Giữ quá ${d.holdDays} ngày`, d.totals.holdingOverdue, 'bg-warning'],
              ] as const
            ).map(([view, label, n, bar]) => {
              const alarm = view === 'OVERDUE' && n > 0;
              return (
                <Link
                  key={view}
                  href={href(view)}
                  className="group flex flex-col gap-0.5 rounded-md p-1 hover:bg-muted"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {view === 'OVERDUE' ? (
                      <TriangleAlert aria-hidden className="h-3.5 w-3.5 text-warning" />
                    ) : null}
                    {label}
                  </span>
                  <span
                    className={cn(
                      'text-xl font-semibold leading-7 tabular-nums',
                      alarm && 'text-warning',
                    )}
                  >
                    {count(n)}
                  </span>
                  <span aria-hidden className={cn('mt-1 h-1.5 rounded-sm', bar)} />
                </Link>
              );
            })}
          </div>
          {d.byCarrier.length > 0 ? (
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className={DENSE_HEAD}>Hãng</TableHead>
                    <TableHead className={cn(DENSE_HEAD, 'text-right')}>Bàn giao</TableHead>
                    <TableHead className={cn(DENSE_HEAD, 'text-right')}>Đang giữ</TableHead>
                    <TableHead className={cn(DENSE_HEAD, 'text-right')}>
                      Quá {d.holdDays} ngày
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.byCarrier.map((c) => (
                    <TableRow key={c.carrierId ?? 'none'}>
                      <TableCell className={DENSE_CELL}>
                        {c.carrierName ?? 'Chưa gán hãng'}
                      </TableCell>
                      <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                        {count(c.handedOver)}
                      </TableCell>
                      <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                        {count(c.holding)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          DENSE_CELL,
                          'text-right tabular-nums',
                          c.holdingOverdue > 0 && 'font-semibold text-warning',
                        )}
                      >
                        {count(c.holdingOverdue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}
    </WidgetFrame>
  );
}
