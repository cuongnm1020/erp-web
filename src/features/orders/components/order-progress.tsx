import { Check } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import type { OrderFlow } from '../api/use-orders';

const STEPS = ['Đã duyệt', 'Đóng gói', 'Hãng lấy hàng', 'Đang giao', 'Thành công'] as const;

/**
 * Luồng chung của đơn → số bước đã xong + bước đang ở (chỉ số trong STEPS). Đơn kết thúc lệch
 * luồng (sự cố hoàn, hãng hủy, đã hủy) không có thanh tiến độ — chip trạng thái đã nói đủ.
 */
const PROGRESS: Partial<Record<OrderFlow, { done: number; current: number | null }>> = {
  PENDING_APPROVAL: { done: 0, current: 0 },
  WAREHOUSE: { done: 1, current: 1 },
  PICKING: { done: 1, current: 1 },
  PACKED: { done: 2, current: 2 },
  PICKED_UP: { done: 3, current: 3 },
  IN_TRANSIT: { done: 3, current: 3 },
  OUT_FOR_DELIVERY: { done: 3, current: 3 },
  DELIVERED: { done: STEPS.length, current: null },
};

/**
 * Thanh tiến độ giao hàng của một đơn (redesign Bán hàng 2026-10-22) — dùng ở xem nhanh và chi
 * tiết đơn. Chỉ trạng thái hiện tại; giờ từng bước chờ API (mục #3 trong danh sách API cần review).
 */
export function OrderProgress({ flow, className }: { flow: OrderFlow; className?: string }) {
  const p = PROGRESS[flow];
  if (!p) return null;
  return (
    <ol className={cn('flex items-start', className)} aria-label="Tiến độ đơn hàng">
      {STEPS.map((label, i) => {
        const done = i < p.done;
        const current = p.current === i;
        return (
          <Fragment key={label}>
            {i > 0 ? (
              <li
                aria-hidden
                className={cn(
                  'mt-2.5 h-0.5 min-w-3 flex-1',
                  i <= p.done ? 'bg-success' : 'bg-input-soft',
                )}
              />
            ) : null}
            <li
              className="flex flex-none flex-col items-center gap-1 text-center text-xs"
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  done
                    ? 'border-success bg-success text-primary-foreground'
                    : current
                      ? 'border-primary bg-secondary'
                      : 'border-input-soft bg-card',
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  current
                    ? 'font-semibold text-primary'
                    : done
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {label}
                {done ? <span className="sr-only"> (xong)</span> : null}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
