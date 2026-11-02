'use client';

import Link from 'next/link';
import { Eye, Pencil, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { CopyText } from '@/components/data/copy-text';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type FilterDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor, messageForCode, messageForItemCode } from '@/lib/error-messages';
import { formatDate, formatDateTime } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import { useCarriers } from '@/features/wms/api/use-shipping';
import {
  useOrderIssueCounts,
  useOrders,
  useSetOrdersWaitingStock,
  type OrderIssue,
  type OrderIssueCounts,
  type SalesOrderListItem,
} from '../api/use-orders';
import { fulfilmentLabel, orderFlowLabel } from '../labels';
import { BulkFulfilPrintDialog } from './bulk-fulfil-print-dialog';
import { BulkReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { BulkRetryWaybillDialog } from './bulk-retry-waybill-dialog';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { CancelWaybillDialog } from './cancel-waybill-dialog';
import { SendToCarrierMenu } from './send-to-carrier-menu';
import { waybillErrorText } from './waybill-error';

/**
 * Quản trị › Xử lý đơn lỗi (2026-11-02, CHỈ superadmin — mockup duyệt EX7o4M2BE7649vfbsx6LPz):
 * dải "Cần xử lý" 5 nhóm (GET /sales-orders/issue-counts) + danh sách nhóm đang chọn
 * (GET /sales-orders?issue=…). Mọi thao tác là hộp thoại sẵn có của màn Đơn hàng — không vượt luồng.
 * Nhóm, lọc, trang nằm trên URL (luật 8).
 */

type FilterKey = 'issue' | 'from' | 'to' | 'old' | 'ready';
const FILTER_KEYS: readonly FilterKey[] = ['issue', 'from', 'to', 'old', 'ready'];
const LIST_DEFAULTS = { filterKeys: FILTER_KEYS };
const OLDER_DAYS = 2;

/** Nhãn ngắn của mã lỗi vận đơn cho ô thống kê — câu đầy đủ ở cột Lý do (luật 6). */
const WAYBILL_CODE_SHORT: Record<string, string> = {
  PICKUP_WAREHOUSE_NOT_READY: 'kho chưa khai điểm lấy',
  PICKUP_WAREHOUSE_MISSING: 'chưa có kho lấy hàng',
  CARRIER_REJECTED: 'hãng từ chối',
  CARRIER_WAYBILL_DATA: 'thiếu địa chỉ giao',
  RECIPIENT_PHONE_MASKED: 'SĐT bị che',
};

type Level = 'block' | 'warn' | 'info';
interface IssueTab {
  issue: OrderIssue;
  label: string;
  level: Level;
  hint: string;
  count: (c: OrderIssueCounts) => number;
  note: (c: OrderIssueCounts) => string;
}

const ISSUE_TABS: IssueTab[] = [
  {
    issue: 'WAYBILL_ERROR',
    label: 'Lỗi vận đơn',
    level: 'block',
    hint: 'Sửa nguyên nhân trước (địa chỉ kho ở Kho & vị trí, SĐT / địa chỉ giao trên đơn) rồi xin lại. Đơn xin lại thành công rời danh sách.',
    count: (c) => c.waybillError,
    note: (c) =>
      c.waybillErrorCodes
        .slice(0, 3)
        .map((e) => `${e.count} ${WAYBILL_CODE_SHORT[e.code] ?? 'lỗi khác'}`)
        .join(' · ') || 'Không có đơn lỗi vận đơn',
  },
  {
    issue: 'CARRIER_CANCELLED',
    label: 'Hãng hủy mã',
    level: 'block',
    hint: 'Hãng đã hủy mã trước khi lấy hàng. Gửi sang ĐVVC lại để có mã mới (đổi hãng / tài khoản được).',
    count: (c) => c.carrierCancelled,
    note: () => 'Phiếu hãng hủy, chưa gửi lại',
  },
  {
    issue: 'PACK_ERROR',
    label: 'Không in được',
    level: 'warn',
    hint: 'Lỗi "Đóng gói + in" lần trước. Lọc "Hiện tại: Đã đủ hàng" rồi Đóng gói + in lại; đơn vẫn thiếu thì Chuyển Chờ hàng.',
    count: (c) => c.packError,
    note: (c) => `${c.packErrorStockReady} đơn nay đã đủ hàng — đóng gói lại được`,
  },
  {
    issue: 'AWAITING_PICKUP',
    label: 'Có mã, hãng chưa lấy',
    level: 'warn',
    hint: 'Có mã vận đơn nhưng hãng chưa báo lấy hàng. VTP chỉ báo qua webhook — mở đơn xem thẻ hãng trước khi hủy mã.',
    count: (c) => c.awaitingPickup,
    note: (c) => `${c.awaitingPickupOld} đơn quá ${c.olderThanDays} ngày`,
  },
  {
    issue: 'UNSENT',
    label: 'Chưa gửi ĐVVC',
    level: 'info',
    hint: 'Đơn đã xác nhận nhưng chưa Gửi sang ĐVVC. Đơn đang thiếu hàng thì Chuyển Chờ hàng thay vì gửi.',
    count: (c) => c.unsent,
    note: (c) =>
      `${c.unsentOld} đơn quá ${c.olderThanDays} ngày · ${c.unsentShort} đang thiếu hàng`,
  },
];

const LEVEL_TEXT: Record<Level, string> = {
  block: 'text-destructive',
  warn: 'text-warning',
  info: 'text-foreground',
};
const LEVEL_DOT: Record<Level, string> = {
  block: 'bg-destructive',
  warn: 'bg-warning',
  info: 'bg-info',
};

function parseIssue(v: string | undefined): OrderIssue {
  return ISSUE_TABS.find((t) => t.issue === v)?.issue ?? 'WAYBILL_ERROR';
}

/** Tuổi đơn theo ngày đơn — "28/10 · 5 ngày". */
function ageText(iso: string): { text: string; old: boolean } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return { text: `${formatDate(iso)} · ${days} ngày`, old: days >= OLDER_DAYS };
}

export function OrderIssuesScreen() {
  const { state, set } = useListState<FilterKey>(LIST_DEFAULTS);
  const issue = parseIssue(state.filters.issue);
  const tab = ISSUE_TABS.find((t) => t.issue === issue)!;
  const common = {
    q: state.q,
    from: state.filters.from,
    to: state.filters.to,
  };
  const counts = useOrderIssueCounts({ ...common, olderThanDays: OLDER_DAYS });
  const query = useOrders({
    ...common,
    issue,
    olderThanDays: state.filters.old === '1' ? OLDER_DAYS : undefined,
    stockReady:
      issue === 'PACK_ERROR' && state.filters.ready ? state.filters.ready === 'true' : undefined,
    take: state.size,
    skip: (state.page - 1) * state.size,
  });
  const carriers = useCarriers();
  const carrierCode = useMemo(() => {
    const byId = new Map((carriers.data ?? []).map((c) => [c.id, c.code]));
    return (o: SalesOrderListItem) =>
      o.shipment?.carrierCode ?? (o.carrierId ? (byId.get(o.carrierId) ?? null) : null);
  }, [carriers.data]);

  const [selected, setSelected] = useState<RowSelectionState>({});
  const clearSelection = useCallback(() => setSelected({}), []);
  const [retryRows, setRetryRows] = useState<SalesOrderListItem[] | null>(null);
  const selectedRows = (query.data?.items ?? []).filter((r) => selected[r.id]);

  const switchTab = (next: OrderIssue) => {
    clearSelection();
    set({ filters: { ...state.filters, issue: next, ready: undefined } });
  };

  const columns = useMemo(
    () => buildColumns(issue, carrierCode, (o) => setRetryRows([o])),
    [issue, carrierCode],
  );

  const filters: FilterDef<FilterKey>[] = [
    { key: 'from', toKey: 'to', label: 'Ngày đơn', type: 'dateRange' },
    {
      key: 'old',
      label: 'Tuổi đơn',
      type: 'select',
      options: [{ value: '1', label: `Quá ${OLDER_DAYS} ngày` }],
    },
    ...(issue === 'PACK_ERROR'
      ? [
          {
            key: 'ready' as const,
            label: 'Hiện tại',
            type: 'select' as const,
            options: [
              { value: 'true', label: 'Đã đủ hàng' },
              { value: 'false', label: 'Vẫn thiếu' },
            ],
          },
        ]
      : []),
  ];
  const hasFilter = !!(state.q || state.filters.from || state.filters.old || state.filters.ready);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Xử lý đơn lỗi' }]}
        title="Xử lý đơn lỗi"
        description="Đơn kẹt ở bước gửi hãng, đóng gói, hãng lấy hàng — theo ngày đơn, kho đang chọn."
        status={<StatusBadge tone="neutral">Chỉ superadmin</StatusBadge>}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void counts.refetch();
              void query.refetch();
            }}
          >
            <RefreshCw aria-hidden />
            Làm mới
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Cần xử lý"
        className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        {ISSUE_TABS.map((t) => {
          const on = t.issue === issue;
          const c = counts.data;
          return (
            <button
              key={t.issue}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`issue-tile-${t.issue}`}
              onClick={() => switchTab(t.issue)}
              className={cn(
                'flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5 text-left hover:border-input',
                on && 'border-primary ring-1 ring-primary',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-sm', LEVEL_DOT[t.level])} />
                <span className={cn('text-base font-semibold tabular-nums', LEVEL_TEXT[t.level])}>
                  {c ? t.count(c).toLocaleString('vi-VN') : '—'}
                </span>
              </span>
              <span className="font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{c ? t.note(c) : 'Đang đếm…'}</span>
            </button>
          );
        })}
      </div>

      <p
        className="mb-3 rounded-md bg-info-weak px-3 py-2 text-sm text-info"
        data-testid="issue-hint"
      >
        {tab.hint}
      </p>

      {selectedRows.length > 0 ? (
        <IssueBulkBar issue={issue} rows={selectedRows} onClear={clearSelection} />
      ) : (
        <FilterBar
          q={state.q}
          onQChange={(q) => set({ q })}
          filters={filters}
          values={state.filters}
          onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
          searchPlaceholder="Mã đơn, SĐT, tên khách, mã vận đơn"
        />
      )}

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có đơn nào khớp' : `Không còn đơn ${tab.label.toLowerCase()}`}
            description={
              hasFilter ? 'Thử bỏ bớt bộ lọc.' : 'Nhóm này đã xử lý hết. Chọn nhóm khác ở trên.'
            }
            action={
              hasFilter ? (
                <Button
                  variant="outline"
                  onClick={() => set({ q: '', filters: { issue: state.filters.issue } })}
                >
                  Xóa lọc
                </Button>
              ) : undefined
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
            onSortChange={() => undefined}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>

      <BulkRetryWaybillDialog
        rows={retryRows ?? []}
        open={retryRows !== null}
        onOpenChange={(o) => {
          if (!o) setRetryRows(null);
        }}
        onDone={() => setRetryRows(null)}
      />
    </>
  );
}

function buildColumns(
  issue: OrderIssue,
  carrierCode: (o: SalesOrderListItem) => string | null,
  onRetry: (o: SalesOrderListItem) => void,
): ColumnDef<SalesOrderListItem, unknown>[] {
  const doc: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'doc',
    header: 'Đơn',
    meta: { width: 170 },
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <Link
          href={`/crm/orders/${row.original.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.original.docNumber}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.customer.name}
        </span>
      </div>
    ),
  };
  const warehouse: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'warehouse',
    header: 'Kho',
    meta: { width: 130 },
    cell: ({ row }) => row.original.warehouseName ?? '—',
  };
  const carrier: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'carrier',
    header: 'Hãng',
    meta: { width: 90 },
    cell: ({ row }) =>
      carrierCode(row.original) ?? <span className="text-muted-foreground">Chưa gán</span>,
  };
  const age: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'age',
    header: 'Ngày đơn',
    meta: { width: 130 },
    cell: ({ row }) => {
      const a = ageText(row.original.orderDate);
      return (
        <span className={a.old ? 'font-semibold text-warning' : 'text-muted-foreground'}>
          {a.text}
        </span>
      );
    },
  };
  const shortage: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'stock',
    header: 'Hiện tại',
    meta: { width: 170 },
    cell: ({ row }) => {
      const s = row.original.shortage;
      return s && s.items.length > 0 ? (
        <span title={s.items.map((i) => `${i.skuCode} ${i.skuName}`).join(', ')}>
          <StatusBadge tone="err">Thiếu {s.items.map((i) => i.skuCode).join(', ')}</StatusBadge>
        </span>
      ) : (
        <StatusBadge tone="ok">Đã đủ hàng</StatusBadge>
      );
    },
  };
  const actions: ColumnDef<SalesOrderListItem, unknown> = {
    id: 'actions',
    header: () => <span className="sr-only">Thao tác</span>,
    meta: { width: 88, title: 'Thao tác' },
    cell: ({ row }) => {
      const o = row.original;
      const items: RowActionItem[] = [
        ...(issue === 'WAYBILL_ERROR'
          ? [
              {
                label: 'Xin lại vận đơn',
                icon: <RefreshCw aria-hidden />,
                onSelect: () => onRetry(o),
              },
            ]
          : []),
        { label: 'Sửa đơn', icon: <Pencil aria-hidden />, href: `/crm/orders/${o.id}/edit` },
      ];
      return (
        <RowActions
          itemName={`đơn ${o.docNumber}`}
          primary={{ label: 'Xem đơn', icon: <Eye aria-hidden />, href: `/crm/orders/${o.id}` }}
          items={items}
        />
      );
    },
  };

  const specific: ColumnDef<SalesOrderListItem, unknown>[] =
    issue === 'WAYBILL_ERROR'
      ? [
          carrier,
          {
            id: 'reason',
            header: 'Lý do',
            meta: { width: 380 },
            cell: ({ row }) => (
              <span className="block whitespace-normal font-semibold text-destructive">
                {waybillErrorText(row.original.waybillErrorCode, row.original.waybillError)}
              </span>
            ),
          },
          {
            id: 'at',
            header: 'Lúc lỗi',
            meta: { width: 120 },
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {formatDateTime(row.original.waybillErrorAt)}
              </span>
            ),
          },
        ]
      : issue === 'CARRIER_CANCELLED'
        ? [
            carrier,
            {
              id: 'tracking',
              header: 'Mã cũ',
              meta: { width: 200 },
              cell: ({ row }) =>
                row.original.shipment?.trackingNo ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.original.shipment.trackingNo}
                  </span>
                ) : (
                  '—'
                ),
            },
          ]
        : issue === 'PACK_ERROR'
          ? [
              {
                id: 'packError',
                header: 'Lỗi lần trước',
                meta: { width: 360 },
                cell: ({ row }) => (
                  <span className="block whitespace-normal">
                    <span className="block font-semibold text-destructive">
                      {messageForItemCode(row.original.packErrorCode ?? 'INTERNAL_ERROR')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(row.original.packErrorAt)}
                    </span>
                  </span>
                ),
              },
              shortage,
            ]
          : issue === 'AWAITING_PICKUP'
            ? [
                {
                  id: 'waybill',
                  header: 'Hãng · mã vận đơn',
                  meta: { width: 220 },
                  cell: ({ row }) => (
                    <div className="space-y-0.5">
                      <span className="block">{carrierCode(row.original) ?? '—'}</span>
                      {row.original.shipment?.trackingNo ? (
                        <CopyText
                          value={row.original.shipment.trackingNo}
                          what="mã vận đơn"
                          className="block max-w-48 truncate font-mono text-xs"
                        />
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'packed',
                  header: 'Kho',
                  meta: { width: 130 },
                  cell: ({ row }) => (
                    <StatusBadge tone="neutral">
                      {fulfilmentLabel(row.original.fulfilmentStatus ?? 'NOT_STARTED')}
                    </StatusBadge>
                  ),
                },
                {
                  id: 'label',
                  header: 'Tem',
                  meta: { width: 130 },
                  cell: ({ row }) =>
                    row.original.labelPrintedAt ? (
                      <span className="text-muted-foreground">
                        Đã in {formatDate(row.original.labelPrintedAt)}
                      </span>
                    ) : (
                      <StatusBadge tone="warn">Chưa in</StatusBadge>
                    ),
                },
              ]
            : [
                carrier,
                {
                  id: 'flow',
                  header: 'Tình trạng',
                  meta: { width: 140 },
                  cell: ({ row }) => (
                    <span className="text-muted-foreground">
                      {orderFlowLabel(row.original.flow)}
                    </span>
                  ),
                },
                shortage,
              ];

  return [doc, warehouse, ...specific, age, actions];
}

/** Thanh chọn nhiều theo nhóm — mỗi nhóm một việc chính (mép phải), tối đa 2 nút phụ. */
function IssueBulkBar({
  issue,
  rows,
  onClear,
}: {
  issue: OrderIssue;
  rows: SalesOrderListItem[];
  onClear: () => void;
}) {
  const [dialog, setDialog] = useState<'shipping' | 'retry' | 'reprint' | 'cancel' | null>(null);
  const openChange = (d: NonNullable<typeof dialog>) => (o: boolean) => setDialog(o ? d : null);
  const waiting = useSetOrdersWaitingStock();
  const toWaiting = () =>
    waiting.mutate(
      { orderIds: rows.map((r) => r.id), waiting: true },
      {
        onSuccess: (r) => {
          if (r.updated.length > 0) toast.success(`Đã chuyển Chờ hàng ${r.updated.length} đơn`);
          if (r.failed.length > 0) {
            toast.error(
              `${r.failed.length} đơn không chuyển Chờ hàng được: ${messageForCode(r.failed[0]!.code, 409)}`,
            );
          }
          if (r.failed.length === 0) onClear();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  const withWaybill = rows.filter((r) => r.shipment?.trackingNo);

  return (
    <div className="mb-3">
      <BulkActionBar
        count={rows.length}
        noun="đơn"
        onClear={onClear}
        className="min-h-8 rounded-md border-b-0 py-0"
      >
        <span className="ml-auto" />
        {issue === 'WAYBILL_ERROR' || issue === 'UNSENT' ? (
          <Button variant="outline" size="sm" onClick={() => setDialog('shipping')}>
            Gán hãng / cân nặng
          </Button>
        ) : null}
        {issue === 'PACK_ERROR' || issue === 'UNSENT' ? (
          <Button variant="outline" size="sm" loading={waiting.isPending} onClick={toWaiting}>
            Chuyển Chờ hàng
          </Button>
        ) : null}
        {issue === 'AWAITING_PICKUP' ? (
          <>
            <Button
              variant="danger-ghost"
              size="sm"
              disabled={withWaybill.length === 0}
              onClick={() => setDialog('cancel')}
            >
              Hủy vận đơn
            </Button>
            <Button size="sm" onClick={() => setDialog('reprint')}>
              In lại vận đơn ({rows.length})
            </Button>
          </>
        ) : null}
        {issue === 'WAYBILL_ERROR' ? (
          <Button size="sm" onClick={() => setDialog('retry')}>
            <RefreshCw aria-hidden />
            Xin lại vận đơn ({rows.length})
          </Button>
        ) : null}
        {issue === 'PACK_ERROR' ? <BulkFulfilPrintDialog rows={rows} onDone={onClear} /> : null}
        {issue === 'CARRIER_CANCELLED' || issue === 'UNSENT' ? (
          <SendToCarrierMenu rows={rows} onDone={onClear} />
        ) : null}
      </BulkActionBar>
      <BulkShippingDialog
        rows={rows}
        onDone={onClear}
        open={dialog === 'shipping'}
        onOpenChange={openChange('shipping')}
      />
      <BulkRetryWaybillDialog
        rows={rows}
        open={dialog === 'retry'}
        onOpenChange={openChange('retry')}
        onDone={onClear}
      />
      <BulkReprintWaybillDialog
        rows={rows}
        open={dialog === 'reprint'}
        onOpenChange={openChange('reprint')}
      />
      <CancelWaybillDialog
        rows={withWaybill.map((r) => ({
          id: r.id,
          docNumber: r.docNumber,
          trackingNo: r.shipment?.trackingNo ?? null,
        }))}
        open={dialog === 'cancel'}
        onOpenChange={openChange('cancel')}
        onDone={onClear}
      />
    </div>
  );
}
