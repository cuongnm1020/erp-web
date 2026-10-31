'use client';

import Link from 'next/link';
import { PackageCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { carrierSaid, messageFor, messageForCode } from '@/lib/error-messages';
import { usePrint } from '@/lib/print';
import { useShipmentLabelDataMany, type ShipmentLabelData } from '@/features/wms/api/use-pda';
import { readOrientation, rememberOrientation } from '@/features/wms/components/label-print-dialog';
import {
  WaybillLabelBatchPrintSheet,
  type WaybillOrientation,
} from '@/features/wms/components/waybill-label';
import {
  useBulkFulfilOrders,
  type BulkFulfilOrdersResult,
  type SalesOrder,
} from '../api/use-orders';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';

type Failed = BulkFulfilOrdersResult['failed'][number];

/** Kết quả một lượt "Đóng gói + in": từng đơn + đơn lỗi (để biết có đơn đã trừ tồn chưa có mã). */
export interface FulfilPrintOutcome {
  rows: OrderResultRow[];
  failed: Failed[];
  /** Đơn có mã nhưng hãng chưa phản hồi (đang thử lại) — chưa in được. */
  queued: number;
}

/** Lý do theo mã lỗi (luật 6) + nguyên văn lời hãng; đơn đã trừ tồn thì nói rõ đừng đóng lại. */
function failedReason(f: Failed): string {
  const base = f.carrierMessage
    ? `${messageForCode(f.code)} ${carrierSaid(f.carrierMessage)}`
    : messageForCode(f.code);
  return f.packed
    ? `Đã đóng gói (đã trừ tồn) nhưng chưa có mã vận đơn — ${base} Sửa đơn rồi gửi lại hãng, không đóng gói lại.`
    : base;
}

/**
 * Lõi "Đóng gói + in vận đơn" dùng chung cho nút trên thanh chọn và popup sau "Gửi sang ĐVVC"
 * (2026-10-29): POST /sales-orders/bulk-fulfil (mỗi đơn như "Đã đóng gói" trên màn sửa: trừ tồn +
 * xin vận đơn hãng trên đơn), rồi in tem ERP 100×75 của các đơn có mã trong MỘT lệnh in. `sheet`
 * là tờ in — phải mount tới khi in xong (`printing` = false). Hướng tem nhớ chung với bàn đóng gói.
 */
export function useFulfilPrint() {
  const [orientation, setOrientationState] = useState<WaybillOrientation>('landscape');
  useEffect(() => setOrientationState(readOrientation()), []);
  const [labels, setLabels] = useState<ShipmentLabelData[]>([]);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const printer = usePrint();
  const bulk = useBulkFulfilOrders();
  const fetchLabels = useShipmentLabelDataMany();

  const setOrientation = (v: WaybillOrientation) => {
    setOrientationState(v);
    rememberOrientation(v);
  };

  const [progress, setProgress] = useState<FulfilProgressState | null>(null);

  /** null = lỗi cả lô (đã báo toast). */
  const run = async (
    orderIds: string[],
    byId: Map<string, SalesOrder>,
  ): Promise<FulfilPrintOutcome | null> => {
    // Gửi từng nhóm nhỏ (2026-10-31): biết đã xong bao nhiêu đơn để hiện thanh tiến độ "x/N".
    // Server xin vận đơn song song trong mỗi nhóm. Một nhóm lỗi mạng → dừng, vẫn in phần đã xong
    // (các đơn đó đã trừ tồn).
    const total = orderIds.length;
    const r: BulkFulfilOrdersResult = { done: [], failed: [] };
    setProgress({ stage: 'pack', done: 0, total });
    try {
      for (let i = 0; i < total; i += FULFIL_CHUNK) {
        try {
          const part = await bulk.mutateAsync(orderIds.slice(i, i + FULFIL_CHUNK));
          r.done.push(...part.done);
          r.failed.push(...part.failed);
        } catch (err) {
          if (r.done.length + r.failed.length === 0) throw err;
          toast.error(`Dừng ở đơn ${i + 1}/${total}: ${messageFor(err)}`, {
            description: 'Các đơn trước đó đã đóng gói — vẫn in tem. Chọn lại phần còn lại.',
          });
          break;
        }
        setProgress({ stage: 'pack', done: Math.min(i + FULFIL_CHUNK, total), total });
      }
      const printable = r.done.filter((d) => d.trackingNo).map((d) => d.shipmentId);
      const queued = r.done.length - printable.length;
      if (printable.length > 0) {
        setProgress({ stage: 'labels', done: printable.length, total: printable.length });
        const data = await fetchLabels.mutateAsync(printable);
        if (data.length > 0) {
          setLabels(data);
          setPrintedAt(new Date());
          printer.print();
        } else toast.error('Không lấy được dữ liệu tem của đơn nào.');
      }
      if (r.done.length > 0) {
        // ALREADY_ISSUED = đơn đã có vận đơn (đóng gói trước đó / gửi qua hãng ngoài ERP) — chỉ in lại.
        const reprinted = r.done.filter((d) => d.outcome === 'ALREADY_ISSUED').length;
        const packedNow = r.done.length - reprinted;
        const notes = [
          reprinted > 0
            ? `${reprinted} đơn đã có vận đơn — chỉ in lại tem, không đóng gói lại.`
            : '',
          queued > 0 ? `${queued} đơn hãng chưa cấp mã vận đơn (đang thử lại) — in lại sau.` : '',
        ].filter(Boolean);
        toast.success(
          `${packedNow > 0 ? `Đã đóng gói ${packedNow} đơn` : 'Không đơn nào cần đóng gói'}${printable.length > 0 ? `, in ${printable.length} tem` : ''}`,
          notes.length > 0 ? { description: notes.join(' ') } : undefined,
        );
      }
      return { rows: resultRows(r, byId), failed: r.failed, queued };
    } catch (err) {
      toast.error(messageFor(err));
      return null;
    } finally {
      setProgress(null);
    }
  };

  const sheet: ReactNode =
    labels.length > 0 ? (
      <WaybillLabelBatchPrintSheet
        labels={labels}
        orientation={orientation}
        printedAt={printedAt}
        printer={printer}
      />
    ) : null;

  return {
    orientation,
    setOrientation,
    run,
    sheet,
    printing: printer.open,
    pending: progress !== null || bulk.isPending || fetchLabels.isPending,
    /** Chữ trên nút đang chạy — "Đang đóng gói 16/50…" / "Đang lấy tem…"; null = rảnh. */
    busyLabel: progress
      ? progress.stage === 'pack'
        ? `Đang đóng gói ${progress.done}/${progress.total}…`
        : 'Đang lấy tem…'
      : null,
    /** Thanh tiến độ của lượt đang chạy; null = rảnh. */
    progressBar: progress ? <FulfilProgress state={progress} /> : null,
  };
}

/** Số đơn mỗi lần gọi bulk-fulfil — đủ nhỏ để thanh tiến độ nhích đều. */
const FULFIL_CHUNK = 8;

interface FulfilProgressState {
  /** `pack` = đóng gói + xin vận đơn; `labels` = lấy dữ liệu tem để in. */
  stage: 'pack' | 'labels';
  done: number;
  total: number;
}

/** Thanh tiến độ "Đóng gói + in vận đơn" (2026-10-31) — cùng kiểu thanh của đồng bộ Pancake. */
function FulfilProgress({ state }: { state: FulfilProgressState }) {
  return state.stage === 'pack' ? (
    <ProgressLine
      label="Đang đóng gói và xin mã vận đơn"
      done={state.done}
      total={state.total}
      ariaLabel="Tiến độ đóng gói và in vận đơn"
    />
  ) : (
    <ProgressLine
      label={`Đang lấy dữ liệu ${state.total} tem để in`}
      done={state.total}
      total={state.total}
      ariaLabel="Tiến độ đóng gói và in vận đơn"
      showCount={false}
    />
  );
}

/** Một dòng tiến độ "nhãn … x/N đơn" + thanh (2026-10-31) — đóng gói + in, xin mã vận đơn. */
export function ProgressLine({
  label,
  done,
  total,
  ariaLabel,
  showCount = true,
}: {
  label: string;
  done: number;
  total: number;
  ariaLabel: string;
  showCount?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        {showCount ? (
          <span className="font-semibold tabular-nums">
            {done}/{total} đơn
          </span>
        ) : null}
      </div>
      <div
        className="h-2 overflow-hidden rounded bg-muted"
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Ô "Hướng tem" + nhắc cài hộp thoại in. */
export function WaybillOrientationField({
  id,
  value,
  onChange,
  hint = true,
}: {
  id: string;
  value: WaybillOrientation;
  onChange: (v: WaybillOrientation) => void;
  hint?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Hướng tem</Label>
      <Select value={value} onValueChange={(v) => onChange(v as WaybillOrientation)}>
        <SelectTrigger id={id} className="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="landscape">Ngang</SelectItem>
          <SelectItem value="portrait">Dọc</SelectItem>
        </SelectContent>
      </Select>
      {hint ? (
        <p className="text-xs text-muted-foreground">
          Hộp thoại in: chọn máy in tem, khổ giấy 100×75 mm, lề “Không có”, tỉ lệ 100%.
        </p>
      ) : null}
    </div>
  );
}

/** Kết quả từng đơn sau "Đóng gói + in" — đơn đã trừ tồn chưa có mã thì chỉ sang tab Lỗi vận đơn. */
export function FulfilResultsPanel({
  outcome,
  onClose,
  flush = false,
}: {
  outcome: FulfilPrintOutcome;
  onClose: () => void;
  /** Hộp thoại không padding (popup Gửi sang ĐVVC) — chân tự chừa lề. */
  flush?: boolean;
}) {
  const { rows, failed } = outcome;
  return (
    <OrderResultsPanel
      title={
        failed.length > 0 ? (
          <span className="text-destructive">{failed.length} đơn không đóng gói / in được</span>
        ) : (
          `Đã xử lý ${rows.length} đơn`
        )
      }
      description={
        failed.some((f) => f.packed)
          ? 'Đơn đã đóng gói (đã trừ tồn) mà chưa có mã nằm ở tab Lỗi vận đơn — sửa đơn rồi xin lại vận đơn, không đóng gói lại.'
          : 'Các đơn có mã đã gửi lệnh in tem. Sửa từng đơn lỗi theo lý do bên dưới rồi làm lại.'
      }
      rows={rows}
      hints={{
        ok: 'Có mã vận đơn — đã gửi lệnh in',
        wait: 'Hãng chưa phản hồi — đang thử lại',
        fix: 'Lỗi — cần sửa',
      }}
      footer={
        <DialogFooter
          className={cn('items-center border-t sm:justify-between', flush ? 'px-5 py-3' : 'pt-3')}
        >
          {failed.some((f) => f.packed) ? (
            <Link
              href="/crm/orders?flow=WAYBILL_ERROR"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={onClose}
            >
              Xem ở tab Lỗi vận đơn
            </Link>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      }
    />
  );
}

/**
 * "Đóng gói + in vận đơn" cho các đơn đã chọn — kho không pick/pack trên ERP (2026-10-21). Đơn
 * chưa duyệt / chưa gán hãng bị bỏ qua ngay ở client; đơn server từ chối được liệt kê trong hộp
 * thoại. Lõi ở {@link useFulfilPrint}.
 */
export function BulkFulfilPrintDialog({
  rows,
  onDone,
}: {
  rows: SalesOrder[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  /** Kết quả từng đơn của lần bấm vừa rồi (2026-10-28) — null = chưa bấm / không cần xem. */
  const [outcome, setOutcome] = useState<FulfilPrintOutcome | null>(null);
  const fp = useFulfilPrint();

  const ready = rows.filter((r) => r.status === 'APPROVED' && r.carrierId);
  const skipped = rows.length - ready.length;

  // Bỏ chọn (onDone) gỡ cả nút này lẫn tờ in khỏi thanh chọn → chỉ gọi khi tờ in đã in xong và
  // hộp thoại đã đóng.
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished && !fp.printing && outcome === null) {
      setFinished(false);
      onDone();
    }
  }, [finished, fp.printing, outcome, onDone]);

  const close = (o: boolean) => {
    if (fp.pending) return;
    setOpen(o);
    if (!o) setOutcome(null);
  };

  const submit = async () => {
    if (ready.length === 0 || fp.pending) return;
    const r = await fp.run(
      ready.map((o) => o.id),
      new Map(rows.map((o) => [o.id, o])),
    );
    if (!r) return;
    // Nhiều đơn / có lỗi / hãng chưa phản hồi → giữ hộp thoại với kết quả TỪNG đơn (2026-10-28).
    if (r.failed.length > 0 || r.rows.length > 1 || r.queued > 0) setOutcome(r);
    else setOpen(false);
    setFinished(true);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <PackageCheck aria-hidden />
        Đóng gói + in vận đơn
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          {outcome ? (
            <>
              <DialogTitle className="sr-only">Kết quả đóng gói và in vận đơn</DialogTitle>
              <FulfilResultsPanel outcome={outcome} onClose={() => close(false)} />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Đóng gói và in vận đơn {ready.length} đơn?</DialogTitle>
                <DialogDescription>
                  Không cần pick / đóng gói trên ERP: hệ thống đánh dấu đã đóng gói (trừ tồn kho),
                  xin mã vận đơn của hãng đã gán trên đơn rồi in tem ERP 100×75 mm, mỗi đơn một tem.
                  {skipped > 0 ? ` ${skipped} đơn chưa duyệt hoặc chưa gán hãng sẽ bị bỏ qua.` : ''}
                </DialogDescription>
              </DialogHeader>
              <WaybillOrientationField
                id="bulk-fulfil-orientation"
                value={fp.orientation}
                onChange={fp.setOrientation}
              />
              {fp.progressBar}
              <DialogFooter>
                <Button variant="outline" disabled={fp.pending} onClick={() => close(false)}>
                  Đóng
                </Button>
                <Button disabled={fp.pending || ready.length === 0} onClick={() => void submit()}>
                  <PackageCheck aria-hidden />
                  {fp.busyLabel ?? `Đóng gói + in ${ready.length} đơn`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {fp.sheet}
    </>
  );
}

/** Kết quả từng đơn: có mã → in được; chưa có mã (hãng chưa phản hồi) → chờ; lỗi → cần sửa. */
function resultRows(
  r: { done: BulkFulfilOrdersResult['done']; failed: Failed[] },
  byId: Map<string, SalesOrder>,
): OrderResultRow[] {
  return [
    ...r.failed.map((f): OrderResultRow => ({
      orderId: f.orderId,
      docNumber: f.docNumber ?? byId.get(f.orderId)?.docNumber ?? f.orderId.slice(0, 8),
      customerName: byId.get(f.orderId)?.customer.name,
      marketplace: byId.get(f.orderId)?.marketplace,
      group: 'fix',
      status: f.packed ? 'Đã đóng gói, chưa có mã' : 'Không đóng gói được',
      reason: failedReason(f),
    })),
    ...r.done.map((d): OrderResultRow => ({
      orderId: d.orderId,
      docNumber: d.docNumber ?? byId.get(d.orderId)?.docNumber ?? d.orderId.slice(0, 8),
      customerName: byId.get(d.orderId)?.customer.name,
      marketplace: byId.get(d.orderId)?.marketplace,
      group: d.trackingNo ? 'ok' : 'wait',
      status: d.trackingNo ? `Có mã ${d.trackingNo}` : 'Hãng chưa phản hồi',
      reason: d.outcome === 'ALREADY_ISSUED' ? 'Đã có vận đơn từ trước — chỉ in lại tem.' : null,
    })),
  ];
}
