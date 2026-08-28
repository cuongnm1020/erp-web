'use client';

import { useMemo, useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import {
  useShipmentStatusLog,
  useStuckShipments,
  type CarrierStatusLog,
  type StuckShipment,
} from '../api/use-shipping';

const SHIPMENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Chờ lấy', tone: 'neutral' },
  PICKED_UP: { label: 'Đã lấy hàng', tone: 'brand' },
  IN_TRANSIT: { label: 'Đang giao', tone: 'brand' },
  DELIVERED: { label: 'Đã giao', tone: 'ok' },
  FAILED: { label: 'Giao lỗi', tone: 'err' },
  RETURNED: { label: 'Đã hoàn', tone: 'warn' },
};

const OUTCOME: Record<CarrierStatusLog['outcome'], { label: string; tone: StatusTone }> = {
  APPLIED: { label: 'Đã áp', tone: 'ok' },
  DUPLICATE: { label: 'Trùng', tone: 'neutral' },
  REJECTED_UNMAPPED: { label: 'Mã lạ', tone: 'warn' },
  REJECTED_TRANSITION: { label: 'Lệch pha', tone: 'warn' },
  NOT_FOUND: { label: 'Không khớp đơn', tone: 'err' },
};

const SOURCE: Record<CarrierStatusLog['source'], string> = {
  WEBHOOK: 'Webhook',
  POLL: 'Đối soát',
};

const statusBadge = (s: string) => {
  const m = SHIPMENT_STATUS[s] ?? { label: s, tone: 'neutral' as StatusTone };
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
};

/** Timeline tín hiệu hãng (webhook + poll) của một phiếu giao — quyết định #6. */
function StatusLogDialog({
  shipment,
  onClose,
}: {
  shipment: StuckShipment | null;
  onClose: () => void;
}) {
  const query = useShipmentStatusLog(shipment?.id ?? '');
  return (
    <Dialog open={shipment !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hành trình {shipment?.docNumber}</DialogTitle>
          <DialogDescription>
            {shipment?.carrierName ?? '—'} ·{' '}
            <span className="font-mono">{shipment?.trackingNo}</span>
          </DialogDescription>
        </DialogHeader>
        <QueryState
          query={query}
          skeleton={<Skeleton className="h-40 w-full" />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <p className="py-4 text-sm text-muted-foreground">
              Chưa nhận tín hiệu nào từ hãng cho phiếu này.
            </p>
          }
        >
          {(data) => (
            <ol className="max-h-96 space-y-2 overflow-y-auto">
              {data.items.map((e) => {
                const o = OUTCOME[e.outcome];
                return (
                  <li key={e.id} className="rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </span>
                      <StatusBadge tone="neutral">{SOURCE[e.source]}</StatusBadge>
                      <span className="font-mono text-xs">{e.carrierStatusCode}</span>
                      {e.mappedStatus ? <>→ {statusBadge(e.mappedStatus)}</> : null}
                      <StatusBadge tone={o.tone}>{o.label}</StatusBadge>
                    </div>
                    {e.note ? <p className="mt-1 text-xs text-muted-foreground">{e.note}</p> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </QueryState>
      </DialogContent>
    </Dialog>
  );
}

const columns: ColumnDef<StuckShipment, unknown>[] = [
  {
    id: 'docNumber',
    accessorKey: 'docNumber',
    header: 'Phiếu giao',
    meta: { width: 140 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  {
    id: 'carrierName',
    accessorKey: 'carrierName',
    header: 'Hãng',
    meta: { width: 150 },
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  {
    id: 'trackingNo',
    accessorKey: 'trackingNo',
    header: 'Mã vận đơn',
    meta: { width: 160 },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{(getValue() as string | null) ?? '—'}</span>
    ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { width: 120 },
    cell: ({ getValue }) => statusBadge(getValue() as string),
  },
  {
    id: 'carrierStatusCode',
    accessorKey: 'carrierStatusCode',
    header: 'Mã hãng gần nhất',
    meta: { width: 130 },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{(getValue() as string | null) ?? '—'}</span>
    ),
  },
  {
    id: 'daysSinceShipped',
    accessorKey: 'daysSinceShipped',
    header: 'Treo (ngày)',
    meta: { align: 'right', width: 100 },
    cell: ({ getValue }) => (
      <span className="font-semibold text-destructive">{getValue() as number}</span>
    ),
  },
  {
    id: 'shippedAt',
    accessorKey: 'shippedAt',
    header: 'Rời kho',
    meta: { width: 140 },
    cell: ({ getValue }) => formatDateTime(getValue() as string | null),
  },
  {
    id: 'lastCarrierSyncAt',
    accessorKey: 'lastCarrierSyncAt',
    header: 'Đối soát gần nhất',
    meta: { width: 140 },
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? formatDateTime(v) : <span className="text-muted-foreground">Chưa</span>;
    },
  },
];

const FILTER_KEYS = ['days'] as const;
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const DAY_OPTIONS = ['3', '5', '7', '14'] as const;

/**
 * Theo dõi giao hàng (BE-carrier-sync #3): đơn rời kho quá N ngày (mặc định 5)
 * mà hãng chưa báo giao xong / hoàn. Nhấn dòng để xem timeline tín hiệu hãng.
 */
export function ShippingMonitorScreen() {
  const { state, set, skipTake } = useListState<(typeof FILTER_KEYS)[number]>(DEFAULTS);
  const days = Number(state.filters.days ?? '5');
  const [selected, setSelected] = useState<StuckShipment | null>(null);

  const params = useMemo(() => ({ days, ...skipTake }), [days, skipTake]);
  const query = useStuckShipments(params);

  return (
    <>
      <PageHeader
        title="Theo dõi giao hàng"
        description={
          query.data ? `${query.data.total} đơn treo quá ${days} ngày chưa có kết cục` : 'Đang đếm…'
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Theo dõi giao hàng' }]}
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Treo quá
            <Select
              value={String(days)}
              onValueChange={(v) => set({ filters: { ...state.filters, days: v } })}
            >
              <SelectTrigger className="h-8 w-24" aria-label="Số ngày treo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} ngày
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        }
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={`Không có đơn nào treo quá ${days} ngày`}
            description="Mọi phiếu giao rời kho đều đã có kết cục hoặc chưa vượt ngưỡng theo dõi."
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
            onRowClick={(row) => setSelected(row)}
          />
        )}
      </QueryState>

      <StatusLogDialog shipment={selected} onClose={() => setSelected(null)} />
    </>
  );
}
