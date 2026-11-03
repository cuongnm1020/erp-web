'use client';

import { AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { groupVi } from '@/lib/format';
import type { OrderFlow } from '../api/use-orders';
import {
  ORDER_FLOW_GROUPS,
  orderFlowLabel,
  type OrderFlowFamily,
  type OrderFlowGroup,
} from '../labels';

/** Lớp màu theo họ — viết đủ chuỗi để Tailwind sinh lớp. */
const TONE: Record<
  OrderFlowFamily,
  { solid: string; weak: string; text: string; border: string; borderTop: string }
> = {
  wait: {
    solid: 'bg-flow-wait',
    weak: 'bg-flow-wait-weak',
    text: 'text-flow-wait',
    border: 'border-flow-wait',
    borderTop: 'border-t-flow-wait',
  },
  fulfil: {
    solid: 'bg-flow-fulfil',
    weak: 'bg-flow-fulfil-weak',
    text: 'text-flow-fulfil',
    border: 'border-flow-fulfil',
    borderTop: 'border-t-flow-fulfil',
  },
  ship: {
    solid: 'bg-flow-ship',
    weak: 'bg-flow-ship-weak',
    text: 'text-flow-ship',
    border: 'border-flow-ship',
    borderTop: 'border-t-flow-ship',
  },
  done: {
    solid: 'bg-flow-done',
    weak: 'bg-flow-done-weak',
    text: 'text-flow-done',
    border: 'border-flow-done',
    borderTop: 'border-t-flow-done',
  },
  issue: {
    solid: 'bg-flow-issue',
    weak: 'bg-flow-issue-weak',
    text: 'text-flow-issue',
    border: 'border-flow-issue',
    borderTop: 'border-t-flow-issue',
  },
  off: {
    solid: 'bg-flow-off',
    weak: 'bg-flow-off-weak',
    text: 'text-flow-off',
    border: 'border-flow-off',
    borderTop: 'border-t-flow-off',
  },
};

/** Họ màu của từng trạng thái (chip con) — Thành công / Đã hủy khác họ với nhóm chứa nó. */
const FLOW_FAMILY: Partial<Record<OrderFlow, OrderFlowFamily>> = {
  DELIVERED: 'done',
  CANCELLED: 'off',
};

type Counts = Partial<Record<OrderFlow, number>> | undefined;

const sumOf = (flows: readonly OrderFlow[], counts: Counts) => {
  if (!counts) return undefined;
  let n = 0;
  for (const f of flows) {
    const c = counts[f];
    if (c === undefined) return undefined;
    n += c;
  }
  return n;
};

function Count({ n, className }: { n: number | undefined; className?: string }) {
  if (n === undefined) return <Skeleton className="h-3 w-6" aria-label="Đang đếm" />;
  return <span className={cn('tabular-nums', className)}>{groupVi(String(n))}</span>;
}

/**
 * Tab trạng thái đơn hai tầng (design system FlowTabs, 2026-11-03): 4 tab cha theo giai đoạn
 * + dải chip con của nhóm đang mở. `searching` = đang xem mọi trạng thái (ô tìm có chữ hoặc
 * `?group=all`) — tab cha mờ, không tab nào chọn, dòng báo + "Quay lại tab".
 */
export function OrderFlowTabs({
  group,
  flow,
  counts,
  searching,
  searchingLabel,
  onGroupChange,
  onFlowChange,
  onExitSearch,
}: {
  group: OrderFlowGroup;
  flow: OrderFlow | undefined;
  counts: Counts;
  searching: boolean;
  /** Chữ đang tìm (trống = link `group=all`). */
  searchingLabel: string;
  onGroupChange: (g: OrderFlowGroup) => void;
  onFlowChange: (f: OrderFlow | undefined) => void;
  onExitSearch: () => void;
}) {
  const current = ORDER_FLOW_GROUPS.find((g) => g.group === group) ?? ORDER_FLOW_GROUPS[0]!;
  const tone = TONE[current.family];
  return (
    <div className="mb-3">
      <div
        role="tablist"
        aria-label="Nhóm trạng thái đơn"
        className={cn('grid grid-cols-2 gap-2 md:grid-cols-4', searching && 'opacity-60')}
      >
        {ORDER_FLOW_GROUPS.map((g) => {
          const t = TONE[g.family];
          const active = !searching && g.group === group;
          const n = sumOf(g.flows, counts);
          return (
            <button
              key={g.group}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onGroupChange(g.group)}
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left',
                !searching && 'md:rounded-b-none',
                active ? t.solid : t.weak,
              )}
            >
              {g.group === 'issue' && n !== undefined && n > 0 ? (
                <AlertTriangle
                  aria-hidden
                  className={cn('h-4 w-4 flex-none', active ? 'text-primary-foreground' : t.text)}
                />
              ) : null}
              <span className="grid min-w-0">
                <span
                  className={cn(
                    'truncate text-sm font-semibold',
                    active ? 'text-primary-foreground' : t.text,
                  )}
                >
                  {g.label}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-xs md:block',
                    active ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {g.flows.map(orderFlowLabel).join(' · ')}
                </span>
              </span>
              <Count
                n={n}
                className={cn(
                  'ml-auto text-base font-semibold',
                  active ? 'text-primary-foreground' : t.text,
                )}
              />
            </button>
          );
        })}
      </div>

      {searching ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-info-line bg-info-weak px-3 py-2 text-sm">
          <Search aria-hidden className="h-4 w-4 text-info" />
          {searchingLabel ? (
            <span>
              Đang tìm “<span className="font-semibold">{searchingLabel}</span>” trên mọi trạng thái
            </span>
          ) : (
            <span>Đang xem đơn ở mọi trạng thái</span>
          )}
          <Button variant="link" size="sm" onClick={onExitSearch}>
            Quay lại tab {current.label}
          </Button>
        </div>
      ) : (
        <div
          role="tablist"
          aria-label={`Trạng thái trong ${current.label}`}
          className={cn(
            'mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border-t-2 p-2 md:mt-0 md:rounded-t-none',
            tone.weak,
            tone.borderTop,
          )}
        >
          <FlowChip
            label={`Tất cả ${current.label.toLowerCase()}`}
            n={sumOf(current.flows, counts)}
            family={current.family}
            active={flow === undefined}
            onClick={() => onFlowChange(undefined)}
          />
          {current.flows.map((f) => (
            <FlowChip
              key={f}
              label={orderFlowLabel(f)}
              n={counts?.[f]}
              family={FLOW_FAMILY[f] ?? current.family}
              active={flow === f}
              onClick={() => onFlowChange(f)}
            />
          ))}
          {current.done.length ? (
            <>
              <span aria-hidden className="mx-0.5 w-px self-stretch bg-input-soft" />
              <span className="text-xs font-semibold text-muted-foreground">Đã xong</span>
              {current.done.map((f) => (
                <FlowChip
                  key={f}
                  label={orderFlowLabel(f)}
                  n={counts?.[f]}
                  family={FLOW_FAMILY[f] ?? current.family}
                  active={flow === f}
                  onClick={() => onFlowChange(f)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}
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
        active
          ? cn(t.solid, 'font-semibold text-primary-foreground')
          : cn(t.weak, 'text-foreground'),
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full bg-card px-1.5 text-xs leading-5',
          n === 0 ? 'text-subtle-foreground' : cn('font-semibold', t.text),
        )}
      >
        <Count n={n} />
      </span>
    </button>
  );
}
