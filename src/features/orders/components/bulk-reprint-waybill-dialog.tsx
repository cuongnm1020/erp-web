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
import { useShipmentLabelDataMany, type ShipmentLabelData } from '@/features/wms/api/use-pda';
import { readOrientation, rememberOrientation } from '@/features/wms/components/label-print-dialog';
import {
  WaybillLabelBatchPrintSheet,
  type WaybillOrientation,
} from '@/features/wms/components/waybill-label';
import type { SalesOrder } from '../api/use-orders';
import { useControlledOpen } from '../use-controlled-open';

/** Phiếu giao bị hủy (bởi mình hoặc hãng) — mã vận đơn không còn dùng được, không in lại. */
const DEAD = new Set(['CANCELLED', 'CARRIER_CANCELLED']);

/** Phiếu giao cần in tem — chỉ các trường dialog dùng. */
export interface ReprintShipment {
  id: string;
  trackingNo: string | null;
  status: string;
}

/** In lại tem ERP cho các đơn đã chọn trên danh sách — bọc {@link ReprintWaybillDialog}. */
export function BulkReprintWaybillDialog({
  rows,
  open,
  onOpenChange,
}: {
  rows: SalesOrder[];
  /** Có `open` = mở từ menu "Khác" của thanh chọn nhiều — không vẽ nút riêng. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ReprintWaybillDialog
      shipments={rows.flatMap((r) => (r.shipment ? [r.shipment] : []))}
      total={rows.length}
      triggerLabel="In lại vận đơn"
      triggerClassName="h-7 px-2 text-xs"
      open={open}
      onOpenChange={onOpenChange}
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
  open: openProp,
  onOpenChange,
}: {
  shipments: ReprintShipment[];
  /** Số đơn đã chọn (kể cả đơn chưa có phiếu giao) — để báo số bị bỏ qua. */
  total?: number;
  triggerLabel: string;
  triggerClassName?: string;
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

  const printable = shipments.filter((sh) => sh.trackingNo && !DEAD.has(sh.status));
  const skipped = total - printable.length;

  const submit = async () => {
    if (printable.length === 0 || fetchLabels.isPending) return;
    try {
      const data = await fetchLabels.mutateAsync(printable.map((sh) => sh.id));
      if (data.length === 0) {
        toast.error('Không lấy được dữ liệu tem của đơn nào.');
        return;
      }
      setLabels(data);
      setPrintedAt(new Date());
      setOpen(false);
      printer.print();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <>
      {controlled ? null : (
        <Button
          size="sm"
          variant="outline"
          className={triggerClassName}
          onClick={() => setOpen(true)}
        >
          <Printer aria-hidden />
          {triggerLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !fetchLabels.isPending && setOpen(o)}>
        <DialogContent>
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
          <DialogFooter>
            <Button
              variant="outline"
              disabled={fetchLabels.isPending}
              onClick={() => setOpen(false)}
            >
              Đóng
            </Button>
            <Button
              disabled={fetchLabels.isPending || printable.length === 0}
              onClick={() => void submit()}
            >
              <Printer aria-hidden />
              {fetchLabels.isPending ? 'Đang lấy tem…' : `In ${printable.length} tem`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {labels.length > 0 ? (
        <WaybillLabelBatchPrintSheet
          labels={labels}
          orientation={orientation}
          printedAt={printedAt}
          printer={printer}
        />
      ) : null}
    </>
  );
}
