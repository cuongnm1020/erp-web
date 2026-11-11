'use client';

import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { messageFor } from '@/lib/error-messages';
import { usePrint } from '@/lib/print';
import {
  useMarkLabelsPrinted,
  useShipmentLabelDataMany,
  type ShipmentLabelData,
} from '@/features/wms/api/use-pda';
import { readOrientation, rememberOrientation } from '@/features/wms/components/label-print-dialog';
import {
  parseFromSeq,
  ReprintFromField,
  WaybillLabelBatchPrintSheet,
  type WaybillOrientation,
} from '@/features/wms/components/waybill-label';
import { sortLabelsForPrint } from '@/features/wms/waybill-sort';
import { isPrintLocked, printLockReason } from '@/features/wms/print-guard';
import type { SalesOrder } from '../api/use-orders';
import { LockedReprintAction } from './bulk-fulfil-print-dialog';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';
import { useControlledOpen } from '../use-controlled-open';

/** Phiếu giao bị hủy (bởi mình hoặc hãng) — mã vận đơn không còn dùng được, không in lại. */
const DEAD = new Set(['CANCELLED', 'CARRIER_CANCELLED']);

/** Phiếu giao cần in tem — chỉ các trường dialog dùng. */
export interface ReprintShipment {
  id: string;
  trackingNo: string | null;
  status: string;
  /** Đơn của phiếu — link ở tab Cảnh báo (in nhiều). */
  orderId?: string;
}

/** In lại tem ERP cho các đơn đã chọn trên danh sách — bọc {@link ReprintWaybillDialog}. */
export function BulkReprintWaybillDialog({
  rows,
  open,
  onOpenChange,
  onDeselect,
}: {
  rows: SalesOrder[];
  /** Có `open` = mở từ menu "Khác" của thanh chọn nhiều — không vẽ nút riêng. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** In từ tem số N (2026-11-10): bỏ tích các đơn của tem 1…N−1 (đã ra giấy). */
  onDeselect?: (orderIds: string[]) => void;
}) {
  const orderOf = new Map(rows.flatMap((r) => (r.shipment ? [[r.shipment.id, r.id]] : [])));
  return (
    <ReprintWaybillDialog
      shipments={rows.flatMap((r) => (r.shipment ? [{ ...r.shipment, orderId: r.id }] : []))}
      total={rows.length}
      triggerLabel="In lại vận đơn"
      triggerClassName="h-7 px-2 text-xs"
      open={open}
      onOpenChange={onOpenChange}
      onSkipped={
        onDeselect
          ? (shipmentIds) =>
              onDeselect(shipmentIds.flatMap((id) => (orderOf.has(id) ? [orderOf.get(id)!] : [])))
          : undefined
      }
    />
  );
}

/**
 * In tem vận đơn ERP 100×75 — POST /shipments/label-data rồi in tất cả trong MỘT lệnh in (mỗi tem
 * một trang). ERP tự vẽ tem từ dữ liệu phiếu, KHÔNG hỏi hãng — in được cả khi hãng đã lấy hàng /
 * không còn trả nhãn. Chỉ phiếu đã có mã vận đơn và chưa hủy; phiếu khác bỏ qua ngay ở client.
 * Hướng tem nhớ chung với popup nhãn ở bàn đóng gói.
 */
export function ReprintWaybillDialog({
  shipments,
  total = shipments.length,
  triggerLabel,
  triggerClassName,
  triggerSize = 'sm',
  open: openProp,
  onOpenChange,
  onSkipped,
}: {
  /** Phiếu giao của tem 1…N−1 không in lại (in từ tem số N) — theo thứ tự in. */
  onSkipped?: (shipmentIds: string[]) => void;
  shipments: ReprintShipment[];
  /** Số đơn đã chọn (kể cả đơn chưa có phiếu giao) — để báo số bị bỏ qua. */
  total?: number;
  triggerLabel: string;
  triggerClassName?: string;
  /** `default` = nút ở PageHeader (cao 32px như các nút đầu màn); `sm` = trong thẻ / thanh chọn. */
  triggerSize?: 'sm' | 'default';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { controlled, open, setOpen } = useControlledOpen(openProp, onOpenChange);
  const [orientation, setOrientation] = useState<WaybillOrientation>('landscape');
  useEffect(() => setOrientation(readOrientation()), []);
  const [labels, setLabels] = useState<ShipmentLabelData[]>([]);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const printer = usePrint();
  const fetchLabels = useShipmentLabelDataMany();
  const markPrinted = useMarkLabelsPrinted();

  const [fromText, setFromText] = useState('');
  const [fromSeq, setFromSeq] = useState(1);

  const printable = shipments.filter((sh) => sh.trackingNo && !DEAD.has(sh.status));
  const skipped = total - printable.length;
  const from = parseFromSeq(fromText, printable.length);

  /** In lẻ đã in + đã có NV đóng → hỏi trước (PRINT-DUP-1); in nhiều → đơn vướng sang tab Cảnh báo. */
  const [confirmLock, setConfirmLock] = useState<ShipmentLabelData | null>(null);
  const [warn, setWarn] = useState<{ printed: ShipmentLabelData[]; locked: ShipmentLabelData[] }>();

  const closeAll = (o: boolean) => {
    if (fetchLabels.isPending) return;
    setOpen(o);
    if (!o) {
      setConfirmLock(null);
      setWarn(undefined);
    }
  };

  /** In đúng các tem này (đã lọc) — `keepOpen` = còn tab Cảnh báo để xem. */
  const printLabels = (data: ShipmentLabelData[], start: number, keepOpen: boolean) => {
    setLabels(data);
    setFromSeq(start);
    setPrintedAt(new Date());
    if (!keepOpen) setOpen(false);
    setFromText('');
    printer.print();
    if (start > 1) {
      onSkipped?.(
        sortLabelsForPrint(data)
          .slice(0, start - 1)
          .map((l) => l.shipmentId),
      );
    }
    // Bộ lọc "In tem" của danh sách đơn (2026-11-02) — ghi nhận không chặn việc in.
    markPrinted.mutate(
      data.filter((l) => l.trackingNo).map((l) => l.shipmentId),
      { onError: () => undefined },
    );
  };

  const submit = async (force = false) => {
    if (printable.length === 0 || fetchLabels.isPending) return;
    try {
      const all = await fetchLabels.mutateAsync(printable.map((sh) => sh.id));
      if (all.length === 0) {
        toast.error('Không lấy được dữ liệu tem của đơn nào.');
        return;
      }
      const locked = force ? [] : all.filter((l) => isPrintLocked(l));
      if (locked.length > 0 && all.length === 1) {
        setConfirmLock(all[0]!);
        return;
      }
      const lockedIds = new Set(locked.map((l) => l.shipmentId));
      const data = all.filter((l) => !lockedIds.has(l.shipmentId));
      if (locked.length > 0) setWarn({ printed: data, locked });
      if (data.length === 0) return;
      printLabels(data, parseFromSeq(fromText, data.length), locked.length > 0);
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  /** In lại các đơn tab Cảnh báo — người dùng đã xác nhận ở {@link LockedReprintAction}. */
  const printLocked = async (): Promise<boolean> => {
    if (!warn) return false;
    printLabels(warn.locked, 1, true);
    return true;
  };

  const orderOf = new Map(shipments.map((sh) => [sh.id, sh.orderId]));
  const warnRows = (w: NonNullable<typeof warn>): OrderResultRow[] => [
    ...w.locked.map((l): OrderResultRow => ({
      orderId: orderOf.get(l.shipmentId) ?? l.shipmentId,
      docNumber: l.orderDocNumber ?? l.shipmentDocNumber,
      group: 'warn',
      status: 'Không in — đã in, đã có NV đóng',
      reason: printLockReason(l),
    })),
    ...w.printed.map((l): OrderResultRow => ({
      orderId: orderOf.get(l.shipmentId) ?? l.shipmentId,
      docNumber: l.orderDocNumber ?? l.shipmentDocNumber,
      group: 'ok',
      status: l.trackingNo ? `Đã in ${l.trackingNo}` : 'Đã in',
    })),
  ];

  return (
    <>
      {controlled ? null : (
        <Button
          size={triggerSize}
          variant="outline"
          className={triggerClassName}
          onClick={() => setOpen(true)}
        >
          <Printer aria-hidden />
          {triggerLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={closeAll}>
        <DialogContent>
          {warn ? (
            <>
              <DialogTitle className="sr-only">Kết quả in lại vận đơn</DialogTitle>
              <OrderResultsPanel
                title={
                  <span className="text-warning">
                    {warn.locked.length} đơn không in — đã in, đã có NV đóng
                  </span>
                }
                description={`Đã gửi lệnh in ${warn.printed.length} tem. Đơn ở tab Cảnh báo chỉ in lại khi tem cũ bị mất / hỏng.`}
                rows={warnRows(warn)}
                hints={{
                  ok: 'Đã gửi lệnh in',
                  wait: 'Chờ',
                  fix: 'Lỗi',
                  warn: 'Đã in + có NV đóng — không in',
                }}
                warnAction={
                  <LockedReprintAction
                    count={warn.locked.length}
                    busy={printer.open}
                    onPrint={printLocked}
                  />
                }
                footer={
                  <DialogFooter className="border-t pt-3">
                    <Button variant="outline" onClick={() => closeAll(false)}>
                      Đóng
                    </Button>
                  </DialogFooter>
                }
              />
            </>
          ) : confirmLock ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  In lại tem đơn {confirmLock.orderDocNumber ?? confirmLock.shipmentDocNumber}?
                </DialogTitle>
                <DialogDescription>
                  {printLockReason(confirmLock)}. In thêm tem có thể khiến hai người cùng đóng một
                  đơn — chỉ in khi tem cũ bị mất / hỏng.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmLock(null)}>
                  Hủy
                </Button>
                <Button
                  onClick={() => {
                    const l = confirmLock;
                    setConfirmLock(null);
                    printLabels([l], 1, false);
                  }}
                >
                  <Printer aria-hidden />
                  In lại tem
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>In lại {printable.length} tem vận đơn?</DialogTitle>
                <DialogDescription>
                  Tem ERP 100×75 mm, mỗi đơn một tem, in trong một lần.
                  {skipped > 0
                    ? ` ${skipped} đơn chưa có mã vận đơn hoặc vận đơn đã hủy sẽ bị bỏ qua.`
                    : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-reprint-orientation">Hướng tem</Label>
                <Select
                  value={orientation}
                  onValueChange={(v) => {
                    setOrientation(v as WaybillOrientation);
                    rememberOrientation(v as WaybillOrientation);
                  }}
                >
                  <SelectTrigger id="bulk-reprint-orientation" className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Ngang</SelectItem>
                    <SelectItem value="portrait">Dọc</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Hộp thoại in: chọn máy in tem, khổ giấy 100×75 mm, lề “Không có”, tỉ lệ 100%.
                </p>
              </div>
              {printable.length > 1 ? (
                <ReprintFromField
                  id="bulk-reprint-from"
                  total={printable.length}
                  value={fromText}
                  onChange={setFromText}
                />
              ) : null}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={fetchLabels.isPending}
                  onClick={() => closeAll(false)}
                >
                  Đóng
                </Button>
                <Button
                  disabled={fetchLabels.isPending || printable.length === 0}
                  onClick={() => void submit()}
                >
                  <Printer aria-hidden />
                  {fetchLabels.isPending
                    ? 'Đang lấy tem…'
                    : `In ${printable.length - from + 1} tem${from > 1 ? ` (từ tem ${from})` : ''}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {labels.length > 0 ? (
        <WaybillLabelBatchPrintSheet
          labels={labels}
          orientation={orientation}
          printedAt={printedAt}
          printer={printer}
          fromSeq={fromSeq}
        />
      ) : null}
    </>
  );
}
