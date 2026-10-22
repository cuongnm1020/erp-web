'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useCustomerWork, type CustomerWorkItem } from '../api/use-customer-work';

const OPEN = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'SUBMITTED', 'RESOLVED'];

function statusOf(w: CustomerWorkItem): { label: string; tone: StatusTone } {
  switch (w.status) {
    case 'OPEN':
      return { label: w.kind === 'TASK' ? 'Chưa bắt đầu' : 'Mới', tone: 'draft' };
    case 'IN_PROGRESS':
      return { label: w.kind === 'TASK' ? 'Đang làm' : 'Đang xử lý', tone: 'brand' };
    case 'WAITING_CUSTOMER':
      return { label: 'Chờ khách', tone: 'warn' };
    case 'SUBMITTED':
      return { label: 'Chờ duyệt', tone: 'warn' };
    case 'RESOLVED':
      return { label: 'Đã xử lý', tone: 'ok' };
    case 'DONE':
      return { label: 'Xong', tone: 'neutral' };
    case 'CLOSED':
      return { label: 'Đã đóng', tone: 'neutral' };
    default:
      return { label: 'Đã hủy', tone: 'neutral' };
  }
}

/** Thẻ "Yêu cầu hỗ trợ" ở hồ sơ khách (E2 — docs/screens/FE-WORK-1-work-module.md §9). */
export function CustomerWorkCard({ customerId }: { customerId: string }) {
  const q = useCustomerWork(customerId);
  const items = q.data?.items ?? [];
  const open = items.filter((w) => OPEN.includes(w.status)).length;
  return (
    <section className="rounded-lg border bg-card" aria-label="Yêu cầu hỗ trợ">
      <div className="flex min-h-card-header flex-wrap items-center justify-between gap-2 border-b px-3.5">
        <h2 className="text-sm font-semibold">
          Yêu cầu hỗ trợ{q.data ? ` · ${open} đang mở / ${q.data.total}` : ''}
        </h2>
        <Can I="create_customer" a="Work">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/work/new?kind=CUSTOMER&customerId=${customerId}`}>
              <Plus aria-hidden /> Tạo yêu cầu
            </Link>
          </Button>
        </Can>
      </div>
      {q.isPending ? (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : q.error ? (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">
          Không tải được yêu cầu của khách.
        </p>
      ) : items.length ? (
        <ul>
          {items.map((w) => {
            const s = statusOf(w);
            return (
              <li
                key={w.id}
                className="flex flex-wrap items-center gap-2 border-t px-3.5 py-2 text-sm first:border-t-0"
              >
                <Link
                  href={`/work/${w.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {w.docNumber}
                </Link>
                <span className="min-w-0 flex-1 truncate">
                  {w.title}
                  {w.categoryName ? (
                    <span className="text-muted-foreground"> · {w.categoryName}</span>
                  ) : null}
                </span>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                <span className="w-32 text-right text-xs text-muted-foreground">
                  {formatDateTime(w.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3.5 py-3 text-sm text-muted-foreground">
          Khách chưa có yêu cầu hỗ trợ nào.
        </p>
      )}
    </section>
  );
}
