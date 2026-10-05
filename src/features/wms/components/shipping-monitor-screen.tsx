'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ErrorState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import {
  useCarriers,
  useShipmentMonitorList,
  useShipmentMonitorSummary,
  useShipmentStatusLog,
  type ShipmentMonitorRow,
  type ShipmentMonitorSummary,
  type ShipmentMonitorView,
} from '../api/use-shipping';
import { carrierOutcome, carrierSource, shipmentStatusBadge } from '../labels';

const statusBadge = (s: string) => {
  const m = shipmentStatusBadge(s);
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
};

/** Timeline tín hiệu hãng (webhook + poll) của một phiếu giao — quyết định #6. */
function StatusLogDialog({
  shipment,
  onClose,
}: {
  shipment: ShipmentMonitorRow | null;
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
                const o = carrierOutcome(e.outcome);
                return (
                  <li key={e.id} className="rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </span>
                      <StatusBadge tone="neutral">{carrierSource(e.source)}</StatusBadge>
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

const mono = (v: string | null) => <span className="font-mono text-xs">{v ?? '—'}</span>;

const columns: ColumnDef<ShipmentMonitorRow, unknown>[] = [
  {
    id: 'docNumber',
    accessorKey: 'docNumber',
    header: 'Phiếu giao',
    meta: { width: 130 },
    cell: ({ getValue }) => mono(getValue() as string),
  },
  {
    id: 'orderDocNumber',
    accessorKey: 'orderDocNumber',
    header: 'Đơn bán',
    meta: { width: 130 },
    cell: ({ getValue }) => mono(getValue() as string | null),
  },
  {
    id: 'carrierName',
    accessorKey: 'carrierName',
    header: 'Hãng',
    meta: { width: 140 },
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  {
    id: 'trackingNo',
    accessorKey: 'trackingNo',
    header: 'Mã vận đơn',
    meta: { width: 180 },
    cell: ({ getValue }) => mono(getValue() as string | null),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { width: 120 },
    cell: ({ getValue }) => statusBadge(getValue() as string),
  },
  {
    id: 'holdDays',
    accessorKey: 'holdDays',
    header: 'Hãng giữ (ngày)',
    meta: { align: 'right', width: 120 },
    cell: ({ row }) => {
      const d = row.original.holdDays;
      if (d === null) return <span className="text-muted-foreground">—</span>;
      return row.original.overdue ? (
        <span className="inline-flex items-center gap-1 font-semibold text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" aria-label="Quá hạn" />
          {d}
        </span>
      ) : (
        <span className="tabular-nums">{d}</span>
      );
    },
  },
  {
    id: 'packedAt',
    accessorKey: 'packedAt',
    header: 'Đóng gói',
    meta: { width: 140 },
    cell: ({ getValue }) => formatDateTime(getValue() as string | null),
  },
  {
    id: 'shippedAt',
    accessorKey: 'shippedAt',
    header: 'Bàn giao hãng',
    meta: { width: 140 },
    cell: ({ getValue }) => formatDateTime(getValue() as string | null),
  },
  {
    id: 'carrierStatusCode',
    accessorKey: 'carrierStatusCode',
    header: 'Mã hãng gần nhất',
    meta: { width: 120 },
    cell: ({ getValue }) => mono(getValue() as string | null),
  },
];

const FILTER_KEYS = ['date', 'carrierId', 'days', 'view'] as const;
type Filter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const DAY_OPTIONS = ['3', '5', '7', '14'] as const;
const DEFAULT_DAYS = 5;
const ALL = '__all__';
const VIEWS: readonly ShipmentMonitorView[] = ['PACKED', 'HANDED_OVER', 'HOLDING', 'OVERDUE'];
const DEFAULT_VIEW: ShipmentMonitorView = 'OVERDUE';

/** Cộng ngày trên khoá YYYY-MM-DD (thuần lịch, không phụ thuộc múi giờ máy). */
function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

function emptyText(view: ShipmentMonitorView, day: string, holdDays: number) {
  switch (view) {
    case 'PACKED':
      return { title: `Chưa có đơn nào đóng gói ngày ${day}`, description: 'Thử chọn ngày khác.' };
    case 'HANDED_OVER':
      return {
        title: `Chưa có đơn nào bàn giao cho hãng ngày ${day}`,
        description: 'Thử chọn ngày khác.',
      };
    case 'HOLDING':
      return {
        title: 'Hãng không giữ đơn nào',
        description: 'Mọi đơn đã rời kho đều đã giao xong hoặc đã hoàn.',
      };
    case 'OVERDUE':
      return {
        title: `Không có đơn nào hãng giữ quá ${holdDays} ngày`,
        description: 'Mọi đơn đang ở hãng đều chưa vượt ngưỡng cảnh báo.',
      };
  }
}

/** Ô chỉ số bấm được — chọn góc nhìn cho bảng bên dưới. */
function ViewCard({
  active,
  onSelect,
  tone,
  ...card
}: {
  active: boolean;
  onSelect: () => void;
  tone?: 'danger';
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <KpiCard
        {...card}
        className={cn(
          'h-full transition-colors hover:bg-muted/50',
          active && 'border-primary ring-1 ring-primary',
          tone === 'danger' &&
            card.value > 0 &&
            'border-destructive/60 bg-destructive/5 text-destructive',
        )}
      />
    </button>
  );
}

function CarrierBreakdown({
  data,
  onPick,
}: {
  data: ShipmentMonitorSummary;
  onPick: (carrierId: string | null) => void;
}) {
  if (data.byCarrier.length < 2) return null;
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hãng</TableHead>
            <TableHead className="text-right">Đã đóng gói</TableHead>
            <TableHead className="text-right">Đã bàn giao</TableHead>
            <TableHead className="text-right">Hãng đang giữ</TableHead>
            <TableHead className="text-right">Giữ quá {data.holdDays} ngày</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.byCarrier.map((c) => (
            <TableRow
              key={c.carrierId ?? 'none'}
              className="cursor-pointer"
              onClick={() => onPick(c.carrierId)}
            >
              <TableCell>{c.carrierName ?? 'Chưa gán hãng'}</TableCell>
              <TableCell className="text-right tabular-nums">{c.packed}</TableCell>
              <TableCell className="text-right tabular-nums">{c.handedOver}</TableCell>
              <TableCell className="text-right tabular-nums">{c.holding}</TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  c.holdingOverdue > 0 && 'font-semibold text-destructive',
                )}
              >
                {c.holdingOverdue}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Theo dõi giao hàng (2026-10-05): trong một ngày (giờ VN) kho đã đóng gói bao nhiêu đơn, đã bàn
 * giao hãng bao nhiêu; hiện hãng đang giữ bao nhiêu và CẢNH BÁO đơn hãng giữ quá N ngày (mặc định
 * 5) kể từ lúc rời kho mà chưa giao xong / hoàn. Bấm ô chỉ số để xem danh sách; tìm theo mã phiếu,
 * mã vận đơn hoặc số đơn bán; bấm dòng xem timeline tín hiệu hãng. Mọi lọc nằm trên URL (luật 8).
 */
export function ShippingMonitorScreen() {
  const { state, set, skipTake } = useListState<Filter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const date = state.filters.date ?? today;
  const carrierId = state.filters.carrierId;
  const holdDays = Number(state.filters.days ?? DEFAULT_DAYS);
  const view: ShipmentMonitorView = VIEWS.includes(state.filters.view as ShipmentMonitorView)
    ? (state.filters.view as ShipmentMonitorView)
    : DEFAULT_VIEW;
  const [selected, setSelected] = useState<ShipmentMonitorRow | null>(null);

  const filter = useMemo(() => ({ date, carrierId, holdDays }), [date, carrierId, holdDays]);
  const listParams = useMemo(
    () => ({ ...filter, view, q: state.q, ...skipTake }),
    [filter, view, state.q, skipTake],
  );
  const summary = useShipmentMonitorSummary(filter);
  const list = useShipmentMonitorList(listParams);
  const carriers = useCarriers();

  const setFilters = (patch: Partial<Record<Filter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });
  const setDate = (v: string) => setFilters({ date: v && v !== today ? v : undefined });

  const dayLabel = formatDate(date);
  const t = summary.data?.totals;
  const empty = emptyText(view, dayLabel, holdDays);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Theo dõi giao hàng"
        description={`Đóng gói & bàn giao ngày ${dayLabel} · hãng đang giữ tính tới hiện tại`}
        breadcrumb={[{ label: 'Kho' }, { label: 'Theo dõi giao hàng' }]}
      />

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card px-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Chọn nhanh ngày">
          {[
            { label: 'Hôm nay', value: today },
            { label: 'Hôm qua', value: shiftDay(today, -1) },
          ].map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={p.value === date ? 'default' : 'outline'}
              onClick={() => setDate(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Ngày
          <Input
            type="date"
            className="h-8 w-40"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Ngày"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Hãng vận chuyển
          <Select
            value={carrierId ?? ALL}
            onValueChange={(v) => setFilters({ carrierId: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-48" aria-label="Hãng vận chuyển">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi hãng</SelectItem>
              {(carriers.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Cảnh báo khi hãng giữ quá
          <Select
            value={String(holdDays)}
            onValueChange={(v) => setFilters({ days: v === String(DEFAULT_DAYS) ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-28" aria-label="Số ngày cảnh báo">
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
      </div>

      {summary.error && !summary.data ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : !t || !summary.data ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {VIEWS.map((v) => (
            <Skeleton key={v} className="h-[74px] w-full" />
          ))}
        </div>
      ) : (
        <>
          {t.holdingOverdue > 0 ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">
                <strong>{t.holdingOverdue} đơn</strong> hãng đang giữ quá {holdDays} ngày kể từ lúc
                bàn giao mà chưa giao xong — cần liên hệ hãng xử lý.
              </span>
              {view !== 'OVERDUE' || state.q ? (
                <Button
                  size="sm"
                  variant="destructive"
                  // Xem TOÀN BỘ đơn quá hạn: bỏ luôn từ khoá đang tìm.
                  onClick={() => set({ q: '', filters: { ...state.filters, view: undefined } })}
                >
                  Xem danh sách
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <ViewCard
              label="Đã đóng gói"
              value={t.packed}
              detail={`trong ngày ${dayLabel}`}
              active={view === 'PACKED'}
              onSelect={() => setFilters({ view: 'PACKED' })}
            />
            <ViewCard
              label="Đã bàn giao hãng"
              value={t.handedOver}
              detail={`trong ngày ${dayLabel}`}
              active={view === 'HANDED_OVER'}
              onSelect={() => setFilters({ view: 'HANDED_OVER' })}
            />
            <ViewCard
              label="Hãng đang giữ"
              value={t.holding}
              detail="chưa giao xong / chưa hoàn"
              active={view === 'HOLDING'}
              onSelect={() => setFilters({ view: 'HOLDING' })}
            />
            <ViewCard
              label={`Giữ quá ${holdDays} ngày`}
              value={t.holdingOverdue}
              detail="cần liên hệ hãng"
              tone="danger"
              active={view === 'OVERDUE'}
              onSelect={() => setFilters({ view: undefined })}
            />
          </div>

          <CarrierBreakdown
            data={summary.data}
            onPick={(id) => setFilters({ carrierId: id ?? undefined })}
          />
        </>
      )}

      <div>
        <FilterBar<Filter>
          q={state.q}
          onQChange={(q) => set({ q })}
          values={{}}
          onFilterChange={() => undefined}
          searchPlaceholder="Mã phiếu, mã vận đơn, số đơn…"
        />
        <QueryState
          query={list}
          skeleton={<ListSkeleton rows={10} columns={9} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            state.q ? (
              <EmptyState
                title={`Không tìm thấy "${state.q}"`}
                description="Thử mã phiếu giao, mã vận đơn hoặc đúng số đơn bán; hoặc chọn góc nhìn khác."
              />
            ) : (
              <EmptyState title={empty.title} description={empty.description} />
            )
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
      </div>

      <StatusLogDialog shipment={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
