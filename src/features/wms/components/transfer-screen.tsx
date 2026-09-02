'use client';

import Decimal from 'decimal.js';
import { ArrowRight, Check, Plus, Truck, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EntityPicker } from '@/components/data/form';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useLocationTree, useSkuSearch, type LocationNode } from '../api/use-locations';
import {
  useCancelTransfer,
  useCreateTransfer,
  useDispatchTransfer,
  useReceiveTransfer,
  useTransfer,
  useTransfers,
  type TransferDetail,
  type TransferStage,
} from '../api/use-transfers';
import { isOperationalWarehouse, useWarehouses } from '../api/use-warehouses';

/**
 * Chuyển kho 2 bước (design Transfer, PLAN-gdn-transfer bước 5) — /transfers.
 * Mỗi bước post một chứng từ riêng: dispatch = GDN tại kho đi (tồn kho đi giảm
 * NGAY, hàng vào kho ảo Kho trung chuyển); receive = GRN tại kho đến. Nhận thiếu
 * → bắt buộc lý do, phần thiếu Ở LẠI kho trung chuyển — không tự cân bằng.
 * Phiếu chọn qua ?trf= trên URL (luật 8).
 *
 * Khác design (chưa có ở backend): tab "Chuyển vị trí" (chuyển bin trong một kho
 * — phần còn lại của P2-11), "In phiếu", cột HSD/ĐVT trên dòng (DTO chưa trả),
 * "Vị trí đích (gợi ý)" — vị trí đích do người nhận chọn lúc xác nhận.
 */
const STAGE_LABEL: Record<TransferStage, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nháp', tone: 'draft' },
  IN_TRANSIT: { label: 'Đã xuất · chờ nhận', tone: 'warn' },
  POSTED: { label: 'Đã nhận', tone: 'ok' },
  CANCELLED: { label: 'Hủy', tone: 'err' },
};

const TABS: Array<{ key: '' | TransferStage; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'IN_TRANSIT', label: 'Đang trung chuyển' },
  { key: 'POSTED', label: 'Đã nhận' },
  { key: 'CANCELLED', label: 'Hủy' },
];

/** Duỗi cây vị trí thành options phẳng (chỉ vị trí active). */
function locationOptions(tree: LocationNode[]): Array<{ id: string; code: string }> {
  const out: Array<{ id: string; code: string }> = [];
  const walk = (nodes: LocationNode[]) => {
    for (const n of nodes) {
      if (n.isActive) out.push({ id: n.id, code: n.code });
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

// ── Tạo phiếu ────────────────────────────────────────────────

interface DraftLine {
  skuId: string;
  skuLabel: string;
  fromLocationId: string;
  qty: string;
}
const EMPTY_LINE: DraftLine = { skuId: '', skuLabel: '', fromLocationId: '', qty: '' };

function CreateDialog({ onClose }: { onClose: (id?: string) => void }) {
  const warehouses = useWarehouses();
  const create = useCreateTransfer();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const fromTree = useLocationTree(fromId || null);
  const fromLocations = useMemo(
    () => (fromTree.data ? locationOptions(fromTree.data) : []),
    [fromTree.data],
  );
  const operational = (warehouses.data ?? []).filter(isOperationalWarehouse);

  const patch = (i: number, p: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const ready =
    fromId &&
    toId &&
    fromId !== toId &&
    lines.length > 0 &&
    lines.every((l) => l.skuId && l.fromLocationId && /^\d+(\.\d{1,6})?$/.test(l.qty));

  return (
    <Dialog open onOpenChange={(o) => !create.isPending && !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo phiếu chuyển kho</DialogTitle>
          <DialogDescription>
            Chỉ phần KHẢ DỤNG (tồn − đã giữ cho đơn) chuyển được. Tồn kho đi chỉ giảm khi bấm
            &ldquo;Xuất khỏi kho&rdquo; ở bước sau.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Từ kho</div>
            <Select
              value={fromId}
              onValueChange={(v) => {
                setFromId(v);
                setLines((ls) => ls.map((l) => ({ ...l, fromLocationId: '' })));
              }}
            >
              <SelectTrigger aria-label="Từ kho">
                <SelectValue placeholder="Kho đi" />
              </SelectTrigger>
              <SelectContent>
                {operational.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Đến kho</div>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger aria-label="Đến kho">
                <SelectValue placeholder="Kho đến" />
              </SelectTrigger>
              <SelectContent>
                {operational
                  .filter((w) => w.id !== fromId)
                  .map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_10rem_6rem_2rem] items-center gap-2">
              <EntityPicker
                value={l.skuId}
                onChange={(id, option) => patch(i, { skuId: id, skuLabel: option?.label ?? '' })}
                useSearch={useSkuSearch}
                selectedLabel={l.skuLabel || undefined}
                placeholder="Tìm SKU…"
                searchPlaceholder="Mã / tên SKU / barcode…"
                clearable={false}
              />
              <Select
                value={l.fromLocationId}
                onValueChange={(v) => patch(i, { fromLocationId: v })}
                disabled={!fromId}
              >
                <SelectTrigger aria-label={`Vị trí nguồn dòng ${i + 1}`}>
                  <SelectValue placeholder="Vị trí nguồn" />
                </SelectTrigger>
                <SelectContent>
                  {fromLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                placeholder="SL"
                aria-label={`Số lượng dòng ${i + 1}`}
                value={l.qty}
                onChange={(e) => patch(i, { qty: e.target.value })}
              />
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Xóa dòng ${i + 1}`}
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                >
                  <X aria-hidden />
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setLines((ls) => [...ls, { ...EMPTY_LINE }])}
          >
            <Plus aria-hidden />
            Thêm dòng
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={() => onClose()}>
            Hủy bỏ
          </Button>
          <Button
            disabled={!ready || create.isPending}
            onClick={() =>
              create
                .mutateAsync({
                  fromWarehouseId: fromId,
                  toWarehouseId: toId,
                  lines: lines.map((l) => ({
                    skuId: l.skuId,
                    fromLocationId: l.fromLocationId,
                    qty: l.qty,
                  })),
                })
                .then((r) => {
                  toast.success(`Đã tạo phiếu ${r.docNumber}`);
                  onClose(r.transferId);
                })
                .catch((err) => toast.error(messageFor(err)))
            }
          >
            {create.isPending ? 'Đang tạo…' : 'Tạo phiếu chuyển'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Chi tiết + hai bước ──────────────────────────────────────

function StepStrip({ transfer }: { transfer: TransferDetail }) {
  const step1Done = transfer.stage !== 'DRAFT' && transfer.stage !== 'CANCELLED';
  const step2Done = transfer.stage === 'POSTED';
  const StepIcon = ({ done, n }: { done: boolean; n: number }) => (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        done ? 'bg-success text-white' : 'border-2 border-primary text-primary',
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
    </span>
  );
  return (
    <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <StepIcon done={step1Done} n={1} />
        <div className="text-sm">
          <div className="font-semibold">
            Bước 1 ·{' '}
            {step1Done
              ? `Đã xuất khỏi ${transfer.fromWarehouseName}`
              : `Xuất khỏi ${transfer.fromWarehouseName}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {step1Done
              ? `${transfer.dispatchedAt ? formatDateTime(transfer.dispatchedAt) : ''}${transfer.dispatchedByName ? ` · ${transfer.dispatchedByName}` : ''}${transfer.issueDocNumber ? ` · ${transfer.issueDocNumber} đã post` : ''}`
              : 'Tồn kho đi giảm ngay khi xuất — hàng vào kho trung chuyển'}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <StepIcon done={step2Done} n={2} />
        <div className="text-sm">
          <div className="font-semibold">
            Bước 2 ·{' '}
            {step2Done
              ? `Đã nhận tại ${transfer.toWarehouseName}`
              : `Chờ nhận tại ${transfer.toWarehouseName}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {step2Done
              ? `${transfer.postedAt ? formatDateTime(transfer.postedAt) : ''}${transfer.postedByName ? ` · ${transfer.postedByName}` : ''}${transfer.receiptDocNumber ? ` · ${transfer.receiptDocNumber} đã post` : ''}`
              : 'Người nhận kiểm đủ rồi xác nhận — GRN post lúc đó'}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReceiveDraft {
  qtyReceived: string;
  toLocationId: string;
  note: string;
}

function DetailPanel({ transferId, onClosed }: { transferId: string; onClosed: () => void }) {
  const query = useTransfer(transferId);
  const dispatch = useDispatchTransfer();
  const receive = useReceiveTransfer();
  const cancel = useCancelTransfer();
  const ability = useAbility();
  const canTransfer = ability.can('transfer', 'Stock');
  const canReceive = ability.can('receive', 'Stock');
  const [draft, setDraft] = useState<Record<string, ReceiveDraft>>({});

  const transfer = query.data;
  const destTree = useLocationTree(
    transfer && transfer.stage === 'IN_TRANSIT' ? transfer.toWarehouseId : null,
  );
  const destLocations = useMemo(
    () => (destTree.data ? locationOptions(destTree.data) : []),
    [destTree.data],
  );

  const draftOf = (lineId: string, shipped: string): ReceiveDraft =>
    draft[lineId] ?? { qtyReceived: shipped, toLocationId: '', note: '' };
  const patchDraft = (lineId: string, shipped: string, p: Partial<ReceiveDraft>) =>
    setDraft((d) => ({ ...d, [lineId]: { ...draftOf(lineId, shipped), ...p } }));

  const confirmReceive = (t: TransferDetail) => {
    receive
      .mutateAsync({
        id: t.id,
        body: {
          lines: t.lines.map((l) => {
            const d = draftOf(l.id, l.qtyShipped);
            return {
              lineId: l.id,
              qtyReceived: d.qtyReceived,
              ...(d.toLocationId ? { toLocationId: d.toLocationId } : {}),
              ...(d.note.trim() ? { discrepancyNote: d.note.trim() } : {}),
            };
          }),
        },
      })
      .then((r) =>
        toast.success(
          `Đã nhận tại ${t.toWarehouseName}${r.legDocNumber ? ` — ${r.legDocNumber}` : ''}`,
        ),
      )
      .catch((err) => toast.error(messageFor(err)));
  };

  return (
    <QueryState query={query} skeleton={<ListSkeleton rows={4} columns={6} />}>
      {(t: TransferDetail) => {
        const receiving = t.stage === 'IN_TRANSIT' && canReceive;
        return (
          <section className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-sm font-semibold">{t.docNumber}</h2>
              <StatusBadge tone={STAGE_LABEL[t.stage].tone}>
                {STAGE_LABEL[t.stage].label}
              </StatusBadge>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {t.fromWarehouseName} <ArrowRight className="h-3.5 w-3.5" aria-hidden />{' '}
                {t.toWarehouseName}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {t.stage === 'DRAFT' && canTransfer ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancel.isPending || dispatch.isPending}
                      onClick={() =>
                        cancel
                          .mutateAsync(t.id)
                          .then(() => {
                            toast.success(`Đã hủy phiếu ${t.docNumber}`);
                            onClosed();
                          })
                          .catch((err) => toast.error(messageFor(err)))
                      }
                    >
                      Hủy phiếu
                    </Button>
                    <Button
                      size="sm"
                      disabled={dispatch.isPending || cancel.isPending}
                      onClick={() =>
                        dispatch
                          .mutateAsync(t.id)
                          .then((r) =>
                            toast.success(
                              `Đã xuất khỏi ${t.fromWarehouseName}${r.legDocNumber ? ` — ${r.legDocNumber}` : ''}`,
                            ),
                          )
                          .catch((err) => toast.error(messageFor(err)))
                      }
                    >
                      {dispatch.isPending ? 'Đang xuất…' : `Xuất khỏi ${t.fromWarehouseName}`}
                    </Button>
                  </>
                ) : null}
                {receiving ? (
                  <Button size="sm" disabled={receive.isPending} onClick={() => confirmReceive(t)}>
                    {receive.isPending ? 'Đang nhận…' : `Xác nhận đã nhận tại ${t.toWarehouseName}`}
                  </Button>
                ) : null}
              </div>
            </div>

            <StepStrip transfer={t} />

            {t.stage === 'IN_TRANSIT' ? (
              <p className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <b>Hàng đang trung chuyển.</b> Tồn thực {t.fromWarehouseName} đã trừ lúc xuất;{' '}
                  {t.toWarehouseName} chỉ cộng khi xác nhận nhận. Trong lúc đó tồn nằm ở kho ảo{' '}
                  <b>Kho trung chuyển</b> — tổng tồn toàn hệ thống không đổi. Nhận thiếu → dòng
                  chênh lệch bắt buộc lý do, phần thiếu nằm lại kho trung chuyển, không tự cân bằng.
                </span>
              </p>
            ) : null}

            <div className="overflow-hidden rounded-md border bg-card">
              <header className="border-b px-3 py-2 text-sm font-semibold">
                Dòng chuyển · {t.lineCount} dòng · xuất {formatQuantity(t.totalQtyShipped)} đơn vị
                cơ bản
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                      <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                      <TableHead className="w-24 px-2.5 text-xs">Lô</TableHead>
                      <TableHead className="w-28 px-2.5 text-xs">Vị trí nguồn</TableHead>
                      <TableHead className="w-24 px-2.5 text-right text-xs">SL xuất</TableHead>
                      <TableHead className="w-28 px-2.5 text-right text-xs">SL nhận</TableHead>
                      <TableHead className="w-32 px-2.5 text-xs">Vị trí đích</TableHead>
                      <TableHead className="w-24 px-2.5 text-right text-xs">Chênh lệch</TableHead>
                      <TableHead className="px-2.5 text-xs">Lý do lệch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.lines.map((l) => {
                      const d = draftOf(l.id, l.qtyShipped);
                      const draftShort =
                        receiving &&
                        /^\d+(\.\d{1,6})?$/.test(d.qtyReceived) &&
                        new Decimal(d.qtyReceived).lt(l.qtyShipped);
                      const finalShort =
                        l.discrepancy !== null && !new Decimal(l.discrepancy).isZero();
                      return (
                        <TableRow
                          key={l.id}
                          className={draftShort || finalShort ? 'bg-warning/5' : undefined}
                        >
                          <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                            {l.lineNo}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5">
                            <div className="font-semibold">{l.skuName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {l.skuCode}
                            </div>
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                            {l.lotNumber ?? '—'}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                            {l.fromLocationCode}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                            {formatQuantity(l.qtyShipped)}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5 text-right">
                            {receiving ? (
                              <Input
                                inputMode="decimal"
                                value={d.qtyReceived}
                                onChange={(e) =>
                                  patchDraft(l.id, l.qtyShipped, { qtyReceived: e.target.value })
                                }
                                aria-label={`SL nhận dòng ${l.lineNo}`}
                                className="h-8 w-24 text-right tabular-nums"
                              />
                            ) : (
                              <span className="tabular-nums font-semibold">
                                {l.qtyReceived === null ? '—' : formatQuantity(l.qtyReceived)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5">
                            {receiving ? (
                              <Select
                                value={d.toLocationId}
                                onValueChange={(v) =>
                                  patchDraft(l.id, l.qtyShipped, { toLocationId: v })
                                }
                              >
                                <SelectTrigger
                                  className="h-8"
                                  aria-label={`Vị trí đích dòng ${l.lineNo}`}
                                >
                                  <SelectValue placeholder="Chọn vị trí" />
                                </SelectTrigger>
                                <SelectContent>
                                  {destLocations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      {loc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="font-mono text-xs">{l.toLocationCode ?? '—'}</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'px-2.5 py-1.5 text-right tabular-nums font-semibold',
                              finalShort && 'text-destructive',
                            )}
                          >
                            {l.discrepancy === null
                              ? '—'
                              : new Decimal(l.discrepancy).isZero()
                                ? '0'
                                : formatQuantity(l.discrepancy)}
                          </TableCell>
                          <TableCell className="px-2.5 py-1.5">
                            {receiving ? (
                              <Input
                                value={d.note}
                                onChange={(e) =>
                                  patchDraft(l.id, l.qtyShipped, { note: e.target.value })
                                }
                                placeholder={
                                  draftShort ? 'Bắt buộc khi nhận thiếu' : 'Lý do (nếu lệch)'
                                }
                                aria-label={`Lý do dòng ${l.lineNo}`}
                                className="h-8 w-52"
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {l.discrepancyNote ?? '—'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <footer className="border-t px-3 py-2 text-xs text-muted-foreground">
                Phiếu 2 bước: mỗi bước post một chứng từ riêng (GDN tại kho đi, GRN tại kho đến) —
                không có &ldquo;sửa nhanh&rdquo; tồn hai kho cùng lúc.
              </footer>
            </div>
          </section>
        );
      }}
    </QueryState>
  );
}

// ── Danh sách ────────────────────────────────────────────────

export function TransferScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selectedId = search.get('trf');
  const stageFilter = (search.get('stage') ?? '') as '' | TransferStage;
  const [creating, setCreating] = useState(false);
  const ability = useAbility();
  const canTransfer = ability.can('transfer', 'Stock');

  const query = useTransfers({
    take: 50,
    skip: 0,
    ...(stageFilter ? { stage: stageFilter } : {}),
  });
  const counts = query.data?.stageCounts;

  const setParam = (key: string, value?: string) => {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Chuyển kho"
        description="Hai bước: xuất khỏi kho đi → nhận tại kho đến; giữa hai bước tồn nằm ở kho trung chuyển ảo"
        breadcrumb={[{ label: 'Kho' }, { label: 'Chuyển kho' }]}
        actions={
          canTransfer ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Tạo phiếu chuyển
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex border-b" role="tablist">
        {TABS.map((t) => {
          const active = stageFilter === t.key;
          const count =
            counts === undefined
              ? undefined
              : t.key === ''
                ? counts.DRAFT + counts.IN_TRANSIT + counts.POSTED + counts.CANCELLED
                : counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParam('stage', t.key || undefined)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {count !== undefined ? (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={5} columns={7} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có phiếu chuyển kho nào theo bộ lọc"
            description="Tạo phiếu để chuyển hàng giữa hai kho — hai bước, mỗi bước một chứng từ."
            action={
              canTransfer ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  Tạo phiếu chuyển
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-40 px-2.5 text-xs">Số phiếu</TableHead>
                    <TableHead className="px-2.5 text-xs">Tuyến</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Số dòng</TableHead>
                    <TableHead className="w-28 px-2.5 text-right text-xs">SL xuất</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Dòng lệch</TableHead>
                    <TableHead className="w-40 px-2.5 text-xs">Trạng thái</TableHead>
                    <TableHead className="w-40 px-2.5 text-xs">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      data-state={r.id === selectedId ? 'selected' : undefined}
                      onClick={() => setParam('trf', r.id === selectedId ? undefined : r.id)}
                    >
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold text-primary">
                        {r.docNumber}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <span className="flex items-center gap-1">
                          {r.fromWarehouseName}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {r.toWarehouseName}
                        </span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {r.lineCount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatQuantity(r.totalQtyShipped)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'px-2.5 py-1.5 text-right tabular-nums',
                          r.discrepancyLineCount > 0 && 'font-semibold text-destructive',
                        )}
                      >
                        {r.discrepancyLineCount || '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone={STAGE_LABEL[r.stage].tone}>
                          {STAGE_LABEL[r.stage].label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </QueryState>

      {selectedId ? (
        <DetailPanel transferId={selectedId} onClosed={() => setParam('trf', undefined)} />
      ) : null}

      {creating ? (
        <CreateDialog
          onClose={(id) => {
            setCreating(false);
            if (id) setParam('trf', id);
          }}
        />
      ) : null}
    </>
  );
}
