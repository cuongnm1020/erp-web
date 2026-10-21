'use client';

import { Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DetailSkeleton, ErrorState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { usePackedView, type PdaPacked, type PdaWaybill } from '../api/use-pda';
import { shipmentStatusBadge } from '../labels';
import { LabelPrintDialog } from './label-print-dialog';
import { SkuThumb } from './sku-identity';

/**
 * Xem lại đơn ĐÃ đóng gói (2026-10-12) — mở từ cột "Đã đóng gói hôm nay" hoặc quét lại mã đơn
 * đã đóng. Hiện dòng đã đóng + phiếu giao; "In lại nhãn" mở đúng popup nhãn của lúc đóng:
 * có vận đơn → nhãn từ hãng (tự in); chưa có (hãng lỗi lúc đóng / chưa gán hãng) → xin lại.
 */
export function PackedOrderDialog({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const packed = usePackedView(taskId);
  const [printing, setPrinting] = useState(false);
  const shipment = packed.data?.shipment ?? null;
  // Popup nhãn nhận dạng kết quả xin vận đơn; dựng lại từ phiếu giao hiện tại.
  const waybill = useMemo<PdaWaybill | null>(
    () =>
      shipment
        ? {
            shipmentId: shipment.shipmentId,
            shipmentDocNumber: shipment.docNumber,
            carrierCode: shipment.carrierCode,
            outcome: shipment.trackingNo ? 'ALREADY_ISSUED' : 'NO_CARRIER',
            trackingNo: shipment.trackingNo,
            reason: null,
            errorCode: null,
          }
        : null,
    [shipment],
  );

  return (
    <>
      <Dialog open={taskId !== null && !printing} onOpenChange={(o) => !o && onClose()}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>
              {packed.data
                ? `Đơn ${packed.data.order?.docNumber ?? packed.data.task.docNumber} · đã đóng gói`
                : 'Đơn đã đóng gói'}
            </DialogTitle>
            <DialogDescription>
              {packed.data ? describe(packed.data) : 'Đang tải đơn…'}
            </DialogDescription>
          </DialogHeader>

          {packed.isPending ? (
            <DetailSkeleton fields={4} />
          ) : packed.isError ? (
            <ErrorState error={packed.error} onRetry={() => void packed.refetch()} />
          ) : (
            <div className="flex flex-col gap-4">
              <section aria-label="Phiếu giao" className="rounded-md border p-3 text-sm">
                {shipment ? (
                  <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
                    <dt className="text-muted-foreground">Phiếu giao</dt>
                    <dd className="font-mono">{shipment.docNumber}</dd>
                    <dt className="text-muted-foreground">Hãng</dt>
                    <dd>{shipment.carrierCode ?? 'Chưa gán hãng'}</dd>
                    <dt className="text-muted-foreground">Mã vận đơn</dt>
                    <dd className="font-mono">
                      {shipment.trackingNo ?? (
                        <span className="font-sans font-medium text-warning">
                          Chưa có — cần xin lại
                        </span>
                      )}
                    </dd>
                    <dt className="text-muted-foreground">Trạng thái</dt>
                    <dd>
                      <StatusBadge tone={shipmentStatusBadge(shipment.status).tone}>
                        {shipmentStatusBadge(shipment.status).label}
                      </StatusBadge>
                    </dd>
                  </dl>
                ) : (
                  <p className="text-muted-foreground">
                    Đơn này không có phiếu giao — báo điều phối kiểm tra.
                  </p>
                )}
              </section>

              <ol aria-label="Sản phẩm đã đóng" className="flex flex-col gap-1 text-sm">
                {packed.data.task.lines.map((l) => (
                  <li
                    key={l.taskLineId}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SkuThumb src={l.imageUrl} alt={l.productName} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{l.productName}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {l.skuCode}
                          {l.skuName !== l.productName ? ` · ${l.skuName}` : ''}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatQuantity(l.qtyDone)}/{formatQuantity(l.qtyPlanned)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button disabled={!shipment} onClick={() => setPrinting(true)}>
              <Printer aria-hidden />
              {shipment?.trackingNo ? 'In lại nhãn vận đơn' : 'Xin vận đơn và in nhãn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabelPrintDialog
        open={printing}
        waybill={waybill}
        orderId={packed.data?.order?.id ?? null}
        onClose={() => setPrinting(false)}
        closeLabel="Xong"
      />
    </>
  );
}

function describe(p: PdaPacked): string {
  return [
    p.task.docNumber,
    p.order?.customerName,
    p.packedByName ? `đóng bởi ${p.packedByName}` : null,
    p.completedAt ? formatDateTime(p.completedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
