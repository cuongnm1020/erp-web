'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import Decimal from 'decimal.js';
import { FileSpreadsheet, ReceiptText, Truck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { Copyable } from '@/components/data/copy-button';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { DateRangePicker } from '@/components/data/date-range-picker';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatMoney, toLocalDateKey } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import {
  useCollectDelivered,
  useEInvoiceAction,
  useEInvoices,
  useImportReconciliation,
  useSkipEInvoices,
  useSyncEInvoices,
  type CarrierReconImportResult,
  type EInvoiceAction,
  type EInvoiceActionResult,
  type EInvoiceListItem,
  type EInvoiceListQuery,
  type EInvoiceStatus,
} from '../api/use-einvoices';
import {
  CARRIER_NAME,
  EINVOICE_ISSUE,
  EINVOICE_STATUS,
  EINVOICE_TABS,
  issueLabel,
  RECON_OUTCOME,
  RECON_OUTCOMES,
} from '../einvoice-labels';

/**
 * Hóa đơn điện tử (canvas CVnCtWbPyUCdn7pppHaRWX màn 1, docs/PLAN-einvoice-misa.md §12): hàng chờ
 * hóa đơn theo trạng thái. Bước 1 (einvoice.review): nhập đối soát hãng, duyệt / không xuất. Bước 2
 * (einvoice.issue): đẩy nháp lên MISA, kế toán phát hành trên meInvoice, "Lấy kết quả" kéo số về.
 * URL: ?tab=<status> · ?q= · ?from= ?to= (ngày giao) · ?issue= · ?page=
 */
const FILTER_KEYS = ['tab', 'from', 'to', 'issue'] as const;
type F = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };

const ACTION_DONE: Record<EInvoiceAction, string> = {
  approve: 'Đã duyệt',
  unapprove: 'Đã bỏ duyệt',
  push: 'Đã đẩy nháp lên MISA',
  withdraw: 'Đã rút nháp khỏi MISA',
  unskip: 'Đã mở lại',
};

export function EInvoiceListScreen() {
  const { state, set, skipTake } = useListState<F>(DEFAULTS);
  const tab = (state.filters.tab as EInvoiceStatus | undefined) ?? 'PENDING_REVIEW';
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [dialog, setDialog] = useState<'import' | 'collect' | 'skip' | null>(null);
  const ability = useAbility();

  const params = useMemo<EInvoiceListQuery>(
    () => ({
      status: tab,
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.from ? { from: state.filters.from } : {}),
      ...(state.filters.to ? { to: state.filters.to } : {}),
      ...(state.filters.issue ? { issue: state.filters.issue } : {}),
      ...skipTake,
    }),
    [tab, state.q, state.filters, skipTake],
  );
  const query = useEInvoices(params);
  const action = useEInvoiceAction();
  const sync = useSyncEInvoices();

  const rows = query.data?.items ?? [];
  const ids = Object.keys(selected).filter((k) => selected[k]);
  const chosen = rows.filter((r) => ids.includes(r.id));
  const counts = query.data?.counts;
  const filtered = !!(state.q || state.filters.from || state.filters.issue);
  const columns = useMemo(() => buildColumns(tab), [tab]);

  const run = (a: EInvoiceAction, list: string[] = ids) =>
    action.mutate(
      { action: a, ids: list },
      {
        onSuccess: (r) => {
          reportResult(ACTION_DONE[a], r);
          setSelected({});
        },
        onError: (e) => toast.error(messageFor(e)),
      },
    );

  // Luật 10: cộng tiền bằng decimal.js.
  const total = chosen.reduce((s, r) => s.plus(r.total), new Decimal(0));

  return (
    <>
      <PageHeader
        title="Hóa đơn điện tử"
        description={
          <>
            MISA meInvoice · đẩy nháp, kế toán ký và phát hành trên meInvoice
            {ability.can('config', 'Einvoice') ? (
              <>
                {' · '}
                <Link href="/fin/einvoices/settings" className="text-primary underline">
                  Cài đặt kết nối
                </Link>
              </>
            ) : null}
          </>
        }
        breadcrumb={[{ label: 'Tài chính', href: '/fin/invoices' }, { label: 'Hóa đơn điện tử' }]}
        actions={
          <>
            <Can I="review" a="Einvoice">
              <Button variant="outline" onClick={() => setDialog('collect')}>
                <Truck aria-hidden /> Lấy đơn đã giao
              </Button>
            </Can>
            <Can I="issue" a="Einvoice">
              <Button
                variant="outline"
                loading={sync.isPending}
                onClick={() =>
                  sync.mutate(undefined, {
                    onSuccess: (r) =>
                      toast.success(
                        `Đã lấy kết quả từ MISA: ${r.issued} hóa đơn có số / ${r.checked} đã kiểm`,
                      ),
                    onError: (e) => toast.error(messageFor(e)),
                  })
                }
              >
                Lấy kết quả từ MISA
              </Button>
            </Can>
            <Can I="review" a="Einvoice">
              <Button onClick={() => setDialog('import')}>
                <FileSpreadsheet aria-hidden /> Nhập đối soát hãng
              </Button>
            </Can>
          </>
        }
      />

      <section className="rounded-lg border bg-card" aria-label="Danh sách hóa đơn điện tử">
        <div className="flex overflow-x-auto border-b" role="tablist" aria-label="Trạng thái">
          {EINVOICE_TABS.map((s) => {
            const active = s === tab;
            const n = counts?.[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSelected({});
                  set({
                    page: 1,
                    filters: { ...state.filters, tab: s === 'PENDING_REVIEW' ? undefined : s },
                  });
                }}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2 pt-2 text-sm',
                  active
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {EINVOICE_STATUS[s].label}
                {n !== undefined ? (
                  <span
                    className={cn(
                      'rounded-chip px-1.5 text-xs font-semibold',
                      n > 0 && s === 'PENDING_REVIEW'
                        ? 'bg-warning-weak text-warning'
                        : n > 0 && s === 'FAILED'
                          ? 'bg-destructive-weak text-destructive'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {ids.length ? (
          <BulkActionBar count={ids.length} noun="hóa đơn" onClear={() => setSelected({})}>
            <span className="text-sm text-muted-foreground">
              Tổng thanh toán {formatMoney(total.toFixed(0))}
            </span>
            {tab === 'PENDING_REVIEW' ? (
              <Can I="review" a="Einvoice">
                <Button size="sm" variant="outline" onClick={() => setDialog('skip')}>
                  Không xuất
                </Button>
                <Button size="sm" loading={action.isPending} onClick={() => run('approve')}>
                  Duyệt {ids.length} hóa đơn
                </Button>
              </Can>
            ) : null}
            {tab === 'APPROVED' || tab === 'FAILED' ? (
              <>
                <Can I="review" a="Einvoice">
                  <Button size="sm" variant="outline" onClick={() => run('unapprove')}>
                    Bỏ duyệt
                  </Button>
                </Can>
                <Can I="issue" a="Einvoice">
                  <Button size="sm" loading={action.isPending} onClick={() => run('push')}>
                    {tab === 'FAILED' ? 'Đẩy lại lên MISA' : 'Đẩy nháp lên MISA'}
                  </Button>
                </Can>
              </>
            ) : null}
            {tab === 'PUSHED' ? (
              <Can I="issue" a="Einvoice">
                <Button
                  size="sm"
                  variant="outline"
                  loading={action.isPending}
                  onClick={() => run('withdraw')}
                >
                  Rút nháp khỏi MISA
                </Button>
              </Can>
            ) : null}
            {tab === 'SKIPPED' ? (
              <Can I="review" a="Einvoice">
                <Button size="sm" loading={action.isPending} onClick={() => run('unskip')}>
                  Mở lại để xuất
                </Button>
              </Can>
            ) : null}
          </BulkActionBar>
        ) : (
          <div className="px-3 pt-3">
            <FilterBar<F>
              q={state.q}
              onQChange={(q) => set({ q })}
              values={state.filters}
              onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
              searchPlaceholder="Mã đơn, mã vận đơn, số hóa đơn"
              filters={[
                {
                  key: 'from',
                  toKey: 'to',
                  label: 'Giao thành công',
                  type: 'dateRange',
                  maxDays: 92,
                },
                {
                  key: 'issue',
                  label: 'Vấn đề',
                  type: 'select',
                  options: Object.entries(EINVOICE_ISSUE).map(([value, v]) => ({
                    value,
                    label: v.label,
                  })),
                },
              ]}
            />
          </div>
        )}

        <div className="px-3 pb-3 pt-2">
          <QueryState
            query={query}
            skeleton={<ListSkeleton rows={12} columns={10} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                icon={ReceiptText}
                title={
                  filtered
                    ? 'Không có hóa đơn khớp'
                    : `Không có hóa đơn ${EINVOICE_STATUS[tab].label.toLowerCase()}`
                }
                description={
                  filtered
                    ? 'Thử bỏ bớt điều kiện lọc hoặc đổi tab.'
                    : tab === 'PENDING_REVIEW'
                      ? 'Nhập file đối soát của hãng để đưa đơn giao thành công vào hàng chờ.'
                      : 'Hóa đơn ở trạng thái này sẽ hiện ở đây.'
                }
                action={
                  filtered ? (
                    <Button
                      variant="outline"
                      onClick={() => set({ q: '', filters: { tab: state.filters.tab } })}
                    >
                      Xóa lọc
                    </Button>
                  ) : tab === 'PENDING_REVIEW' && ability.can('review', 'Einvoice') ? (
                    <Button onClick={() => setDialog('import')}>Nhập đối soát hãng</Button>
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
                selection={{ selected, onChange: setSelected }}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={() => undefined}
              />
            )}
          </QueryState>
        </div>
      </section>

      <ImportReconDialog
        open={dialog === 'import'}
        onOpenChange={(o) => setDialog(o ? 'import' : null)}
      />
      <CollectDialog
        open={dialog === 'collect'}
        onOpenChange={(o) => setDialog(o ? 'collect' : null)}
      />
      <SkipDialog
        open={dialog === 'skip'}
        onOpenChange={(o) => setDialog(o ? 'skip' : null)}
        ids={ids}
        onDone={() => setSelected({})}
      />
    </>
  );
}

function reportResult(verb: string, r: EInvoiceActionResult) {
  if (r.failed.length === 0) {
    toast.success(`${verb} ${r.done} hóa đơn`);
    return;
  }
  const list = r.failed
    .slice(0, 5)
    .map((f) => `${f.orderDocNumber || f.id.slice(0, 8)}: ${f.message}`)
    .join('; ');
  const more = r.failed.length > 5 ? ` và ${r.failed.length - 5} hóa đơn khác` : '';
  toast.error(`${verb} ${r.done} hóa đơn; ${r.failed.length} không làm được — ${list}${more}`);
}

function buildColumns(tab: EInvoiceStatus): ColumnDef<EInvoiceListItem, unknown>[] {
  return [
    {
      id: 'order',
      header: 'Mã đơn',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Copyable value={row.original.orderDocNumber} label="Chép mã đơn">
          <Link
            href={`/fin/einvoices/${row.original.id}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.orderDocNumber}
          </Link>
        </Copyable>
      ),
    },
    {
      id: 'delivered',
      header: 'Giao thành công',
      meta: { width: 130 },
      cell: ({ row }) => formatDateTime(row.original.deliveredAt),
    },
    {
      id: 'carrier',
      header: 'Hãng · mã vận đơn',
      meta: { width: 200 },
      cell: ({ row }) => (
        <div className="leading-tight">
          <div>
            {CARRIER_NAME[row.original.carrierCode ?? ''] ?? row.original.carrierCode ?? '—'}
          </div>
          {row.original.trackingNo ? (
            <Copyable
              value={row.original.trackingNo}
              label="Chép mã vận đơn"
              className="text-xs text-muted-foreground"
            >
              <span className="font-mono">{row.original.trackingNo}</span>
            </Copyable>
          ) : null}
        </div>
      ),
    },
    {
      id: 'buyer',
      header: 'Người mua',
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="truncate" title={row.original.buyerName ?? undefined}>
            {row.original.buyerName ?? '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.original.buyerTaxCode ? `MST ${row.original.buyerTaxCode}` : 'Khách lẻ'}
          </div>
        </div>
      ),
    },
    {
      id: 'rates',
      header: 'Thuế suất',
      meta: { width: 100 },
      cell: ({ row }) => (
        <span className="flex gap-1">
          {row.original.ratePercents.map((p) => (
            <StatusBadge key={p} tone={p === '?' ? 'err' : 'neutral'}>
              {p === '?' ? 'Chưa gán' : `${p}%`}
            </StatusBadge>
          ))}
        </span>
      ),
    },
    {
      id: 'collected',
      header: 'Hãng thu',
      meta: { width: 110, align: 'right' },
      cell: ({ row }) =>
        row.original.collectedAmount === null ? (
          <span className="text-muted-foreground">Chưa đối soát</span>
        ) : (
          formatMoney(row.original.collectedAmount, { unit: '' })
        ),
    },
    {
      id: 'subtotal',
      header: 'Trước thuế',
      meta: { width: 110, align: 'right' },
      cell: ({ row }) => formatMoney(row.original.subtotal, { unit: '' }),
    },
    {
      id: 'vat',
      header: 'Thuế GTGT',
      meta: { width: 100, align: 'right' },
      cell: ({ row }) => formatMoney(row.original.vatAmount, { unit: '' }),
    },
    {
      id: 'total',
      header: 'Tổng thanh toán',
      meta: { width: 120, align: 'right' },
      cell: ({ row }) => <b>{formatMoney(row.original.total, { unit: '' })}</b>,
    },
    {
      id: 'state',
      header: tab === 'ISSUED' ? 'Số hóa đơn' : 'Tình trạng',
      meta: { width: 220 },
      cell: ({ row }) => <StateCell r={row.original} />,
    },
  ];
}

function StateCell({ r }: { r: EInvoiceListItem }) {
  if (r.status === 'ISSUED') {
    return (
      <span className="font-mono text-xs">
        {r.invSeries} · {r.invNo}
      </span>
    );
  }
  if (r.status === 'FAILED') {
    return (
      <span className="text-destructive" title={r.errorMessage ?? undefined}>
        {r.errorMessage ?? 'MISA từ chối'}
      </span>
    );
  }
  if (r.status === 'SKIPPED') return <span className="text-muted-foreground">{r.skipReason}</span>;
  if (r.issues.length === 0) return <StatusBadge tone="ok">Sẵn sàng</StatusBadge>;
  const first = r.issues.find((i) => EINVOICE_ISSUE[i]?.block) ?? r.issues[0]!;
  return (
    <span title={r.issues.map(issueLabel).join(' · ')}>
      <StatusBadge tone={EINVOICE_ISSUE[first]?.block ? 'err' : 'warn'}>
        {issueLabel(first)}
        {r.issues.length > 1 ? ` +${r.issues.length - 1}` : ''}
      </StatusBadge>
    </span>
  );
}

// ── Hộp thoại ─────────────────────────────────────────────────

function ImportReconDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const upload = useImportReconciliation();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CarrierReconImportResult | null>(null);
  const close = (o: boolean) => {
    if (upload.isPending) return;
    onOpenChange(o);
    if (!o) {
      setFile(null);
      setResult(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Nhập đối soát hãng</DialogTitle>
          <DialogDescription>
            File Excel của hãng: bảng kê trả tiền COD VNPost, báo cáo vận hành Viettel Post / GHTK —
            nhiều sheet trong một file được. Đơn giao thành công vào hàng chờ; hãng thu thiếu thì kế
            toán sửa số lượng khi duyệt; thu 0 ₫ (đơn đổi / bù) không xuất.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              Đã đọc <b>{result.rowCount}</b> dòng: <b>{result.queued}</b> đơn vào hàng chờ,{' '}
              <b>{result.skipped}</b> đơn không xuất, <b>{result.untouched}</b> đơn đã duyệt / đã
              đẩy từ trước giữ nguyên.
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {RECON_OUTCOMES.filter((o) => result.summary[o]).map((o) => (
                <li key={o} className="flex items-center justify-between gap-2">
                  <StatusBadge tone={RECON_OUTCOME[o].tone}>{RECON_OUTCOME[o].label}</StatusBadge>
                  <span className="tabular-nums">{result.summary[o]}</span>
                </li>
              ))}
            </ul>
            {result.skippedSheets.length ? (
              <p className="text-muted-foreground">
                Bỏ qua sheet không đúng mẫu: {result.skippedSheets.join(', ')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="recon-file">File đối soát (.xlsx)</Label>
            <Input
              id="recon-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/fin/einvoices/reconciliations/${result.id}`}>Xem từng dòng</Link>
              </Button>
              <Button onClick={() => close(false)}>Xong</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={upload.isPending} onClick={() => close(false)}>
                Hủy
              </Button>
              <Button
                loading={upload.isPending}
                disabled={!file}
                onClick={() =>
                  file &&
                  upload.mutate(file, {
                    onSuccess: (r) => {
                      setResult(r);
                      toast.success(`Đã nhập đối soát: ${r.queued} đơn vào hàng chờ`);
                    },
                    onError: (e) => toast.error(messageFor(e)),
                  })
                }
              >
                Nhập file
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const today = toLocalDateKey(new Date()) ?? '';
  const [range, setRange] = useState({ from: today, to: today });
  const collect = useCollectDelivered();
  return (
    <Dialog open={open} onOpenChange={(o) => !collect.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lấy đơn đã giao</DialogTitle>
          <DialogDescription>
            Thêm vào hàng chờ các đơn hãng báo giao thành công trong khoảng ngày mà chưa có trong
            danh sách. Đơn chưa có đối soát được đánh dấu để kế toán kiểm tiền trước khi duyệt.
          </DialogDescription>
        </DialogHeader>
        <DateRangePicker
          label="Ngày giao"
          value={range}
          onChange={setRange}
          today={today}
          maxDays={31}
        />
        <DialogFooter>
          <Button
            variant="outline"
            disabled={collect.isPending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            loading={collect.isPending}
            onClick={() =>
              collect.mutate(range, {
                onSuccess: (r) => {
                  toast.success(`Đã lấy ${r.added} đơn đã giao vào hàng chờ`);
                  onOpenChange(false);
                },
                onError: (e) => toast.error(messageFor(e)),
              })
            }
          >
            Lấy đơn đã giao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkipDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  onDone: () => void;
}) {
  const skip = useSkipEInvoices();
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !skip.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Không xuất {ids.length} hóa đơn</DialogTitle>
          <DialogDescription>
            Đơn chuyển sang tab Không xuất. Mở lại được bất cứ lúc nào.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="skip-reason">Lý do</Label>
          <Input
            id="skip-reason"
            value={reason}
            maxLength={300}
            placeholder="Vd: đơn tặng, khách hoàn"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={skip.isPending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            loading={skip.isPending}
            disabled={!reason.trim()}
            onClick={() =>
              skip.mutate(
                { ids, reason: reason.trim() },
                {
                  onSuccess: (r) => {
                    reportResult('Đã chuyển sang Không xuất', r);
                    setReason('');
                    onOpenChange(false);
                    onDone();
                  },
                  onError: (e) => toast.error(messageFor(e)),
                },
              )
            }
          >
            Không xuất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
