'use client';

import { AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { groupVi } from '@/lib/format';
import type { OrderFlow } from '../api/use-orders';
import { ORDER_FLOW_GROUPS, orderFlowLabel, type OrderFlowFamily } from '../labels';

/** Lớp màu theo họ — viết đủ chuỗi để Tailwind sinh lớp. */
const TONE: Record<
  OrderFlowFamily,
  { solid: string; weak: string; text: string; border: string; borderLeft: string }
> = {
  wait: {
    solid: 'bg-flow-wait',
    weak: 'bg-flow-wait-weak',
    text: 'text-flow-wait',
    border: 'border-flow-wait',
    borderLeft: 'border-l-flow-wait',
  },
  fulfil: {
    solid: 'bg-flow-fulfil',
    weak: 'bg-flow-fulfil-weak',
    text: 'text-flow-fulfil',
    border: 'border-flow-fulfil',
    borderLeft: 'border-l-flow-fulfil',
  },
  ship: {
    solid: 'bg-flow-ship',
    weak: 'bg-flow-ship-weak',
    text: 'text-flow-ship',
    border: 'border-flow-ship',
    borderLeft: 'border-l-flow-ship',
  },
  done: {
    solid: 'bg-flow-done',
    weak: 'bg-flow-done-weak',
    text: 'text-flow-done',
    border: 'border-flow-done',
    borderLeft: 'border-l-flow-done',
  },
  issue: {
    solid: 'bg-flow-issue',
    weak: 'bg-flow-issue-weak',
    text: 'text-flow-issue',
    border: 'border-flow-issue',
    borderLeft: 'border-l-flow-issue',
  },
  off: {
    solid: 'bg-flow-off',
    weak: 'bg-flow-off-weak',
    text: 'text-flow-off',
    border: 'border-flow-off',
    borderLeft: 'border-l-flow-off',
  },
};

/** Họ màu riêng của trạng thái kết thúc — Thành công / Đã hủy khác họ với khối chứa nó. */
const FLOW_FAMILY: Partial<Record<OrderFlow, OrderFlowFamily>> = {
  DELIVERED: 'done',
  CANCELLED: 'off',
};

type Counts = Partial<Record<OrderFlow, number>> | undefined;

/**
 * Tab trạng thái đơn (design system FlowTabs v3, 2026-11-04): cả 14 trạng thái hiện cùng lúc,
 * chia 4 khối màu theo giai đoạn (Chờ xử lý · Kho · Cần xử lý · Vận chuyển), khối không có tên /
 * tổng số; khối và chip tự xuống dòng nên màn hẹp không mất tab. Luôn chọn đúng một trạng thái.
 * `searching` = đang xem mọi trạng thái (ô tìm có chữ hoặc `?group=all`) — các khối mờ, không chip
 * nào chọn, dòng báo + "Quay lại <trạng thái>".
 * `grouped={false}` (màn In đơn, user 2026-11-04): bỏ khối theo giai đoạn, mọi chip xếp sát nhau
 * trên một dòng (vẫn tự xuống dòng khi hẹp); màu chip vẫn theo họ.
 */
export function OrderFlowTabs({
  flow,
  counts,
  searching,
  searchingLabel,
  onFlowChange,
  onExitSearch,
  grouped = true,
}: {
  flow: OrderFlow;
  counts: Counts;
  searching: boolean;
  /** Chữ đang tìm (trống = link `group=all`). */
  searchingLabel: string;
  onFlowChange: (f: OrderFlow) => void;
  onExitSearch: () => void;
  /** Mặc định chia 4 khối màu theo giai đoạn; `false` = một dãy chip liền. */
  grouped?: boolean;
}) {
  const chipsOf = (g: (typeof ORDER_FLOW_GROUPS)[number]) =>
    [...g.flows, ...g.done].map((f) => (
      <FlowChip
        key={f}
        label={orderFlowLabel(f)}
        n={counts?.[f]}
        family={FLOW_FAMILY[f] ?? g.family}
        active={!searching && flow === f}
        onClick={() => onFlowChange(f)}
      />
    ));
  return (
    <div className="mb-3 grid gap-2">
      <div
        role="tablist"
        aria-label="Trạng thái đơn"
        className={cn(
          'flex flex-wrap items-stretch',
          grouped ? 'gap-2' : 'gap-1.5',
          searching && 'opacity-60',
        )}
      >
        {!grouped
          ? ORDER_FLOW_GROUPS.map(chipsOf)
          : ORDER_FLOW_GROUPS.map((g) => {
              const t = TONE[g.family];
              return (
                <div
                  key={g.group}
                  role="group"
                  aria-label={g.label}
                  className={cn(
                    'flex min-w-0 flex-auto basis-full flex-wrap items-center gap-1.5 rounded-lg border-l-4 px-2 py-1.5 md:basis-auto',
                    t.weak,
                    t.borderLeft,
                  )}
                >
                  {chipsOf(g)}
                </div>
              );
            })}
      </div>

      {searching ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info-line bg-info-weak px-3 py-2 text-sm">
          <Search aria-hidden className="h-4 w-4 text-info" />
          {searchingLabel ? (
            <span>
              Đang tìm “<span className="font-semibold">{searchingLabel}</span>” trên mọi trạng thái
            </span>
          ) : (
            <span>Đang xem đơn ở mọi trạng thái</span>
          )}
          <Button variant="link" size="sm" onClick={onExitSearch}>
            Quay lại {orderFlowLabel(flow)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FlowChip({
  label,
  n,
  family,
  active,
  onClick,
}: {
  label: string;
  n: number | undefined;
  family: OrderFlowFamily;
  active: boolean;
  onClick: () => void;
}) {
  const t = TONE[family];
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border pl-2.5 pr-1 text-sm',
        t.border,
        active ? cn(t.solid, 'font-semibold text-primary-foreground') : 'bg-card text-foreground',
      )}
    >
      {family === 'issue' && n !== undefined && n > 0 ? (
        <AlertCircle
          aria-hidden
          className={cn('h-4 w-4', active ? 'text-primary-foreground' : t.text)}
        />
      ) : null}
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs leading-5',
          active ? 'bg-card' : t.weak,
          n === 0 ? 'text-subtle-foreground' : cn('font-semibold', t.text),
        )}
      >
        {n === undefined ? (
          <Skeleton className="h-3 w-6" aria-label="Đang đếm" />
        ) : (
          <span className="tabular-nums">{groupVi(String(n))}</span>
        )}
      </span>
    </button>
  );
}
