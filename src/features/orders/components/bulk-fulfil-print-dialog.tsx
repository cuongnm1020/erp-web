'use client';

import Link from 'next/link';
import { PackageCheck } from 'lucide-react';
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

type Failed = BulkFulfilOrdersResult['failed'][number];

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
 * "Đóng gói + in vận đơn" cho các đơn đã chọn — kho không pick/pack trên ERP (2026-10-21). POST
 * /sales-orders/bulk-fulfil (mỗi đơn như "Đã đóng gói" trên màn sửa: trừ tồn + xin vận đơn hãng
 * trên đơn), rồi in tem ERP 100×75 của các đơn có mã vận đơn trong MỘT lệnh in. Đơn chưa duyệt /
 * chưa gán hãng bị bỏ qua ngay ở client; đơn server từ chối được liệt kê trong hộp thoại.
 */
export function BulkFulfilPrintDialog({
  rows,
  onDone,
}: {
  rows: SalesOrder[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<WaybillOrientation>('landscape');
  useEffect(() => setOrientation(readOrientation()), []);
  const [labels, setLabels] = useState<ShipmentLabelData[]>([]);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [failed, setFailed] = useState<Failed[]>([]);
  const printer = usePrint();
  const bulk = useBulkFulfilOrders();
  const fetchLabels = useShipmentLabelDataMany();
  const pending = bulk.isPending || fetchLabels.isPending;

  const ready = rows.filter((r) => r.status === 'APPROVED' && r.carrierId);
  const skipped = rows.length - ready.length;

  // Bỏ chọn (onDone) gỡ cả nút này lẫn tờ in khỏi thanh chọn → chỉ gọi khi tờ in đã in xong và
  // hộp thoại đã đóng.
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished && !printer.open && failed.length === 0) {
      setFinished(false);
      onDone();
    }
  }, [finished, printer.open, failed.length, onDone]);

  const close = (o: boolean) => {
    if (pending) return;
    setOpen(o);
    if (!o) setFailed([]);
  };

  const submit = async () => {
    if (ready.length === 0 || pending) return;
    try {
      const r = await bulk.mutateAsync(ready.map((o) => o.id));
      const printable = r.done.filter((d) => d.trackingNo).map((d) => d.shipmentId);
      const queued = r.done.length - printable.length;
      if (printable.length > 0) {
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
      if (r.failed.length > 0) setFailed(r.failed);
      else setOpen(false);
      setFinished(true);
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  const byId = new Map(rows.map((o) => [o.id, o]));

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
          {failed.length > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {failed.length} đơn không đóng gói / in được
                </DialogTitle>
                <DialogDescription>
                  Các đơn còn lại đã xong. Sửa từng đơn theo lý do bên dưới rồi làm lại.
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Danh sách đơn lỗi">
                {failed.map((f) => (
                  <li
                    key={f.orderId}
                    className="rounded-md border border-destructive-line px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/crm/orders/${f.orderId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold tabular-nums text-primary hover:underline"
                      >
                        {f.docNumber ?? byId.get(f.orderId)?.docNumber ?? f.orderId.slice(0, 8)}
                      </Link>
                      <span className="text-muted-foreground">
                        {byId.get(f.orderId)?.customer.name}
                      </span>
                    </div>
                    <p className="mt-1 text-foreground">{failedReason(f)}</p>
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
                <DialogTitle>Đóng gói và in vận đơn {ready.length} đơn?</DialogTitle>
                <DialogDescription>
                  Không cần pick / đóng gói trên ERP: hệ thống đánh dấu đã đóng gói (trừ tồn kho),
                  xin mã vận đơn của hãng đã gán trên đơn rồi in tem ERP 100×75 mm, mỗi đơn một tem.
                  {skipped > 0 ? ` ${skipped} đơn chưa duyệt hoặc chưa gán hãng sẽ bị bỏ qua.` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-fulfil-orientation">Hướng tem</Label>
                <Select
                  value={orientation}
                  onValueChange={(v) => {
                    setOrientation(v as WaybillOrientation);
                    rememberOrientation(v as WaybillOrientation);
                  }}
                >
                  <SelectTrigger id="bulk-fulfil-orientation" className="h-9 w-40">
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
                <Button variant="outline" disabled={pending} onClick={() => close(false)}>
                  Đóng
                </Button>
                <Button disabled={pending || ready.length === 0} onClick={() => void submit()}>
                  <PackageCheck aria-hidden />
                  {bulk.isPending
                    ? 'Đang đóng gói…'
                    : fetchLabels.isPending
                      ? 'Đang lấy tem…'
                      : `Đóng gói + in ${ready.length} đơn`}
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
        />
      ) : null}
    </>
  );
}
