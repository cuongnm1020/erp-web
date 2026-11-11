import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { MarketplaceBadge } from './waybill-error';

/**
 * Kết quả TỪNG đơn sau một thao tác nhiều đơn với hãng (2026-10-28, mockup Vxt1vbkxBB3DKnHKYAdLzX
 * mục 2–3): ba nhóm — có mã vận đơn / chờ (đóng gói, hãng chưa phản hồi) / cần sửa — bấm nhóm để
 * lọc. Dùng cho "Gửi sang ĐVVC" và "Đóng gói + in vận đơn".
 */
export type ResultGroup = 'ok' | 'wait' | 'fix' | 'warn';

export interface OrderResultRow {
  orderId: string;
  docNumber: string;
  customerName?: string | null;
  marketplace?: string | null;
  group: ResultGroup;
  /** Một cụm ngắn: "Có mã S123…", "Chờ đóng gói", "Hãng từ chối"… */
  status: string;
  /** Câu giải thích / việc phải làm (đã qua bảng mã — luật 6). */
  reason?: string | null;
}

const GROUP_LABEL: Record<ResultGroup, string> = {
  ok: 'Có mã vận đơn',
  wait: 'Chờ',
  fix: 'Cần sửa',
  warn: 'Cảnh báo',
};

const TILE_CLASS: Record<ResultGroup, string> = {
  ok: 'text-success',
  wait: 'text-primary',
  fix: 'text-destructive',
  warn: 'text-warning',
};

export function OrderResultsPanel({
  title,
  description,
  rows,
  hints,
  warnAction,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  rows: OrderResultRow[];
  /**
   * Chú thích dưới số của từng nhóm ("in được tem", "cấp mã khi đóng gói"…). `warn` (2026-11-11,
   * cảnh báo in trùng) tùy chọn — có thì hiện ô + tab "Cảnh báo".
   */
  hints: Record<'ok' | 'wait' | 'fix', string> & { warn?: string };
  /** Hành động trên tab Cảnh báo ("In lại các đơn này") — hiện khi đang xem tab đó. */
  warnAction?: ReactNode;
  footer: ReactNode;
}) {
  const count = (g: ResultGroup) => rows.filter((r) => r.group === g).length;
  const [filter, setFilter] = useState<ResultGroup | 'all'>(
    count('fix') > 0 ? 'fix' : count('warn') > 0 ? 'warn' : 'all',
  );
  const shown = filter === 'all' ? rows : rows.filter((r) => r.group === filter);
  const groups: ResultGroup[] = hints.warn ? ['ok', 'wait', 'fix', 'warn'] : ['ok', 'wait', 'fix'];
  const chips: { key: ResultGroup | 'all'; label: string; n: number }[] = [
    { key: 'all', label: 'Tất cả', n: rows.length },
    { key: 'fix', label: GROUP_LABEL.fix, n: count('fix') },
    ...(hints.warn ? [{ key: 'warn' as const, label: GROUP_LABEL.warn, n: count('warn') }] : []),
    { key: 'ok', label: GROUP_LABEL.ok, n: count('ok') },
    { key: 'wait', label: GROUP_LABEL.wait, n: count('wait') },
  ];
  return (
    <section aria-label="Kết quả từng đơn" className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-1 px-5 pt-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <dl
        className={cn(
          'grid grid-cols-1 gap-2 px-5 pt-3',
          hints.warn ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
        {groups.map((g) => (
          <div key={g} className="rounded-md border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{hints[g]}</dt>
            <dd className={cn('text-lg font-semibold tabular-nums', TILE_CLASS[g])}>{count(g)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5 px-5 pt-3" role="group" aria-label="Lọc kết quả">
        {chips.map((c) => (
          <Button
            key={c.key}
            type="button"
            size="sm"
            variant={filter === c.key ? 'default' : 'outline'}
            aria-pressed={filter === c.key}
            disabled={c.n === 0 && c.key !== 'all'}
            onClick={() => setFilter(c.key)}
          >
            {c.label} {c.n}
          </Button>
        ))}
      </div>
      {filter === 'warn' && warnAction ? (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3" data-testid="warn-action">
          {warnAction}
        </div>
      ) : null}
      <ul
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3"
        aria-label={filter === 'fix' ? 'Danh sách đơn lỗi' : 'Danh sách kết quả'}
      >
        {shown.map((r) => (
          <li
            key={r.orderId}
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              r.group === 'fix' && 'border-destructive-line',
              r.group === 'warn' && 'border-warning-line',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/crm/orders/${r.orderId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold tabular-nums text-primary hover:underline"
              >
                {r.docNumber}
              </Link>
              {r.customerName ? (
                <span className="text-muted-foreground">{r.customerName}</span>
              ) : null}
              <MarketplaceBadge marketplace={r.marketplace} />
              <span className={cn('ml-auto text-xs font-semibold', TILE_CLASS[r.group])}>
                {r.status}
              </span>
            </div>
            {r.reason ? (
              <p
                className={cn(
                  'mt-1',
                  r.group === 'fix' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {r.reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {footer}
    </section>
  );
}
