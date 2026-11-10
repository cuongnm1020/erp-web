'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { Copyable } from '@/components/data/copy-button';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type FilterDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor, messageForItemCode } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useListState, type ListState } from '@/lib/url-state';
import {
  useCancelCleanupTasks,
  useCleanupReservations,
  useCleanupTasks,
  useReleaseCleanupReservations,
  type CleanupActionResult,
  type CleanupReservationRow,
  type CleanupTaskRow,
} from '../api/use-wms-cleanup';
import { taskStatusLabel } from '../labels';

/**
 * Dọn việc kho (2026-11-10, user chốt) — CHỈ superadmin (`manage all`; API 403
 * WMS_CLEANUP_SUPERADMIN_ONLY). Ba tab PICK / PACK / Giữ chỗ, chọn nhiều rồi "Xóa" = hủy mềm:
 * việc → Đã hủy, giữ chỗ → Đã nhả (giảm số đang giữ trên kệ). Không xóa vật lý, không chạm sổ
 * tồn; PACK đã xong / đơn đã trừ tồn / giữ chỗ không còn hiệu lực không xóa được.
 */

type Tab = 'PICK' | 'PACK' | 'RESERVATION';
type Filter = 'tab' | 'status' | 'sku' | 'from' | 'to';
const DEFAULTS = { filterKeys: ['tab', 'status', 'sku', 'from', 'to'] as const };

const TABS: { key: Tab; label: string; hint: string }[] = [
  {
    key: 'PICK',
    label: 'Lấy hàng (PICK)',
    hint: 'Xóa việc lấy hàng = hủy việc, dòng chưa xong hủy theo, lượt gộp hết việc thì đóng, thùng đã quét trả về kệ, phiếu xuất nháp của đơn hủy. Không chạm tồn kho. Đơn đã trừ tồn không xóa được.',
  },
  {
    key: 'PACK',
    label: 'Đóng gói (PACK)',
    hint: 'Xóa việc đóng gói = hủy việc, giữ nguyên phiếu giao và mã vận đơn. Việc đã đóng gói xong hoặc đơn đã trừ tồn không xóa được.',
  },
  {
    key: 'RESERVATION',
    label: 'Giữ chỗ',
    hint: 'Xóa giữ chỗ = nhả phần hàng đang giữ trên kệ (số "đã giữ" của lát tồn giảm). Chỉ nhả được giữ chỗ Đang giữ. Đơn còn đang xử lý thì vẫn tính giữ chỗ theo dòng đơn, và đóng gói đơn đó sau có thể báo thiếu giữ chỗ.',
  },
];

const TASK_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'EXCEPTION',
  'COMPLETED',
  'CANCELLED',
] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
const TASK_TONE: Record<TaskStatus, StatusTone> = {
  PENDING: 'draft',
  ASSIGNED: 'brand',
  IN_PROGRESS: 'brand',
  EXCEPTION: 'err',
  COMPLETED: 'ok',
  CANCELLED: 'neutral',
};

const RES_STATUSES = ['ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED'] as const;
type ResStatus = (typeof RES_STATUSES)[number];
const RES_LABEL: Record<ResStatus, string> = {
  ACTIVE: 'Đang giữ',
  FULFILLED: 'Đã trừ tồn',
  RELEASED: 'Đã nhả',
  EXPIRED: 'Hết hạn',
};
const RES_TONE: Record<ResStatus, StatusTone> = {
  ACTIVE: 'brand',
  FULFILLED: 'ok',
  RELEASED: 'neutral',
  EXPIRED: 'draft',
};

const BLOCK_LABEL: Record<NonNullable<CleanupTaskRow['blockedReason']>, string> = {
  CANCELLED: 'Đã hủy',
  PACK_COMPLETED: 'Đã đóng gói xong',
  STOCK_ISSUED: 'Đơn đã trừ tồn',
};

/** Mã lỗi từng dòng → câu (luật 6, không render message thô). */
const FAIL_TEXT: Record<string, string> = {
  WMS_CLEANUP_ALREADY_CANCELLED: 'Việc đã hủy từ trước.',
  WMS_CLEANUP_PACK_COMPLETED: 'Việc đóng gói đã xong — không xóa được.',
  WMS_CLEANUP_STOCK_ISSUED:
    'Đơn đã trừ tồn (hàng đã rời kho) — không xóa được, xử lý bằng phiếu hàng hoàn.',
  WMS_CLEANUP_TASK_TYPE: 'Chỉ xóa được việc lấy hàng / đóng gói.',
  TASK_NOT_FOUND: 'Không còn việc này — tải lại danh sách.',
  RESERVATION_NOT_ACTIVE: 'Giữ chỗ đã nhả hoặc đã trừ tồn từ trước.',
};
const failText = (code: string) => FAIL_TEXT[code] ?? messageForItemCode(code);

const parseTab = (v: string | undefined): Tab => (v === 'PACK' || v === 'RESERVATION' ? v : 'PICK');

export function WmsCleanupScreen() {
  const ability = useAbility();
  const { state, set, skipTake } = useListState<Filter>(DEFAULTS);
  const tab = parseTab(state.filters.tab);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const clear = useCallback(() => setSelected({}), []);
  if (!ability.can('manage', 'WmsCleanup')) return <ForbiddenState />;

  const info = TABS.find((t) => t.key === tab)!;
  const patch = (p: Partial<ListState<Filter>>) => {
    clear();
    set(p);
  };

  return (
    <>
      <PageHeader
        title="Dọn việc kho"
        description="Chỉ quản trị hệ thống · xóa = hủy mềm, giữ lịch sử, không chạm tồn kho"
        breadcrumb={[{ label: 'Kho' }, { label: 'Dọn việc kho' }]}
      />
      <div className="mb-3 flex border-b" role="tablist" aria-label="Loại bản ghi">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => patch({ filters: { tab: t.key === 'PICK' ? undefined : t.key } })}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2 pt-1 text-sm',
              t.key === tab
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-3 rounded-md bg-info-weak px-3 py-2 text-sm text-info">{info.hint}</p>
      {tab === 'RESERVATION' ? (
        <ReservationTab
          state={state}
          skipTake={skipTake}
          patch={patch}
          selected={selected}
          setSelected={setSelected}
          clear={clear}
        />
      ) : (
        <TaskTab
          key={tab}
          type={tab}
          state={state}
          skipTake={skipTake}
          patch={patch}
          selected={selected}
          setSelected={setSelected}
          clear={clear}
        />
      )}
    </>
  );
}

interface TabProps {
  state: ListState<Filter>;
  skipTake: { skip: number; take: number };
  patch: (p: Partial<ListState<Filter>>) => void;
  selected: RowSelectionState;
  setSelected: (s: RowSelectionState) => void;
  clear: () => void;
}

function commonFilters(statusOptions: { value: string; label: string }[]): FilterDef<Filter>[] {
  return [
    { key: 'status', label: 'Trạng thái', type: 'select', options: statusOptions },
    { key: 'sku', label: 'Mã SKU', type: 'text', placeholder: 'SP-0147' },
    { key: 'from', toKey: 'to', label: 'Ngày tạo', type: 'dateRange' },
  ];
}

const hasFilter = (s: ListState<Filter>) =>
  !!(s.q || s.filters.status || s.filters.sku || s.filters.from || s.filters.to);

function Filters({
  state,
  patch,
  statusOptions,
  placeholder,
}: Pick<TabProps, 'state' | 'patch'> & {
  statusOptions: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <FilterBar<Filter>
      q={state.q}
      onQChange={(q) => patch({ q })}
      searchPlaceholder={placeholder}
      values={state.filters}
      onFilterChange={(p) => patch({ filters: { ...state.filters, ...p } })}
      filters={commonFilters(statusOptions)}
    />
  );
}

function NoRows({ state, patch, noun }: Pick<TabProps, 'state' | 'patch'> & { noun: string }) {
  return hasFilter(state) ? (
    <EmptyState
      title={`Không có ${noun} khớp`}
      description="Mã đơn / mã việc / mã SKU phải gõ đúng cả mã."
      action={
        <Button
          variant="outline"
          onClick={() => patch({ q: '', filters: { tab: state.filters.tab } })}
        >
          Xóa lọc
        </Button>
      }
    />
  ) : (
    <EmptyState title={`Chưa có ${noun} nào`} description="Kho đang chọn chưa có bản ghi." />
  );
}

// ── PICK / PACK ─────────────────────────────────────────────

function TaskTab({
  type,
  state,
  skipTake,
  patch,
  selected,
  setSelected,
  clear,
}: TabProps & { type: 'PICK' | 'PACK' }) {
  const status = (TASK_STATUSES as readonly string[]).includes(state.filters.status ?? '')
    ? (state.filters.status as TaskStatus)
    : undefined;
  const query = useCleanupTasks({
    type,
    status,
    q: state.q || undefined,
    skuCode: state.filters.sku || undefined,
    from: state.filters.from,
    to: state.filters.to,
    ...skipTake,
  });
  const cancel = useCancelCleanupTasks();
  const [open, setOpen] = useState(false);
  const columns = useMemo(() => taskColumns(type), [type]);
  const rows = (query.data?.items ?? []).filter((r) => selected[r.id]);
  const ok = rows.filter((r) => r.blockedReason === null);
  const noun = type === 'PICK' ? 'việc lấy hàng' : 'việc đóng gói';

  return (
    <>
      {rows.length > 0 ? (
        <BulkActionBar
          count={rows.length}
          noun="việc"
          onClear={clear}
          className="mb-3 rounded-md border-b-0"
          note={
            rows.length > ok.length
              ? `${rows.length - ok.length} việc không xóa được sẽ bỏ qua`
              : undefined
          }
          danger={
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={ok.length === 0}
              onClick={() => setOpen(true)}
            >
              <Trash2 aria-hidden />
              Xóa {ok.length} việc
            </Button>
          }
        />
      ) : (
        <Filters
          state={state}
          patch={patch}
          placeholder="Mã đơn hoặc mã việc (đúng cả mã)"
          statusOptions={TASK_STATUSES.map((s) => ({ value: s, label: taskStatusLabel(s) }))}
        />
      )}
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={9} />}
        isEmpty={(d) => d.total === 0}
        empty={<NoRows state={state} patch={patch} noun={noun} />}
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
            onSortChange={() => undefined}
            onPageChange={(page) => patch({ page })}
            onSizeChange={(size) => patch({ size })}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>
      <DeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={`Xóa ${ok.length} ${noun}?`}
        description="Việc chuyển sang Đã hủy, dòng chưa xong hủy theo, lịch sử giữ nguyên. Kho không thấy việc này nữa; đơn muốn lấy lại phải Gửi ĐVVC / đóng tay lại."
        confirmLabel={`Xóa ${ok.length} việc`}
        labelOf={(id) => ok.find((r) => r.id === id)?.docNumber ?? id}
        pending={cancel.isPending}
        onSubmit={(reason, done) =>
          cancel.mutate({ ids: ok.map((r) => r.id), reason }, { onSuccess: done, onError })
        }
        onFinished={clear}
        doneText={(n) => `Đã xóa ${n} việc`}
      />
    </>
  );
}

function taskColumns(type: 'PICK' | 'PACK'): ColumnDef<CleanupTaskRow, unknown>[] {
  return [
    {
      id: 'doc',
      header: 'Mã việc',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Copyable value={row.original.docNumber} label="mã việc">
          <span className="font-mono text-xs">{row.original.docNumber}</span>
        </Copyable>
      ),
    },
    {
      id: 'order',
      header: 'Đơn',
      meta: { width: 150 },
      cell: ({ row }) =>
        row.original.orderId ? (
          <Link
            href={`/crm/orders/${row.original.orderId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.orderDocNumber ?? 'Mở đơn'}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: 150 },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={TASK_TONE[row.original.status]}>
            {taskStatusLabel(row.original.status)}
          </StatusBadge>
          {row.original.blockedReason && row.original.blockedReason !== 'CANCELLED' ? (
            <StatusBadge tone="warn">{BLOCK_LABEL[row.original.blockedReason]}</StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'warehouse',
      header: 'Kho',
      meta: { width: 120 },
      cell: ({ row }) => row.original.warehouseName,
    },
    {
      id: 'assignee',
      header: 'Người giữ',
      meta: { width: 140 },
      cell: ({ row }) => (
        <span>
          {row.original.assigneeName ?? <span className="text-muted-foreground">Chưa giao</span>}
          {row.original.inWave ? (
            <span className="block text-xs text-muted-foreground">Trong lượt gộp</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'skus',
      header: 'SKU',
      meta: { width: 180 },
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.skuCodes || '—'}
          <span className="block font-sans text-muted-foreground">
            {row.original.lineCount} dòng
            {row.original.exceptionLineCount > 0
              ? ` · ${row.original.exceptionLineCount} thiếu`
              : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'qty',
      header: 'Đã làm / Cần',
      meta: { width: 110, align: 'right' },
      cell: ({ row }) =>
        `${formatQuantity(row.original.qtyDone)} / ${formatQuantity(row.original.qtyPlanned)}`,
    },
    {
      id: 'created',
      header: 'Tạo lúc',
      meta: { width: 130 },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
          {type === 'PICK' ? (
            <span className="block text-xs">
              {row.original.releasedAt
                ? `Đưa kho ${formatDateTime(row.original.releasedAt)}`
                : 'Chưa đưa kho'}
            </span>
          ) : null}
        </span>
      ),
    },
  ];
}

// ── Giữ chỗ ─────────────────────────────────────────────────

function ReservationTab({ state, skipTake, patch, selected, setSelected, clear }: TabProps) {
  const status = (RES_STATUSES as readonly string[]).includes(state.filters.status ?? '')
    ? (state.filters.status as ResStatus)
    : undefined;
  const query = useCleanupReservations({
    status,
    q: state.q || undefined,
    skuCode: state.filters.sku || undefined,
    from: state.filters.from,
    to: state.filters.to,
    ...skipTake,
  });
  const release = useReleaseCleanupReservations();
  const [open, setOpen] = useState(false);
  const rows = (query.data?.items ?? []).filter((r) => selected[r.id]);
  const ok = rows.filter((r) => r.status === 'ACTIVE');

  return (
    <>
      {rows.length > 0 ? (
        <BulkActionBar
          count={rows.length}
          noun="giữ chỗ"
          onClear={clear}
          className="mb-3 rounded-md border-b-0"
          note={
            rows.length > ok.length
              ? `${rows.length - ok.length} giữ chỗ không còn Đang giữ sẽ bỏ qua`
              : undefined
          }
          danger={
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={ok.length === 0}
              onClick={() => setOpen(true)}
            >
              <Trash2 aria-hidden />
              Xóa {ok.length} giữ chỗ
            </Button>
          }
        />
      ) : (
        <Filters
          state={state}
          patch={patch}
          placeholder="Mã đơn (đúng cả mã)"
          statusOptions={RES_STATUSES.map((s) => ({ value: s, label: RES_LABEL[s] }))}
        />
      )}
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={8} />}
        isEmpty={(d) => d.total === 0}
        empty={<NoRows state={state} patch={patch} noun="giữ chỗ" />}
      >
        {(data) => (
          <DataTable
            columns={RESERVATION_COLUMNS}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={state.page}
            size={state.size}
            sort={null}
            onSortChange={() => undefined}
            onPageChange={(page) => patch({ page })}
            onSizeChange={(size) => patch({ size })}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>
      <DeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={`Xóa ${ok.length} giữ chỗ?`}
        description="Giữ chỗ chuyển sang Đã nhả, số đã giữ trên lát tồn giảm đúng phần đó. Tồn thực không đổi."
        confirmLabel={`Xóa ${ok.length} giữ chỗ`}
        labelOf={(id) => {
          const r = ok.find((x) => x.id === id);
          return r
            ? `${r.skuCode ?? '?'} × ${formatQuantity(r.qty)} @ ${r.locationCode ?? '?'}`
            : id;
        }}
        pending={release.isPending}
        onSubmit={(reason, done) =>
          release.mutate({ ids: ok.map((r) => r.id), reason }, { onSuccess: done, onError })
        }
        onFinished={clear}
        doneText={(n) => `Đã xóa ${n} giữ chỗ`}
      />
    </>
  );
}

const RESERVATION_COLUMNS: ColumnDef<CleanupReservationRow, unknown>[] = [
  {
    id: 'sku',
    header: 'Sản phẩm',
    meta: { width: 220 },
    cell: ({ row }) => (
      <span>
        <span className="font-mono text-xs">{row.original.skuCode ?? '—'}</span>
        <span className="block truncate text-xs text-muted-foreground">{row.original.skuName}</span>
      </span>
    ),
  },
  {
    id: 'qty',
    header: 'SL giữ',
    meta: { width: 90, align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.qty),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    meta: { width: 110 },
    cell: ({ row }) => (
      <StatusBadge tone={RES_TONE[row.original.status]}>
        {RES_LABEL[row.original.status]}
      </StatusBadge>
    ),
  },
  {
    id: 'location',
    header: 'Vị trí',
    meta: { width: 160 },
    cell: ({ row }) => (
      <span>
        <span className="font-mono text-xs">{row.original.locationCode ?? '—'}</span>
        <span className="block text-xs text-muted-foreground">
          {[
            row.original.containerBarcode ? `Thùng ${row.original.containerBarcode}` : null,
            row.original.lotNumber ? `Lô ${row.original.lotNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Hàng rời'}
        </span>
      </span>
    ),
  },
  {
    id: 'warehouse',
    header: 'Kho',
    meta: { width: 120 },
    cell: ({ row }) => row.original.warehouseName ?? '—',
  },
  {
    id: 'ref',
    header: 'Chứng từ',
    meta: { width: 150 },
    cell: ({ row }) =>
      row.original.refType === 'SalesOrder' ? (
        <Link
          href={`/crm/orders/${row.original.refId}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.original.refDocNumber ?? 'Mở đơn'}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">{row.original.refType}</span>
      ),
  },
  {
    id: 'created',
    header: 'Tạo lúc',
    meta: { width: 130 },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
];

// ── Hộp xác nhận xóa ────────────────────────────────────────

const onError = (err: unknown) => toast.error(messageFor(err));

function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  labelOf,
  pending,
  onSubmit,
  onFinished,
  doneText,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  labelOf: (id: string) => string;
  pending: boolean;
  onSubmit: (reason: string, done: (r: CleanupActionResult) => void) => void;
  onFinished: () => void;
  doneText: (n: number) => string;
}) {
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<
    (CleanupActionResult & { labels: Map<string, string> }) | null
  >(null);
  const trimmed = reason.trim();

  const close = (o: boolean) => {
    if (pending) return;
    onOpenChange(o);
    if (!o) {
      setReason('');
      if (result) {
        setResult(null);
        onFinished();
      }
    }
  };

  const submit = () =>
    onSubmit(trimmed, (r) => {
      if (r.done.length > 0) toast.success(doneText(r.done.length));
      if (r.failed.length === 0) {
        setReason('');
        onOpenChange(false);
        onFinished();
        return;
      }
      setResult({ ...r, labels: new Map(r.failed.map((f) => [f.id, labelOf(f.id)])) });
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {result.failed.length} bản ghi không xóa được
                {result.done.length > 0 ? ` · đã xóa ${result.done.length}` : ''}
              </DialogTitle>
              <DialogDescription>Các bản ghi dưới đây giữ nguyên.</DialogDescription>
            </DialogHeader>
            <ul className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border px-3 py-2 text-sm">
              {result.failed.map((f) => (
                <li key={f.id}>
                  <span className="font-mono text-xs font-semibold">{result.labels.get(f.id)}</span>
                  <span className="block text-muted-foreground">{failText(f.code)}</span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="cleanup-reason">Lý do (bắt buộc)</Label>
              <Textarea
                id="cleanup-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Vd: việc treo của đơn đã hủy trên Pancake"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => close(false)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                loading={pending}
                disabled={trimmed === ''}
                onClick={submit}
              >
                <Trash2 aria-hidden />
                {confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
