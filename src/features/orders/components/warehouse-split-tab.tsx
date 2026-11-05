'use client';

import Link from 'next/link';
import { Eraser, Eye, Pencil, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useWarehouses } from '@/features/wms/api/use-warehouses';
import {
  useDismissWarehouseSplits,
  useRepairWarehouseSplits,
  useScanWarehouseSplits,
  useWarehouseSplits,
  type WarehouseSplitFix,
  type WarehouseSplitOrder,
  type WarehouseSplitRepairItem,
} from '../api/use-orders';
import { fulfilmentLabel } from '../labels';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';

/**
 * Tab "Đổi kho nhân đôi combo" của màn Xử lý đơn lỗi (2026-11-05, quyền
 * `sales_order.fix_warehouse_split` — mặc định Admin). Sự cố: ERP đổi kho đơn Pancake có combo →
 * Pancake tách thành phần combo thành dòng giá 0 → đơn thừa hàng. "Dọn dòng thừa" chỉ cho đơn kho
 * chưa bắt đầu; đơn đã đóng gói / đã giao sửa tay rồi "Đánh dấu đã xử lý".
 */

type Fulfilment = Parameters<typeof fulfilmentLabel>[0];
type RepairResult = WarehouseSplitRepairItem['result'];
type Reason = NonNullable<WarehouseSplitOrder['reason']>;

/** Mỗi lần dọn tối đa 50 đơn (API gọi Pancake vài lần mỗi đơn). */
const REPAIR_MAX = 50;

const FIX_LABEL: Record<WarehouseSplitFix, string> = {
  REPAIR: 'Dọn được',
  PACKED: 'Đã đóng gói',
  SHIPPED: 'Hãng đã lấy',
  MANUAL: 'Kiểm tay',
};
const FIX_TONE: Record<WarehouseSplitFix, StatusTone> = {
  REPAIR: 'warn',
  PACKED: 'err',
  SHIPPED: 'neutral',
  MANUAL: 'neutral',
};
/** Việc phải làm theo cách xử lý (câu ở web — luật 6). */
const FIX_TODO: Record<WarehouseSplitFix, string> = {
  REPAIR: 'Bấm Dọn dòng thừa: đẩy lại dòng gốc lên Pancake, ERP bỏ dòng thừa, kho lấy lại đúng số.',
  PACKED:
    'Tồn đã trừ cả hàng thừa. Kho mở hộp lấy hàng thừa ra, nhập điều chỉnh tồn tăng lại, rồi Đánh dấu đã xử lý.',
  SHIPPED: 'Hàng thừa đã đi cùng đơn. Liên hệ khách / hãng nếu cần thu lại, rồi Đánh dấu đã xử lý.',
  MANUAL: '',
};
const REASON_TEXT: Record<Reason, string> = {
  ZERO_BEFORE:
    'Đơn đã có dòng giá 0 trước khi đổi kho — mở đơn đối chiếu lịch sử Pancake, sửa ở Sửa đơn.',
  ERP_LOCKED: 'Đơn đang "ERP giữ" — bỏ dòng thừa ở Sửa đơn.',
  NOT_APPROVED: 'Đơn không ở trạng thái Đã xác nhận — mở đơn kiểm tra.',
  WAREHOUSE_BUSY:
    'Kho đang lấy / đóng gói đơn này — chờ kho xong (đơn chuyển sang Đã đóng gói) hoặc hủy việc lấy hàng rồi dọn.',
};
const RESULT: Record<RepairResult, { group: OrderResultRow['group']; status: string }> = {
  REPAIRED: { group: 'ok', status: 'Đã dọn dòng thừa' },
  NOT_REPAIRABLE: { group: 'wait', status: 'Không dọn tự động' },
  PANCAKE_CHANGED: { group: 'fix', status: 'Pancake đã đổi' },
  FAILED: { group: 'fix', status: 'Dọn lỗi' },
};
const RESULT_REASON: Partial<Record<RepairResult, string>> = {
  PANCAKE_CHANGED:
    'Pancake không còn khớp để dọn tự động (đã đổi trạng thái, có vận đơn hoặc sale đã sửa dòng) — mở đơn kiểm tay.',
  FAILED: 'Gọi Pancake hoặc cập nhật ERP lỗi — thử lại sau; vẫn lỗi thì báo kỹ thuật kèm mã đơn.',
};

export function todoText(o: Pick<WarehouseSplitOrder, 'fix' | 'reason'>): string {
  return o.fix === 'MANUAL' && o.reason ? REASON_TEXT[o.reason] : FIX_TODO[o.fix];
}

export function WarehouseSplitTab({
  fix,
  q,
  page,
  size,
  onFixChange,
  onQChange,
  onPageChange,
  onSizeChange,
}: {
  fix: WarehouseSplitFix | undefined;
  q: string;
  page: number;
  size: number;
  onFixChange: (fix: WarehouseSplitFix | undefined) => void;
  onQChange: (q: string) => void;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}) {
  const query = useWarehouseSplits({
    fix,
    q: q || undefined,
    take: size,
    skip: (page - 1) * size,
  });
  const scan = useScanWarehouseSplits();
  const warehouses = useWarehouses();
  const whName = useMemo(() => {
    const m = new Map((warehouses.data ?? []).map((w) => [w.id, w.name]));
    return (id: string | null) => (id ? (m.get(id) ?? '—') : '—');
  }, [warehouses.data]);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const clear = useCallback(() => setSelected({}), []);
  const rows = (query.data?.items ?? []).filter((r) => selected[r.orderId]);
  const columns = useMemo(() => buildColumns(whName), [whName]);
  const hasFilter = !!(fix || q);

  return (
    <>
      {rows.length > 0 ? (
        <SplitBulkBar rows={rows} onClear={clear} />
      ) : (
        <FilterBar
          q={q}
          onQChange={onQChange}
          filters={[
            {
              key: 'fix',
              label: 'Xử lý',
              type: 'select',
              options: (Object.keys(FIX_LABEL) as WarehouseSplitFix[]).map((k) => ({
                value: k,
                label: FIX_LABEL[k],
              })),
            },
          ]}
          values={{ fix }}
          onFilterChange={(p) => onFixChange((p.fix as WarehouseSplitFix | undefined) || undefined)}
          searchPlaceholder="Mã đơn"
          right={
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {query.data?.checkedAt
                ? `Quét lúc ${formatDateTime(query.data.checkedAt)}`
                : 'Chưa quét lần nào'}
              <Button
                variant="outline"
                size="sm"
                loading={scan.isPending}
                onClick={() =>
                  scan.mutate(undefined, {
                    onSuccess: (r) =>
                      toast.success(
                        r.added > 0
                          ? `Đã quét lại: thêm ${r.added} đơn dính lỗi`
                          : 'Đã quét lại: không có đơn mới',
                      ),
                    onError: (err) => toast.error(messageFor(err)),
                  })
                }
              >
                <RefreshCw aria-hidden />
                Quét lại
              </Button>
            </span>
          }
        />
      )}
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              hasFilter
                ? 'Không có đơn nào khớp'
                : query.data?.checkedAt
                  ? 'Không còn đơn thừa dòng do đổi kho'
                  : 'Chưa quét đơn dính lỗi'
            }
            description={
              hasFilter
                ? 'Thử bỏ lọc.'
                : query.data?.checkedAt
                  ? 'Mọi đơn dính lỗi đã dọn hoặc đã đánh dấu xử lý.'
                  : 'Bấm Quét lại để tìm đơn bị Pancake tách combo khi đổi kho.'
            }
            action={
              hasFilter ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    onFixChange(undefined);
                    onQChange('');
                  }}
                >
                  Xóa lọc
                </Button>
              ) : !query.data?.checkedAt ? (
                <Button
                  loading={scan.isPending}
                  onClick={() =>
                    scan.mutate(undefined, { onError: (err) => toast.error(messageFor(err)) })
                  }
                >
                  <RefreshCw aria-hidden />
                  Quét lại
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
            getRowId={(r) => r.orderId}
            total={data.total}
            page={page}
            size={size}
            sort={null}
            onSortChange={() => undefined}
            onPageChange={onPageChange}
            onSizeChange={onSizeChange}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>
    </>
  );
}

function buildColumns(
  whName: (id: string | null) => string,
): ColumnDef<WarehouseSplitOrder, unknown>[] {
  return [
    {
      id: 'doc',
      header: 'Đơn',
      meta: { width: 170 },
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <Link
            href={`/crm/orders/${row.original.orderId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">
            {row.original.customerName ?? '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'move',
      header: 'Đổi kho',
      meta: { width: 200 },
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="space-y-0.5 whitespace-normal">
            <span className="block">
              {whName(o.fromWarehouseId)} → {whName(o.toWarehouseId)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {o.movedByName ?? '—'} · {formatDateTime(o.movedAt)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'extra',
      header: 'Hàng thừa (giá 0)',
      meta: { width: 240 },
      cell: ({ row }) => (
        <ul className="space-y-0.5 whitespace-normal font-semibold text-destructive">
          {row.original.extraLines.map((l, i) => (
            <li key={i}>
              {l.skuName || l.skuCode} ×{formatQuantity(l.qty)}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'state',
      header: 'Kho',
      meta: { width: 150 },
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone="neutral">
            {fulfilmentLabel((row.original.fulfilmentStatus ?? 'NOT_STARTED') as Fulfilment)}
          </StatusBadge>
          {row.original.carrierStatusText ? (
            <span className="block text-xs text-muted-foreground">
              {row.original.carrierStatusText}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'fix',
      header: 'Cách xử lý',
      meta: { width: 360 },
      cell: ({ row }) => (
        <div className="space-y-1 whitespace-normal">
          <StatusBadge tone={FIX_TONE[row.original.fix]}>{FIX_LABEL[row.original.fix]}</StatusBadge>
          <span className="block text-xs text-muted-foreground">{todoText(row.original)}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      meta: { width: 88, title: 'Thao tác' },
      cell: ({ row }) => {
        const o = row.original;
        return (
          <RowActions
            itemName={`đơn ${o.docNumber}`}
            primary={{
              label: 'Xem đơn',
              icon: <Eye aria-hidden />,
              href: `/crm/orders/${o.orderId}`,
            }}
            items={[
              {
                label: 'Sửa đơn',
                icon: <Pencil aria-hidden />,
                href: `/crm/orders/${o.orderId}/edit`,
              },
            ]}
          />
        );
      },
    },
  ];
}

function SplitBulkBar({ rows, onClear }: { rows: WarehouseSplitOrder[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const dismiss = useDismissWarehouseSplits();
  const repairable = rows.filter((r) => r.fix === 'REPAIR');
  return (
    <div className="mb-3">
      <BulkActionBar
        count={rows.length}
        noun="đơn"
        onClear={onClear}
        className="min-h-8 rounded-md border-b-0 py-0"
      >
        <span className="ml-auto" />
        <Button
          variant="outline"
          size="sm"
          loading={dismiss.isPending}
          onClick={() =>
            dismiss.mutate(
              rows.map((r) => r.orderId),
              {
                onSuccess: () => {
                  toast.success(`Đã đánh dấu đã xử lý ${rows.length} đơn`);
                  onClear();
                },
                onError: (err) => toast.error(messageFor(err)),
              },
            )
          }
        >
          Đánh dấu đã xử lý
        </Button>
        <Button size="sm" disabled={repairable.length === 0} onClick={() => setOpen(true)}>
          <Eraser aria-hidden />
          Dọn dòng thừa ({repairable.length})
        </Button>
      </BulkActionBar>
      <RepairDialog rows={repairable} open={open} onOpenChange={setOpen} onDone={onClear} />
    </div>
  );
}

function RepairDialog({
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  rows: WarehouseSplitOrder[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const repair = useRepairWarehouseSplits();
  const [results, setResults] = useState<OrderResultRow[] | null>(null);
  const batch = rows.slice(0, REPAIR_MAX);
  const byId = new Map(rows.map((r) => [r.orderId, r]));

  const close = (o: boolean) => {
    if (repair.isPending) return;
    onOpenChange(o);
    if (!o && results) {
      setResults(null);
      onDone();
    }
  };

  const submit = () =>
    repair.mutate(
      batch.map((r) => r.orderId),
      {
        onSuccess: (r) =>
          setResults(
            r.items.map((i): OrderResultRow => ({
              orderId: i.orderId,
              docNumber: i.docNumber,
              customerName: byId.get(i.orderId)?.customerName,
              group: RESULT[i.result].group,
              status: RESULT[i.result].status,
              reason: i.fix ? FIX_LABEL[i.fix] : RESULT_REASON[i.result],
            })),
          ),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent wide>
        {results ? (
          <>
            <DialogTitle className="sr-only">Kết quả dọn dòng thừa</DialogTitle>
            <OrderResultsPanel
              title={`Đã xử lý ${results.length} đơn`}
              description="Đơn đã dọn: Pancake về đúng danh sách sản phẩm gốc, ERP bỏ dòng giá 0 thừa, kho lấy lại đúng số."
              rows={results}
              hints={{ ok: 'Đã dọn', wait: 'Không dọn tự động', fix: 'Cần kiểm tay' }}
              footer={
                <DialogFooter className="border-t pt-3">
                  <Button variant="outline" onClick={() => close(false)}>
                    Đóng
                  </Button>
                </DialogFooter>
              }
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Dọn dòng thừa {batch.length} đơn?</DialogTitle>
              <DialogDescription>
                Mỗi đơn: gửi lại Pancake danh sách sản phẩm trước lần đổi kho (giữ kho hiện tại),
                đọc lại để xác nhận, rồi ERP bỏ dòng giá 0 thừa và lập lại việc lấy hàng. Đơn
                Pancake đã đổi khác sẽ bị bỏ qua để kiểm tay.
                {rows.length > batch.length
                  ? ` Mỗi lần tối đa ${REPAIR_MAX} đơn — ${rows.length - batch.length} đơn còn lại chọn ở lượt sau.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-80 space-y-1 overflow-y-auto rounded-md border px-3 py-2 text-sm">
              {batch.map((o) => (
                <li key={o.orderId}>
                  <span className="font-mono text-xs font-semibold">{o.docNumber}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · bỏ{' '}
                    {o.extraLines
                      .map((l) => `${l.skuName || l.skuCode} ×${formatQuantity(l.qty)}`)
                      .join(', ')}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" disabled={repair.isPending} onClick={() => close(false)}>
                Đóng
              </Button>
              <Button loading={repair.isPending} disabled={batch.length === 0} onClick={submit}>
                <Eraser aria-hidden />
                Dọn {batch.length} đơn
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
