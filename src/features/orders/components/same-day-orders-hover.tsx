'use client';

import { ListOrdered } from 'lucide-react';
import { useRef, useState } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useSameDayOfOrder } from '../api/use-orders';
import { orderStatusLabel, orderStatusTone } from '../labels';

/** Trễ đóng để kịp rê chuột từ icon sang popup. */
const CLOSE_DELAY_MS = 150;

/**
 * Icon cạnh chip "Trùng · N đơn" ở danh sách đơn: rê chuột (hoặc bấm / Enter) → popup các đơn cùng
 * SĐT khách cùng ngày — giờ đặt + sản phẩm khách đặt. Chỉ tải khi mở lần đầu.
 */
export function SameDayOrdersHover({ orderId, count }: { orderId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = useSameDayOfOrder(orderId, open);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  // Dòng bảng bấm là mở xem nhanh — sự kiện từ popup (portal) vẫn nổi qua cây React, chặn ở đây.
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          aria-label={`Xem ${count} đơn trùng khác`}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-warning hover:bg-warning-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 p-3"
          onMouseEnter={show}
          onMouseLeave={hide}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Đơn khác cùng SĐT trong ngày
          </p>
          {q.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : q.isError ? (
            <p className="text-sm text-destructive">{messageFor(q.error)}</p>
          ) : q.data.orders.length === 0 && q.data.hiddenCount === 0 ? (
            <p className="text-sm text-muted-foreground">Không còn đơn trùng.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {q.data.orders.map((o) => (
                <div key={o.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`/crm/orders/${o.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {o.docNumber}
                    </a>
                    <StatusBadge tone={orderStatusTone(o.status)}>
                      {orderStatusLabel(o.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(o.orderDate)} · {o.source === 'PANCAKE' ? 'Pancake' : 'ERP'} ·{' '}
                    {formatMoney(o.total)}
                  </p>
                  {o.items.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="min-w-0 break-words">{it.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            × {formatQuantity(it.qty)}
                            {it.uomCode ? ` ${it.uomCode}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Chưa có sản phẩm</p>
                  )}
                </div>
              ))}
              {q.data.hiddenCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {q.data.orders.length > 0 ? 'Và ' : ''}
                  {q.data.hiddenCount} đơn của team khác — không xem được chi tiết.
                </p>
              ) : null}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}
