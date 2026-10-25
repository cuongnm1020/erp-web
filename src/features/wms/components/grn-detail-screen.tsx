'use client';

import Decimal from 'decimal.js';
import { AlertCircle, Box, Coins, CopyPlus, Lock, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoneyInput } from '@/components/data/form';
import { DetailSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
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
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { usePrint } from '@/lib/print';
import { LpnPrintSheet, type LpnLabelData } from './lpn-label';
import { GRN_STAGE } from './grn-stage';
import { GrnWaitingMatch } from './grn-waiting-match';
import {
  useCancelReceipt,
  usePostReceipt,
  useReceipt,
  useReceiptMovements,
  useSetReceiptCosts,
  type ReceiptDetail,
} from '../api/use-receipts';

/**
 * Chi tiết phiếu nhập (design GrnDetailPosted) — GET /goods-receipts/:id.
 * Phiếu NHÁP: post / hủy tại đây. Phiếu ĐÃ POST là bất biến (bất biến 5) — mọi
 * trường chỉ đọc + bảng "Chuyển động tồn đã ghi" từ GET :id/movements.
 *
 * 2026-10-20 (docs/screens/FE-GRN-2-grn-stage-cost.md) — tiến độ `stage` (Mới tạo → Đang cất hàng
 * → Chờ nhập giá → Hoàn thành) thay badge DocStatus; kho nhập không cần giá. Đơn giá / Thành tiền /
 * Tổng giá trị CHỈ hiện cho người có `stock.cost` (kế toán); người đó bấm "Nhập giá nhập" → ô giá
 * theo ĐVT đã nhập của dòng → "Lưu giá" gọi POST :id/costs (phiếu cất xong + đủ giá → Hoàn
 * thành). Phiếu "Chờ nhập giá" mở sẵn chế độ nhập.
 *
 * Khác design: chưa có "Tạo phiếu điều chỉnh" (chưa có chứng từ điều chỉnh) và
 * "In phiếu"; hủy phiếu đã post bị 409 đúng nghĩa — không có đường xóa ledger.
 */
const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: '+ Nhập',
  PUT_AWAY: 'Cất hàng',
};

/** Cùng regex với moneySchema (Decimal(18,4), không âm). */
const MONEY_RE = /^\d{1,14}(\.\d{1,4})?$/;

type Line = ReceiptDetail['lines'][number];

/** Hệ số ĐVT đã nhập của dòng → giá hiển thị / nhập theo ĐVT đó (giá lưu là mỗi ĐVT cơ sở). */
function factorOf(l: Line): Decimal {
  return l.uomCode && l.factor ? new Decimal(l.factor) : new Decimal(1);
}

/** Giá theo ĐVT đã nhập của dòng (giá mỗi ĐVT cơ sở × factor), chuỗi để điền sẵn ô nhập. */
function enteredCostOf(l: Line): string {
  if (!l.unitCost) return '';
  return new Decimal(l.unitCost).mul(factorOf(l)).toDecimalPlaces(4).toString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Movements({ id }: { id: string }) {
  const query = useReceiptMovements(id, true);
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <header className="border-b px-3 py-2 text-sm font-semibold">
        Chuyển động tồn đã ghi (sổ cái · chỉ đọc · append-only)
      </header>
      <QueryState
        query={query}
        skeleton={<div className="p-3 text-sm text-muted-foreground">Đang tải sổ cái…</div>}
        isEmpty={(d) => d.length === 0}
        empty={<p className="p-3 text-sm text-muted-foreground">Chưa có movement nào.</p>}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Thời gian</TableHead>
                  <TableHead className="px-2.5 text-xs">Loại</TableHead>
                  <TableHead className="px-2.5 text-xs">SKU</TableHead>
                  <TableHead className="px-2.5 text-xs">Lô</TableHead>
                  <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
                  <TableHead className="px-2.5 text-xs">Thùng</TableHead>
                  <TableHead className="px-2.5 text-right text-xs">+/− SL</TableHead>
                  <TableHead className="px-2.5 text-xs">Người thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {formatDateTime(m.createdAt, { seconds: true })}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={m.qtyDelta.startsWith('-') ? 'warn' : 'ok'}>
                        {MOVEMENT_LABEL[m.movementType] ?? m.movementType}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.skuCode}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.lotNumber ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.locationCode}
                    </TableCell>
                    {/* Dòng đóng gói: mỗi thùng một movement — mã LPN để phân biệt các dòng cùng SL. */}
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {m.containerBarcode ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {m.qtyDelta.startsWith('-') ? '' : '+'}
                      {formatQuantity(m.qtyDelta)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {m.actorName ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </section>
  );
}

/** Tem LPN của một dòng đóng gói: thùng con trước, pallet bọc ngoài cuối (dán sau cùng). */
function labelsOf(line: Line): LpnLabelData[] {
  const p = line.packaging;
  if (!p) return [];
  const per = `${formatQuantity(p.qtyPerContainer)} ${line.baseUomCode}`;
  const out: LpnLabelData[] = p.containers.map((c) => ({
    barcode: c.barcode,
    typeCode: p.containerType,
    line1: `${line.skuCode} × ${per}`,
    line2: line.skuName,
  }));
  if (p.wrapper) {
    out.push({
      barcode: p.wrapper.barcode,
      typeCode: 'PALLET',
      line1: `${p.count} ${p.containerType} · ${line.skuCode}`,
      line2: `${formatQuantity(line.qtyBase)} ${line.baseUomCode} · ${line.skuName}`,
    });
  }
  return out;
}

/** Dải thông báo đầu trang theo tiến độ — nói chuyện gì đã xong và việc gì còn chờ. */
function StageBanner({ receipt }: { receipt: ReceiptDetail }) {
  if (receipt.status !== 'POSTED') return null;
  const posted = (
    <b>
      Đã post{receipt.postedAt ? ` lúc ${formatDateTime(receipt.postedAt)}` : ''}
      {receipt.postedByName ? ` bởi ${receipt.postedByName}` : ''}.
    </b>
  );
  if (receipt.stage === 'AWAITING_COST') {
    return (
      <p className="flex items-center gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        <span>
          <b>
            Hàng đã lên kệ, bán được
            {receipt.putAwayDoneAt ? ` từ ${formatDateTime(receipt.putAwayDoneAt)}` : ''}.
          </b>{' '}
          Còn {formatQuantity(String(receipt.uncostedLineCount))} dòng chưa có đơn giá — kế toán
          nhập giá để hoàn thành phiếu.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-md border border-success-line bg-success-weak px-3 py-2 text-sm">
      <Lock className="h-3.5 w-3.5" aria-hidden />
      <span>
        {posted}
        {receipt.stage === 'PUTTING_AWAY'
          ? ' Tồn đã vào vị trí nhận, kho đang cất hàng lên kệ.'
          : receipt.putAwayDoneAt
            ? ` Cất hàng xong ${formatDateTime(receipt.putAwayDoneAt)}.`
            : ''}
        {receipt.costedAt
          ? ` Giá nhập do ${receipt.costedByName ?? '—'} nhập ${formatDateTime(receipt.costedAt)}.`
          : ''}{' '}
        Chứng từ bất biến — mọi trường chỉ đọc. Sai sót → tạo phiếu điều chỉnh (chưa có trên web).
      </span>
    </p>
  );
}

interface CostEntry {
  editing: boolean;
  drafts: Record<string, string>;
  setDraft: (lineId: string, value: string) => void;
  errors: Record<string, string>;
}

function DetailBody({
  receipt,
  canCost,
  cost,
}: {
  receipt: ReceiptDetail;
  canCost: boolean;
  cost: CostEntry;
}) {
  const printer = usePrint();
  const [labels, setLabels] = useState<LpnLabelData[]>([]);
  const printLine = (line: Line) => {
    setLabels(labelsOf(line));
    printer.print();
  };
  const packed = receipt.lines.filter((l) => l.packaging);
  const editing = canCost && cost.editing;

  /** Thành tiền theo ô đang nhập (hiển thị tức thì) hoặc theo giá đã lưu. */
  const lineValue = (l: Line): string | null => {
    if (editing) {
      const v = cost.drafts[l.id] ?? '';
      if (!MONEY_RE.test(v)) return null;
      return new Decimal(l.qtyBase).div(factorOf(l)).times(v).toFixed(4);
    }
    return l.lineValue;
  };
  const total = editing
    ? receipt.lines
        .reduce((acc, l) => {
          const v = lineValue(l);
          return v ? acc.plus(v) : acc;
        }, new Decimal(0))
        .toFixed(4)
    : // null = API che tiền với người không có stock.cost (khối này chỉ hiện khi canCost).
      (receipt.totalValue ?? '0');

  return (
    <div className="flex flex-col gap-3">
      {labels.length ? <LpnPrintSheet labels={labels} printer={printer} /> : null}
      <StageBanner receipt={receipt} />

      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-4">
        <Field label="Số phiếu">
          <span className="font-mono">{receipt.docNumber}</span>
        </Field>
        <Field label="Kho nhận">{receipt.warehouseName}</Field>
        <Field label="Nhà cung cấp">{receipt.supplierName ?? '— (nhập tự do)'}</Field>
        <Field label="Tham chiếu PO">
          {receipt.poNumber ? <span className="font-mono">{receipt.poNumber}</span> : '—'}
        </Field>
        <Field label="Ngày nhập">{formatDate(receipt.receivedAt)}</Field>
        <Field label="Người tạo">{receipt.createdByName ?? '—'}</Field>
        <Field label="Cất hàng">
          {receipt.putAwayDoneAt
            ? `Xong ${formatDateTime(receipt.putAwayDoneAt)}`
            : receipt.status === 'POSTED'
              ? 'Đang cất'
              : '—'}
        </Field>
        {/* Tiền chỉ cho người có stock.cost — kho không thấy giá nhập. */}
        {canCost ? (
          <>
            <Field label="Tổng giá trị">
              <b className="tabular-nums">{formatMoney(total)}</b>
            </Field>
            <Field label="Giá nhập">
              {receipt.costedAt
                ? `${receipt.costedByName ?? '—'} · ${formatDateTime(receipt.costedAt)}`
                : receipt.uncostedLineCount > 0
                  ? `Còn ${formatQuantity(String(receipt.uncostedLineCount))} dòng chưa có giá`
                  : 'Nhập lúc tạo phiếu'}
            </Field>
          </>
        ) : null}
        <Field label="Ghi chú">{receipt.note ?? '—'}</Field>
      </div>

      {receipt.status !== 'CANCELLED' ? <GrnWaitingMatch receiptId={receipt.id} /> : null}

      <section className="overflow-hidden rounded-md border bg-card">
        <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
          <span>
            Dòng nhập · {receipt.lineCount} dòng · {formatQuantity(receipt.totalQty)} đơn vị cơ bản
          </span>
          {packed.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLabels(packed.flatMap(labelsOf));
                printer.print();
              }}
            >
              <Printer aria-hidden />
              In tất cả tem thùng
            </Button>
          ) : null}
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="px-2.5 text-xs">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right text-xs">SL</TableHead>
                <TableHead className="px-2.5 text-xs">Lô</TableHead>
                <TableHead className="px-2.5 text-xs">HSD</TableHead>
                {canCost ? (
                  <>
                    <TableHead className="px-2.5 text-right text-xs">
                      {editing ? 'Đơn giá / ĐVT nhập' : 'Đơn giá'}
                    </TableHead>
                    <TableHead className="px-2.5 text-right text-xs">Thành tiền</TableHead>
                  </>
                ) : null}
                <TableHead className="px-2.5 text-xs">Đóng gói</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map((l) => {
                const err = cost.errors[l.id];
                const value = lineValue(l);
                return (
                  <TableRow key={l.id} className={cn(err && 'bg-destructive-weak')}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {l.lineNo}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="font-semibold">{l.skuName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {l.baseUomCode}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {formatQuantity(l.qtyBase)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      {l.lotNumber ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {l.expiryDate ? formatDate(l.expiryDate) : '—'}
                    </TableCell>
                    {canCost ? (
                      <>
                        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                          {editing ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                <MoneyInput
                                  unit=""
                                  dp={4}
                                  placeholder="0"
                                  aria-label={`Đơn giá dòng ${l.lineNo}`}
                                  aria-invalid={Boolean(err)}
                                  className="w-32"
                                  value={cost.drafts[l.id] ?? ''}
                                  onChange={(v) => cost.setDraft(l.id, v)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  / {l.uomCode ?? l.baseUomCode}
                                </span>
                              </div>
                              {err ? <span className="text-xs text-destructive">{err}</span> : null}
                            </div>
                          ) : l.unitCost ? (
                            <>
                              {formatMoney(l.unitCost)}
                              {l.uomCode ? (
                                <div className="text-xs text-muted-foreground">
                                  {formatMoney(enteredCostOf(l))} / {l.uomCode}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <StatusBadge tone="warn">Chưa có giá</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {value ? formatMoney(value) : '—'}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="px-2.5 py-1.5 text-xs">
                      {l.packaging ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Box className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {l.packaging.count} {l.packaging.containerType} ×{' '}
                            {formatQuantity(l.packaging.qtyPerContainer)}
                            {l.packaging.wrapper ? (
                              <span className="text-muted-foreground">
                                {' '}
                                · bọc{' '}
                                <span className="font-mono">{l.packaging.wrapper.barcode}</span>
                              </span>
                            ) : null}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            aria-label={`In tem thùng dòng ${l.lineNo}`}
                            onClick={() => printLine(l)}
                          >
                            <Printer aria-hidden />
                            In tem
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Hàng rời</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {receipt.status === 'POSTED' ? <Movements id={receipt.id} /> : null}
    </div>
  );
}

export function GrnDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useReceipt(id);
  const post = usePostReceipt();
  const cancel = useCancelReceipt();
  const setCosts = useSetReceiptCosts(id);
  const ability = useAbility();
  const canReceive = ability.can('receive', 'Stock');
  // Kế toán: thấy tiền + nhập giá. Kho (stock.receive) không thấy cột Đơn giá / Thành tiền.
  const canCost = ability.can('cost', 'Stock');
  const receipt = query.data;
  const st = receipt ? GRN_STAGE[receipt.stage] : null;

  // ── Nhập giá (stock.cost) ── mở sẵn khi phiếu đang "Chờ nhập giá"; sửa giá được ở mọi phiếu chưa hủy.
  const canEnterCost = Boolean(receipt && canCost && receipt.stage !== 'CANCELLED');
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const openCostEntry = (r: ReceiptDetail) => {
    setDrafts(Object.fromEntries(r.lines.map((l) => [l.id, enteredCostOf(l)])));
    setErrors({});
    setEditing(true);
  };
  const awaitingCost = receipt?.stage === 'AWAITING_COST';
  useEffect(() => {
    if (receipt && canCost && awaitingCost && !editing) openCostEntry(receipt);
    // Chỉ tự mở một lần khi dữ liệu về; người dùng đóng thì không mở lại cho tới khi tải lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.id, awaitingCost, canCost]);

  const costEntry = useMemo<CostEntry>(
    () => ({
      editing,
      drafts,
      errors,
      setDraft: (lineId, value) => {
        setDrafts((d) => ({ ...d, [lineId]: value }));
        setErrors((e) => {
          if (!e[lineId]) return e;
          const rest = { ...e };
          delete rest[lineId];
          return rest;
        });
      },
    }),
    [editing, drafts, errors],
  );

  const saveCosts = () => {
    if (!receipt || setCosts.isPending) return;
    const next: Record<string, string> = {};
    const lines: Array<{ lineId: string; unitCost: string }> = [];
    for (const l of receipt.lines) {
      const v = (drafts[l.id] ?? '').trim();
      // Bỏ trống = giữ giá cũ (nếu có) / vẫn chưa có giá — không phải lỗi.
      if (v === '') continue;
      if (!MONEY_RE.test(v)) {
        next[l.id] = 'Giá không hợp lệ — số không âm, tối đa 4 số lẻ';
        continue;
      }
      if (v !== enteredCostOf(l)) lines.push({ lineId: l.id, unitCost: v });
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    if (lines.length === 0) {
      toast.success('Không có giá nào thay đổi');
      setEditing(false);
      return;
    }
    setCosts
      .mutateAsync({ lines })
      .then((r) => {
        setEditing(false);
        toast.success(
          r.stage === 'COMPLETED'
            ? `Đã lưu giá — phiếu ${receipt.docNumber} hoàn thành`
            : r.uncostedLineCount > 0
              ? `Đã lưu giá ${lines.length} dòng — còn ${r.uncostedLineCount} dòng chưa có giá`
              : `Đã lưu giá ${lines.length} dòng`,
        );
      })
      .catch((err) => toast.error(messageFor(err)));
  };

  return (
    <>
      <PageHeader
        title={receipt?.docNumber ?? 'Phiếu nhập kho'}
        description={
          receipt
            ? `Tạo bởi ${receipt.createdByName ?? '—'} · ${formatDateTime(receipt.receivedAt)} · ${receipt.warehouseName}`
            : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập kho', href: '/wms/grn' },
          { label: receipt?.docNumber ?? '…' },
        ]}
        actions={
          receipt && (canReceive || canEnterCost) ? (
            <>
              {/* Nhân bản: form tạo phiếu điền sẵn dòng của phiếu này (mọi trạng thái). */}
              {canReceive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/wms/grn/new?from=${receipt.id}`)}
                >
                  <CopyPlus aria-hidden />
                  Nhân bản
                </Button>
              ) : null}
              {canEnterCost && !editing ? (
                <Button
                  variant={awaitingCost ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => openCostEntry(receipt)}
                >
                  <Coins aria-hidden />
                  {receipt.uncostedLineCount > 0 ? 'Nhập giá nhập' : 'Sửa giá nhập'}
                </Button>
              ) : null}
              {canEnterCost && editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setCosts.isPending}
                    onClick={() => {
                      setEditing(false);
                      setErrors({});
                    }}
                  >
                    Bỏ nhập giá
                  </Button>
                  <Button size="sm" disabled={setCosts.isPending} onClick={saveCosts}>
                    {setCosts.isPending ? 'Đang lưu giá…' : 'Lưu giá'}
                  </Button>
                </>
              ) : null}
              {canReceive && receipt.status === 'DRAFT' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancel.isPending || post.isPending}
                    onClick={() =>
                      cancel
                        .mutateAsync(receipt.id)
                        .then(() => {
                          toast.success(`Đã hủy phiếu nhập ${receipt.docNumber}`);
                          router.push('/wms/grn');
                        })
                        .catch((err) => toast.error(messageFor(err)))
                    }
                  >
                    Hủy phiếu
                  </Button>
                  <Button
                    size="sm"
                    disabled={post.isPending || cancel.isPending}
                    onClick={() =>
                      post
                        .mutateAsync(receipt.id)
                        .then(() => toast.success(`Đã post phiếu ${receipt.docNumber}`))
                        .catch((err) => toast.error(messageFor(err)))
                    }
                  >
                    {post.isPending ? 'Đang post…' : 'Post phiếu'}
                  </Button>
                </>
              ) : null}
            </>
          ) : undefined
        }
      />
      {st ? (
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          <StatusBadge tone="neutral">{receipt?.poNumber ? 'Từ PO' : 'Nhập khác'}</StatusBadge>
        </div>
      ) : null}

      <QueryState query={query} skeleton={<DetailSkeleton />}>
        {(r) => <DetailBody receipt={r} canCost={canCost} cost={costEntry} />}
      </QueryState>
    </>
  );
}
