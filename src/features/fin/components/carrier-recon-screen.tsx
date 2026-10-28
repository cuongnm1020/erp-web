'use client';

import { FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Copyable } from '@/components/data/copy-button';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import {
  useReconciliationLines,
  useReconciliations,
  type CarrierReconLine,
  type CarrierReconOutcome,
} from '../api/use-einvoices';
import { CARRIER_NAME, RECON_OUTCOME, RECON_OUTCOMES } from '../einvoice-labels';

/**
 * Từng dòng của một lần nhập file đối soát hãng: khớp đơn nào, hãng thu bao nhiêu so với thu hộ của
 * đơn, kết quả (khớp / thu thiếu / thu 0 ₫ / chưa giao / không thấy đơn). URL: ?outcome= · ?page=
 */
const FILTER_KEYS = ['outcome'] as const;
type F = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const ALL = '__all__';

export function CarrierReconScreen({ id }: { id: string }) {
  const { state, set, skipTake } = useListState<F>(DEFAULTS);
  const outcome = state.filters.outcome as CarrierReconOutcome | undefined;
  const batches = useReconciliations();
  const batch = batches.data?.items.find((b) => b.id === id);
  const query = useReconciliationLines(id, { ...(outcome ? { outcome } : {}), ...skipTake });
  const columns = useMemo(() => buildColumns(), []);

  return (
    <>
      <PageHeader
        title={batch ? batch.fileName : 'File đối soát hãng'}
        breadcrumb={[
          { label: 'Tài chính', href: '/fin/invoices' },
          { label: 'Hóa đơn điện tử', href: '/fin/einvoices' },
          { label: 'Đối soát hãng' },
        ]}
        description={
          batch
            ? `${batch.rowCount} dòng · nhập lúc ${formatDateTime(batch.createdAt)}`
            : 'Đang tải…'
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/fin/einvoices">Về hàng chờ hóa đơn</Link>
          </Button>
        }
      />
      <section className="rounded-lg border bg-card" aria-label="Dòng đối soát">
        <div className="px-3 pt-3">
          <Select
            value={outcome ?? ALL}
            onValueChange={(v) => set({ page: 1, filters: { outcome: v === ALL ? undefined : v } })}
          >
            <SelectTrigger className="w-72" aria-label="Kết quả">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi kết quả ({batch?.rowCount ?? '…'})</SelectItem>
              {RECON_OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {RECON_OUTCOME[o].label} ({batch?.summary[o] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-3 pb-3 pt-2">
          <QueryState
            query={query}
            skeleton={<ListSkeleton rows={12} columns={8} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                icon={FileSpreadsheet}
                title={outcome ? 'Không có dòng khớp' : 'File không có dòng nào'}
                description={outcome ? 'Chọn kết quả khác.' : 'Nhập lại file đối soát của hãng.'}
                action={
                  outcome ? (
                    <Button variant="outline" onClick={() => set({ filters: {} })}>
                      Xóa lọc
                    </Button>
                  ) : null
                }
              />
            }
          >
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                getRowId={(r) => r.id}
                total={data.total}
                page={state.page}
                size={state.size}
                sort={null}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={() => undefined}
              />
            )}
          </QueryState>
        </div>
      </section>
    </>
  );
}

function buildColumns(): ColumnDef<CarrierReconLine, unknown>[] {
  return [
    {
      id: 'row',
      header: 'Sheet · dòng',
      meta: { width: 120 },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.sheetName} · {row.original.rowNo}
        </span>
      ),
    },
    {
      id: 'tracking',
      header: 'Mã vận đơn',
      meta: { width: 230 },
      cell: ({ row }) => (
        <div className="leading-tight">
          <Copyable value={row.original.trackingNo} label="Chép mã vận đơn">
            <span className="font-mono text-xs">{row.original.trackingNo}</span>
          </Copyable>
          <div className="text-xs text-muted-foreground">
            {CARRIER_NAME[row.original.carrierCode] ?? row.original.carrierCode}
            {row.original.statusText ? ` · ${row.original.statusText}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'order',
      header: 'Đơn',
      meta: { width: 140 },
      cell: ({ row }) =>
        row.original.orderId ? (
          <Link
            href={`/crm/orders/${row.original.orderId}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.orderDocNumber}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'items',
      header: 'Hàng (theo hãng)',
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.itemsText ?? undefined}>
          {row.original.itemsText ?? '—'}
        </span>
      ),
    },
    {
      id: 'collected',
      header: 'Hãng thu',
      meta: { width: 110, align: 'right' },
      cell: ({ row }) => formatMoney(row.original.collectedAmount, { unit: '' }),
    },
    {
      id: 'expected',
      header: 'Thu hộ của đơn',
      meta: { width: 120, align: 'right' },
      cell: ({ row }) =>
        row.original.expectedAmount === null
          ? '—'
          : formatMoney(row.original.expectedAmount, { unit: '' }),
    },
    {
      id: 'outcome',
      header: 'Kết quả',
      meta: { width: 200 },
      cell: ({ row }) => (
        <div className="leading-tight">
          <StatusBadge tone={RECON_OUTCOME[row.original.outcome].tone}>
            {RECON_OUTCOME[row.original.outcome].label}
          </StatusBadge>
          {row.original.reason ? (
            <div className="text-xs text-muted-foreground">{row.original.reason}</div>
          ) : null}
        </div>
      ),
    },
  ];
}
