'use client';

import Link from 'next/link';
import { Eye, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
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
import { messageFor, messageForItemCode } from '@/lib/error-messages';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useWarehouses } from '@/features/wms/api/use-warehouses';
import {
  useDismissPancakeOverwrites,
  usePancakeOverwrites,
  useRestorePancakeOverwrites,
  useScanPancakeOverwrites,
  type PancakeOverwriteChange,
  type PancakeOverwriteFix,
  type PancakeOverwriteOrder,
} from '../api/use-orders';
import { orderStatusLabel } from '../labels';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';

/**
 * Tab "Bị Pancake ghi đè" của màn Xử lý đơn lỗi (2026-11-02, chỉ superadmin — mockup
 * EX7o4M2BE7649vfbsx6LPz#overwrite): đơn NV sửa trên ERP rồi webhook Pancake đè lại. Khôi phục bản
 * ERP = Sửa đơn với SL / đơn giá NV đặt (server, từng đơn); hủy đơn bị bỏ → mở đơn để hủy lại.
 */

type OrderStatus = Parameters<typeof orderStatusLabel>[0];

const FIX_LABEL: Record<PancakeOverwriteFix, string> = {
  RESTORE_LINES: 'Khôi phục được',
  CANCEL_AGAIN: 'Cần hủy lại',
  LOCKED: 'Kho đã lấy hàng',
  MANUAL: 'Sửa tay',
};
const FIX_TONE: Record<PancakeOverwriteFix, StatusTone> = {
  RESTORE_LINES: 'warn',
  CANCEL_AGAIN: 'err',
  LOCKED: 'neutral',
  MANUAL: 'neutral',
};

/** Lý do không khôi phục tự động (mã server → câu, luật 6). */
const SKIP_TEXT: Record<string, string> = {
  NOTHING_TO_RESTORE:
    'Không còn dòng hàng nào cần khôi phục — sửa tay ở Sửa đơn nếu tổng tiền vẫn lệch.',
  ORDER_CANCELLED: 'Đơn đã hủy.',
  NEEDS_CANCEL: 'Nhân viên đã hủy đơn mà Pancake đưa về — mở đơn để hủy lại.',
  HAS_COMBO: 'Đơn có combo — sửa tay ở Sửa đơn.',
  HAS_CUSTOM_ITEMS: 'Đơn có món gõ tay Pancake — sửa tay ở Sửa đơn.',
  DUPLICATE_SKU: 'Đơn có nhiều dòng cùng sản phẩm — sửa tay ở Sửa đơn.',
  SKU_NOT_FOUND: 'Sản phẩm nhân viên thêm không còn trên ERP — sửa tay ở Sửa đơn.',
};

const MONEY_FIELDS = new Set([
  'total',
  'manualDiscount',
  'shippingFee',
  'surcharge',
  'prepaidAmount',
]);
const FIELD_LABEL: Record<string, string> = {
  total: 'Tổng tiền',
  status: 'Trạng thái',
  manualDiscount: 'Giảm giá tay',
  shippingFee: 'Phí ship',
  surcharge: 'Phụ thu',
  prepaidAmount: 'Đã trả trước',
  recipientPhone: 'SĐT người nhận',
  warehouseId: 'Kho',
  addressId: 'Địa chỉ giao',
  internalNote: 'Ghi chú nội bộ',
  printNote: 'Ghi chú in',
};

function fieldValue(key: string, v: string | null): string {
  if (v === null) return '—';
  if (MONEY_FIELDS.has(key)) return formatMoney(v, { unit: '' });
  if (key === 'status') return orderStatusLabel(v as OrderStatus) ?? v;
  return 'giá trị khác';
}

/** Một dòng "NV đặt → Pancake đè" cho bảng / hộp thoại. */
export function changeText(c: PancakeOverwriteChange): { set: string; pancake: string } {
  if (c.kind === 'FIELD') {
    return {
      set: `${FIELD_LABEL[c.key] ?? c.key}: ${fieldValue(c.key, c.setValue)}`,
      pancake: fieldValue(c.key, c.pancakeValue),
    };
  }
  const qty = (v: string | null) => (v === null ? '0' : formatQuantity(v));
  if (c.action === 'Thêm') {
    return { set: `Thêm ${c.key} ×${qty(c.qtySet)}`, pancake: `×${qty(c.pcQty)} trên Pancake` };
  }
  if (c.action === 'Bỏ') return { set: `Bỏ ${c.key}`, pancake: `còn ×${qty(c.pcQty)}` };
  return {
    set: `${c.key} ×${qty(c.qtySet)}: ${c.amountSet ? formatMoney(c.amountSet, { unit: '' }) : '—'}`,
    pancake: `×${qty(c.pcQty)} · ${c.pcAmount ? formatMoney(c.pcAmount, { unit: '' }) : '—'}`,
  };
}

function summary(o: PancakeOverwriteOrder): string {
  const lines = o.changes.filter((c) => c.kind === 'LINE');
  if (o.fix === 'CANCEL_AGAIN') return 'Hủy đơn bị bỏ';
  if (lines.some((c) => c.action === 'Thêm')) return 'Mất sản phẩm thêm';
  if (lines.length > 0) return `Giá / SL ${lines.length} dòng`;
  return 'Tổng tiền';
}

export function PancakeOverwriteTab({
  fix,
  page,
  size,
  onFixChange,
  onPageChange,
  onSizeChange,
}: {
  fix: PancakeOverwriteFix | undefined;
  page: number;
  size: number;
  onFixChange: (fix: PancakeOverwriteFix | undefined) => void;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}) {
  const query = usePancakeOverwrites({ fix, take: size, skip: (page - 1) * size });
  const scan = useScanPancakeOverwrites();
  const warehouses = useWarehouses();
  const whName = useMemo(() => {
    const m = new Map((warehouses.data ?? []).map((w) => [w.id, w.name]));
    return (id: string | null) => (id ? (m.get(id) ?? '—') : '—');
  }, [warehouses.data]);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const clear = useCallback(() => setSelected({}), []);
  const rows = (query.data?.items ?? []).filter((r) => selected[r.orderId]);
  const columns = useMemo(() => buildColumns(whName), [whName]);

  return (
    <>
      {rows.length > 0 ? (
        <OverwriteBulkBar rows={rows} onClear={clear} />
      ) : (
        <FilterBar
          q=""
          onQChange={() => undefined}
          filters={[
            {
              key: 'fix',
              label: 'Xử lý',
              type: 'select',
              options: (Object.keys(FIX_LABEL) as PancakeOverwriteFix[]).map((k) => ({
                value: k,
                label: FIX_LABEL[k],
              })),
            },
          ]}
          values={{ fix }}
          onFilterChange={(p) =>
            onFixChange((p.fix as PancakeOverwriteFix | undefined) || undefined)
          }
          searchPlaceholder="Lọc theo cách xử lý"
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
                    onSuccess: () => toast.success('Đã quét lại đơn bị Pancake ghi đè'),
                    onError: (err) => toast.error(messageFor(err)),
                  })
                }
              >
                <RefreshCw aria-hidden />
                Quét lại ngay
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
            title={fix ? 'Không có đơn nào khớp' : 'Không còn đơn bị Pancake ghi đè'}
            description={
              fix
                ? 'Thử bỏ lọc cách xử lý.'
                : 'Lần quét gần nhất không thấy đơn nào còn mang giá trị Pancake ghi đè.'
            }
            action={
              fix ? (
                <Button variant="outline" onClick={() => onFixChange(undefined)}>
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
): ColumnDef<PancakeOverwriteOrder, unknown>[] {
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
            {row.original.customerName}
          </span>
        </div>
      ),
    },
    {
      id: 'warehouse',
      header: 'Kho',
      meta: { width: 130 },
      cell: ({ row }) => whName(row.original.warehouseId),
    },
    {
      id: 'editor',
      header: 'Người sửa',
      meta: { width: 150 },
      cell: ({ row }) =>
        [...new Set(row.original.changes.map((c) => c.editorName ?? '—'))].join(', '),
    },
    {
      id: 'kind',
      header: 'Bị đè',
      meta: { width: 170 },
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={row.original.fix === 'CANCEL_AGAIN' ? 'err' : 'warn'}>
            {summary(row.original)}
          </StatusBadge>
          <StatusBadge tone={FIX_TONE[row.original.fix]}>{FIX_LABEL[row.original.fix]}</StatusBadge>
        </div>
      ),
    },
    {
      id: 'changes',
      header: 'NV đặt → Pancake đè',
      meta: { width: 360 },
      cell: ({ row }) => (
        <ul className="space-y-0.5 whitespace-normal">
          {row.original.changes.map((c, i) => {
            const t = changeText(c);
            return (
              <li key={i}>
                {t.set} → <span className="font-semibold text-destructive">{t.pancake}</span>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      id: 'at',
      header: 'Lúc bị đè',
      meta: { width: 130 },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.original.lastOverwrittenAt)}
          <span className="block text-xs">
            {orderStatusLabel(row.original.status as OrderStatus) ?? row.original.status}
          </span>
        </span>
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
              label: o.fix === 'CANCEL_AGAIN' ? 'Mở đơn để hủy lại' : 'Xem đơn',
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

function OverwriteBulkBar({
  rows,
  onClear,
}: {
  rows: PancakeOverwriteOrder[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dismiss = useDismissPancakeOverwrites();
  const restorable = rows.filter((r) => r.fix === 'RESTORE_LINES');
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
        <Button size="sm" disabled={restorable.length === 0} onClick={() => setOpen(true)}>
          <RotateCcw aria-hidden />
          Khôi phục bản ERP ({restorable.length})
        </Button>
      </BulkActionBar>
      <RestoreDialog rows={rows} open={open} onOpenChange={setOpen} onDone={onClear} />
    </div>
  );
}

function RestoreDialog({
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  rows: PancakeOverwriteOrder[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const restore = useRestorePancakeOverwrites();
  const [results, setResults] = useState<OrderResultRow[] | null>(null);
  const ready = rows.filter((r) => r.fix === 'RESTORE_LINES');
  const skipped = rows.length - ready.length;
  const byId = new Map(rows.map((r) => [r.orderId, r]));

  const close = (o: boolean) => {
    if (restore.isPending) return;
    onOpenChange(o);
    if (!o && results) {
      setResults(null);
      onDone();
    }
  };

  const submit = () =>
    restore.mutate(
      ready.map((r) => r.orderId),
      {
        onSuccess: (r) =>
          setResults([
            ...r.failed.map((f): OrderResultRow => ({
              orderId: f.orderId,
              docNumber: f.docNumber,
              customerName: byId.get(f.orderId)?.customerName,
              group: 'fix',
              status: 'Không khôi phục được',
              reason: messageForItemCode(f.code),
            })),
            ...r.skipped.map((s): OrderResultRow => ({
              orderId: s.orderId,
              docNumber: s.docNumber,
              customerName: byId.get(s.orderId)?.customerName,
              group: 'wait',
              status: 'Bỏ qua',
              reason: SKIP_TEXT[s.code] ?? s.code,
            })),
            ...r.restored.map((d): OrderResultRow => ({
              orderId: d.orderId,
              docNumber: d.docNumber,
              customerName: byId.get(d.orderId)?.customerName,
              group: 'ok',
              status: 'Đã khôi phục',
            })),
          ]),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent wide>
        {results ? (
          <>
            <DialogTitle className="sr-only">Kết quả khôi phục bản ERP</DialogTitle>
            <OrderResultsPanel
              title={`Đã xử lý ${results.length} đơn`}
              description="Đơn đã khôi phục: dòng hàng + tổng tiền về giá trị nhân viên đặt, đã đẩy lên Pancake."
              rows={results}
              hints={{
                ok: 'Đã khôi phục',
                wait: 'Bỏ qua — sửa tay',
                fix: 'Không khôi phục được',
              }}
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
              <DialogTitle>Khôi phục {ready.length} đơn về giá trị nhân viên đã sửa?</DialogTitle>
              <DialogDescription>
                Đặt lại dòng hàng theo lịch sử sửa đơn rồi đẩy lên Pancake (như bấm Lưu ở Sửa đơn).
                Tổng tiền, COD, giữ chỗ tính lại theo dòng hàng.
                {skipped > 0 ? ` ${skipped} đơn không khôi phục tự động được sẽ bị bỏ qua.` : ''}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border px-3 py-2 text-sm">
              {ready.map((o) => (
                <li key={o.orderId}>
                  <span className="font-mono text-xs font-semibold">{o.docNumber}</span>
                  <span className="text-muted-foreground"> · {o.customerName}</span>
                  <ul className="text-muted-foreground">
                    {o.changes
                      .filter((c) => c.kind === 'LINE')
                      .map((c, i) => (
                        <li key={i}>{changeText(c).set}</li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" disabled={restore.isPending} onClick={() => close(false)}>
                Đóng
              </Button>
              <Button loading={restore.isPending} disabled={ready.length === 0} onClick={submit}>
                <RotateCcw aria-hidden />
                Khôi phục {ready.length} đơn
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
