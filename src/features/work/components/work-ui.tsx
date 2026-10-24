'use client';

import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardCheck,
  Clock,
  MessageSquare,
  Pause,
  Repeat,
  User,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';
import type { WorkItemSummary, WorkKind, WorkPriority } from '../api/types';
import {
  DEADLINE_CLASS,
  deadlineSub,
  deadlineText,
  KIND_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  statusLabel,
  statusTone,
} from '../labels';

/** Chip trạng thái theo loại việc. */
export function WorkStatusBadge({ w }: { w: Pick<WorkItemSummary, 'kind' | 'status'> }) {
  return (
    <StatusBadge tone={statusTone(w.kind, w.status)}>{statusLabel(w.kind, w.status)}</StatusBadge>
  );
}

export function PriorityText({ p, className }: { p: WorkPriority; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap text-sm', PRIORITY_CLASS[p], className)}>
      {PRIORITY_LABEL[p]}
    </span>
  );
}

const DEADLINE_ICON = {
  over: AlertTriangle,
  warn: Clock,
  run: Clock,
  pause: Pause,
  met: Check,
  miss: X,
  none: null,
} as const;

/** Ô Hạn / SLA: chữ + icon (không chỉ màu) + dòng phụ mốc hạn. */
export function DeadlineCell({
  w,
  sub = true,
}: {
  w: Pick<WorkItemSummary, 'kind' | 'deadline'>;
  sub?: boolean;
}) {
  const t = deadlineText(w);
  const Icon = DEADLINE_ICON[t.tone];
  const line = sub ? deadlineSub(w) : '';
  return (
    <div className="min-w-0">
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap text-sm',
          DEADLINE_CLASS[t.tone],
        )}
      >
        {Icon ? <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
        {t.label}
      </span>
      {line ? <div className="text-xs text-muted-foreground">{line}</div> : null}
    </div>
  );
}

const KIND_ICON: Record<WorkKind, typeof User> = {
  CUSTOMER: MessageSquare,
  INTERNAL: Building2,
  TASK: ClipboardCheck,
};

/** Nhãn loại việc (icon + chữ trung tính — không dùng màu module cho nội dung). */
export function KindTag({
  w,
  children,
}: {
  w: Pick<WorkItemSummary, 'kind' | 'recurrenceId' | 'assignee' | 'assigner'>;
  children?: ReactNode;
}) {
  const personal = w.kind === 'TASK' && w.assignee?.id && w.assignee.id === w.assigner?.id;
  const Icon = personal ? User : w.recurrenceId ? Repeat : KIND_ICON[w.kind];
  const label = personal
    ? 'Việc cá nhân'
    : w.recurrenceId
      ? 'Giao việc lặp lại'
      : KIND_LABEL[w.kind];
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {label}
        {children}
      </span>
    </span>
  );
}

export interface WorkTab {
  key: string;
  label: string;
  count?: number;
  /** Đếm đỏ (quá hạn) / vàng (sắp quá hạn) / xanh (chưa nhận). */
  tone?: 'danger' | 'warn' | 'brand';
}

const COUNT_TONE = {
  danger: 'bg-destructive-weak text-destructive',
  warn: 'bg-warning-weak text-warning',
  brand: 'bg-secondary text-primary',
} as const;

/** Tab dưới PageHeader (cùng markup với các màn danh sách khác: role=tablist, gạch chân primary). */
export function WorkTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: WorkTab[];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div className="flex overflow-x-auto border-b" role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2 pt-2 text-sm',
              active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span
                className={cn(
                  'rounded-chip px-1.5 text-xs font-semibold',
                  t.count > 0 && t.tone ? COUNT_TONE[t.tone] : 'bg-muted text-muted-foreground',
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Thanh tiến độ checklist (6px, nền muted) + "9/15". */
export function ChecklistProgress({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Xong ${done}/${total}`}
      >
        <span
          className={cn('block h-full rounded-full', done === total ? 'bg-success' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </span>
      {done}/{total}
    </span>
  );
}

/** Người (tên) hoặc chữ phụ khi trống. */
export function PersonText({ p, empty = '—' }: { p: { fullName: string } | null; empty?: string }) {
  return p ? (
    <span className="whitespace-nowrap">{p.fullName}</span>
  ) : (
    <span className="text-muted-foreground">{empty}</span>
  );
}

/** Bố cục nội dung chính + cột phụ (≥1280px: 3/4 + 1/4; nhỏ hơn xếp một cột). */
export function MainAside({
  main,
  aside,
  asideLabel,
}: {
  main: ReactNode;
  aside: ReactNode;
  asideLabel: string;
}) {
  return (
    <div className="grid items-start gap-3 xl:grid-cols-4">
      <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">{main}</div>
      <aside className="flex min-w-0 flex-col gap-3" aria-label={asideLabel}>
        {aside}
      </aside>
    </div>
  );
}

/** Thẻ có đầu 44px (tiêu đề trái, hành động phải). */
export function Card({
  title,
  action,
  children,
  className,
  label,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border bg-card', className)} aria-label={label}>
      {title !== undefined ? (
        <div className="flex min-h-card-header flex-wrap items-center justify-between gap-2 border-b px-3.5 text-sm font-semibold">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
