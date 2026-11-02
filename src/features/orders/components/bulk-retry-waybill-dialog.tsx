'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { messageFor } from '@/lib/error-messages';
import { useRequestWaybill, type SalesOrderListItem } from '../api/use-orders';
import { OrderResultsPanel, type OrderResultRow } from './order-results-panel';

/** Đơn xin lại được: phiếu giao còn lỗi vận đơn và đã gán hãng (giống nút trên dòng). */
export function retryableWaybill(r: SalesOrderListItem): boolean {
  return Boolean(r.waybillErrorCode && r.shipment?.carrierCode && r.status !== 'CANCELLED');
}

/**
 * "Xin lại vận đơn" cho nhiều đơn (2026-11-02) — sau khi sửa nguyên nhân chung (vd kho chưa khai
 * điểm lấy hàng). Gọi LẦN LƯỢT `POST /shipments/{id}/waybill` như nút trên dòng (không dồn hãng),
 * xong hiện kết quả từng đơn. Đơn không có lỗi vận đơn / chưa gán hãng bị bỏ qua.
 */
export function BulkRetryWaybillDialog({
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  rows: SalesOrderListItem[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const requestWaybill = useRequestWaybill();
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<OrderResultRow[] | null>(null);
  const ready = rows.filter(retryableWaybill);
  const skipped = rows.length - ready.length;
  const busy = progress !== null;

  const close = (o: boolean) => {
    if (busy) return;
    onOpenChange(o);
    if (!o && results) {
      setResults(null);
      onDone();
    }
  };

  const submit = async () => {
    if (busy || ready.length === 0) return;
    const out: OrderResultRow[] = [];
    for (const [i, o] of ready.entries()) {
      setProgress(i);
      const base = {
        orderId: o.id,
        docNumber: o.docNumber,
        customerName: o.customer.name,
        marketplace: o.marketplace,
      };
      try {
        const r = await requestWaybill.mutateAsync({
          shipmentId: o.shipment!.id,
          carrierCode: o.shipment!.carrierCode!,
        });
        out.push(
          r.trackingNo
            ? { ...base, group: 'ok', status: `Có mã ${r.trackingNo}` }
            : {
                ...base,
                group: 'wait',
                status: 'Hãng chưa phản hồi',
                reason: 'Hệ thống sẽ tự xin lại.',
              },
        );
      } catch (err) {
        out.push({ ...base, group: 'fix', status: 'Vẫn lỗi', reason: messageFor(err) });
      }
    }
    setProgress(null);
    setResults(out);
  };

  const failed = results?.filter((r) => r.group === 'fix').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {results ? (
          <>
            <DialogTitle className="sr-only">Kết quả xin lại vận đơn</DialogTitle>
            <OrderResultsPanel
              title={
                failed > 0 ? (
                  <span className="text-destructive">{failed} đơn vẫn chưa có vận đơn</span>
                ) : (
                  `Đã xin lại vận đơn ${results.length} đơn`
                )
              }
              description="Sửa từng đơn còn lỗi theo lý do bên dưới rồi xin lại."
              rows={results}
              hints={{
                ok: 'Có mã vận đơn',
                wait: 'Hãng chưa phản hồi — đang thử lại',
                fix: 'Vẫn lỗi — cần sửa',
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
              <DialogTitle>Xin lại vận đơn {ready.length} đơn?</DialogTitle>
              <DialogDescription>
                Gửi lại yêu cầu cấp mã vận đơn tới hãng đã gán trên từng đơn đang lỗi vận đơn. Sửa
                nguyên nhân lỗi (địa chỉ kho, SĐT, địa chỉ giao…) trước khi xin lại.
                {skipped > 0 ? ` ${skipped} đơn không có lỗi vận đơn sẽ bị bỏ qua.` : ''}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => close(false)}>
                Đóng
              </Button>
              <Button
                loading={busy}
                disabled={busy || ready.length === 0}
                onClick={() => void submit()}
              >
                <RefreshCw aria-hidden />
                {busy
                  ? `Đang xin ${progress! + 1}/${ready.length}…`
                  : `Xin lại ${ready.length} đơn`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
