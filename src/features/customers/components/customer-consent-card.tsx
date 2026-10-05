'use client';

import { MailCheck, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { Can } from '@/lib/permission';
import {
  useCustomerConsents,
  type ConsentChannel,
  type ConsentCurrent,
  type ConsentRecord,
} from '../api/use-consents';
import {
  consentChannelLabel,
  consentPurposeLabel,
  consentSourceLabel,
  consentStateLabel,
  consentStateTone,
  formatConsentEvidence,
} from '../consent-labels';
import { ConsentRecordDialog } from './consent-record-dialog';

/**
 * CRM-13 — "Đồng ý nhận tin" trên hồ sơ 360: trạng thái hiện tại 4 kênh (mục đích MARKETING) +
 * lịch sử mọi bản ghi (mới nhất trước) — GET /customers/{id}/consents. Ghi bản mới qua dialog
 * (customer.update). Trang lịch sử nằm trên URL `?consentPage=` (luật 8), không đụng tham số khác.
 */
const HISTORY_SIZES = [20, 50, 100, 200];
const DEFAULT_SIZE = 20;

function parsePositive(v: string | null, def: number): number {
  const n = v === null ? Number.NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : def;
}

function useHistoryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.toString();
  const state = useMemo(() => {
    const p = new URLSearchParams(key);
    const size = parsePositive(p.get('consentSize'), DEFAULT_SIZE);
    return {
      page: parsePositive(p.get('consentPage'), 1),
      size: HISTORY_SIZES.includes(size) ? size : DEFAULT_SIZE,
    };
  }, [key]);
  const set = useCallback(
    (patch: { page?: number; size?: number }) => {
      const next = { ...state, ...patch };
      if (patch.size !== undefined && patch.page === undefined) next.page = 1;
      const merged = new URLSearchParams(key);
      merged.delete('consentPage');
      merged.delete('consentSize');
      if (next.page > 1) merged.set('consentPage', String(next.page));
      if (next.size !== DEFAULT_SIZE) merged.set('consentSize', String(next.size));
      const qs = merged.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, key, pathname, router],
  );
  return { state, set };
}

const historyColumns: ColumnDef<ConsentRecord, unknown>[] = [
  {
    id: 'recordedAt',
    header: 'Thời điểm',
    meta: { width: 140 },
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDateTime(row.original.recordedAt)}</span>
    ),
  },
  {
    id: 'channel',
    header: 'Kênh',
    meta: { width: 90 },
    cell: ({ row }) => consentChannelLabel(row.original.channel),
  },
  {
    id: 'granted',
    header: 'Trạng thái',
    meta: { width: 100 },
    cell: ({ row }) => (
      <StatusBadge tone={consentStateTone(row.original.granted)}>
        {consentStateLabel(row.original.granted)}
      </StatusBadge>
    ),
  },
  {
    id: 'source',
    header: 'Nguồn',
    meta: { width: 140 },
    cell: ({ row }) => consentSourceLabel(row.original.source),
  },
  {
    id: 'purpose',
    header: 'Mục đích',
    meta: { width: 110 },
    cell: ({ row }) => consentPurposeLabel(row.original.purpose),
  },
  {
    id: 'recordedBy',
    header: 'Người ghi',
    meta: { width: 150 },
    cell: ({ row }) =>
      row.original.recordedBy ? (
        row.original.recordedBy.name
      ) : (
        <span className="text-muted-foreground">Khách tự thao tác / hệ thống</span>
      ),
  },
  {
    id: 'evidence',
    header: 'Bằng chứng',
    cell: ({ row }) => {
      const text = formatConsentEvidence(row.original.evidence);
      return text ? (
        <span className="line-clamp-2 break-all text-xs" title={text}>
          {text}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
];

function CurrentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải đồng ý nhận tin"
      className="grid grid-cols-2 gap-2 px-3 py-3 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

function CurrentGrid({
  current,
  onRecord,
}: {
  current: ConsentCurrent[];
  onRecord: (c: ConsentChannel) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 px-3 py-3 lg:grid-cols-4">
      {current.map((c) => (
        <li
          key={c.channel}
          className="flex flex-col gap-1 rounded-md border px-3 py-2"
          aria-label={`Kênh ${consentChannelLabel(c.channel)}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{consentChannelLabel(c.channel)}</span>
            <StatusBadge tone={consentStateTone(c.granted)}>
              {consentStateLabel(c.granted)}
            </StatusBadge>
          </div>
          <span className="text-xs text-muted-foreground">
            {c.recordedAt
              ? `${consentSourceLabel(c.source)} · ${formatDateTime(c.recordedAt)}`
              : 'Chưa hỏi khách — không gửi marketing'}
          </span>
          <Can I="update" a="Customer">
            <button
              type="button"
              onClick={() => onRecord(c.channel)}
              className="self-start text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Ghi nhận kênh ${consentChannelLabel(c.channel)}`}
            >
              Ghi nhận
            </button>
          </Can>
        </li>
      ))}
    </ul>
  );
}

export function CustomerConsentCard({ customerId }: { customerId: string }) {
  const { state, set } = useHistoryPage();
  const query = useCustomerConsents(customerId, {
    take: state.size,
    skip: (state.page - 1) * state.size,
  });
  const [dialog, setDialog] = useState<{ open: boolean; channel?: ConsentChannel }>({
    open: false,
  });
  const openDialog = (channel?: ConsentChannel) => setDialog({ open: true, channel });

  return (
    <section aria-labelledby="consent-card" className="rounded-md border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id="consent-card" className="flex items-center gap-1.5 text-sm font-semibold">
          <MailCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Đồng ý nhận tin
        </h2>
        <Can I="update" a="Customer">
          <Button size="sm" variant="outline" onClick={() => openDialog()}>
            <Plus aria-hidden />
            Ghi nhận thay đổi
          </Button>
        </Can>
      </header>

      <QueryState
        query={query}
        skeleton={
          <>
            <CurrentSkeleton />
            <div className="px-3 pb-3">
              <ListSkeleton rows={3} columns={7} />
            </div>
          </>
        }
      >
        {(d) => (
          <>
            <CurrentGrid current={d.current} onRecord={openDialog} />
            <div className="border-t px-3 py-2">
              <h3 className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lịch sử ghi nhận ({d.history.total})
              </h3>
              {d.history.total === 0 ? (
                <EmptyState
                  icon={MailCheck}
                  title="Chưa có bản ghi đồng ý nào"
                  description="Khách chưa được hỏi — mọi kênh coi như không nhận tin marketing."
                  action={
                    <Can I="update" a="Customer">
                      <Button onClick={() => openDialog()}>
                        <Plus aria-hidden />
                        Ghi nhận thay đổi
                      </Button>
                    </Can>
                  }
                />
              ) : (
                <DataTable
                  columns={historyColumns}
                  rows={d.history.items}
                  getRowId={(r) => r.id}
                  total={d.history.total}
                  page={state.page}
                  size={state.size}
                  sort={null}
                  onPageChange={(page) => set({ page })}
                  onSizeChange={(size) => set({ size })}
                  onSortChange={() => undefined}
                />
              )}
            </div>
          </>
        )}
      </QueryState>

      <ConsentRecordDialog
        customerId={customerId}
        open={dialog.open}
        initialChannel={dialog.channel}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
      />
    </section>
  );
}
