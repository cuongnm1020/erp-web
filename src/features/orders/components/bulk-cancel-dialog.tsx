'use client';

import { Ban } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { carrierSaid, messageFor, messageForItemCode } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { useBulkCancelOrders, type CancelOrderResult, type SalesOrder } from '../api/use-orders';
import { orderCancellable } from '../labels';
import { useControlledOpen } from '../use-controlled-open';

/**
 * Câu kết quả phía hãng / kho của các đơn vừa hủy (2026-11-02): vận đơn đã hủy bên hãng, vận đơn
 * phải hủy tay trên portal hãng (hãng không có API hủy), đơn đã đóng gói được nhập lại kho.
 */
export function cancelOutcomeNotes(done: CancelOrderResult[]): string[] {
  const carrier = done.filter((d) => d.carrierCancel === 'CANCELLED').length;
  const manual = done.filter((d) => d.carrierCancel === 'MANUAL_REQUIRED').map((d) => d.docNumber);
  const restocked = done.filter((d) => d.returnReceiptDocNumber);
  return [
    carrier > 0 ? `Đã hủy ${carrier} vận đơn bên hãng.` : '',
    manual.length > 0
      ? `Hãng không hủy qua hệ thống được — hủy tay vận đơn trên portal hãng: ${manual.join(', ')}.`
      : '',
    restocked.length > 0
      ? `Đã nhập lại kho ${restocked.length} đơn đã đóng gói (${restocked
          .map((d) => d.returnReceiptDocNumber)
          .join(', ')}) — lấy kiện ra khỏi khu chờ giao.`
      : '',
  ].filter(Boolean);
}

/**
 * Hủy các đơn đã chọn trên danh sách — POST /sales-orders/bulk-cancel, cùng một lý do (tùy
 * chọn). Đơn đã hủy / kho đã đóng gói bị bỏ qua ngay ở client; server hủy từng đơn, nhả hàng
 * đang giữ, đơn lệch pha về `failed` và được báo riêng. Không hoàn tác, không optimistic (luật 5).
 */
export function BulkCancelDialog({
  rows,
  onDone,
  open: openProp,
  onOpenChange,
}: {
  rows: SalesOrder[];
  onDone: () => void;
  /** Có `open` = mở từ menu "Khác" của thanh chọn nhiều — không vẽ nút riêng. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { controlled, open, setOpen } = useControlledOpen(openProp, onOpenChange);
  const [reason, setReason] = useState('');
  const bulk = useBulkCancelOrders();
  // Hủy đơn đã đóng gói mà hãng chưa lấy hàng (2026-11-02) — server hủy vận đơn + nhập lại kho.
  const afterCarrier = useAbility().can('cancel_after_carrier', 'SalesOrder');

  const cancellable = rows.filter((r) =>
    orderCancellable(r.status, r.fulfilmentStatus, afterCarrier),
  );
  const skipped = rows.length - cancellable.length;
  const withCarrier = cancellable.some((r) => r.shipment?.trackingNo);

  const submit = async () => {
    if (cancellable.length === 0 || bulk.isPending) return;
    try {
      const r = await bulk.mutateAsync({
        orderIds: cancellable.map((o) => o.id),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const notes = cancelOutcomeNotes(r.cancelled);
      if (r.cancelled.length > 0) {
        toast.success(`Đã hủy ${r.cancelled.length} đơn`, {
          description:
            notes.join(' ') ||
            (skipped > 0
              ? `${skipped} đơn đã hủy / kho đã đóng gói được bỏ qua.`
              : 'Hàng đang giữ cho các đơn đã được nhả về khả dụng.'),
          duration: notes.length > 0 ? 10_000 : undefined,
        });
      }
      if (r.failed.length > 0) {
        // Lý do từng đơn theo mã (luật 6) + nguyên văn lời hãng khi hãng từ chối hủy vận đơn.
        toast.error(`${r.failed.length} đơn KHÔNG hủy được`, {
          description: r.failed
            .map(
              (f) =>
                `${f.docNumber ?? f.orderId.slice(0, 8)}: ${messageForItemCode(f.code)}${
                  f.carrierMessage ? ` ${carrierSaid(f.carrierMessage)}` : ''
                }`,
            )
            .join('\n'),
          duration: 20_000,
        });
      }
      setOpen(false);
      setReason('');
      onDone();
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
          className="border-destructive-line text-destructive hover:bg-destructive-weak hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Ban aria-hidden />
          Hủy đơn
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !bulk.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {/* Một đơn = nút Hủy trên dòng danh sách (2026-10-29) — gọi đúng số đơn. */}
              {rows.length === 1 && rows[0]
                ? `Hủy đơn ${rows[0].docNumber}?`
                : `Hủy ${cancellable.length} đơn đã chọn?`}
            </DialogTitle>
            <DialogDescription>
              Không hoàn tác được. Hàng đang giữ cho các đơn sẽ được nhả về khả dụng; muốn bán lại
              thì tạo đơn mới.
              {withCarrier
                ? ' Đơn đã có mã vận đơn: hệ thống hủy vận đơn bên hãng trước — hãng không đồng ý thì đơn đó giữ nguyên.'
                : ''}
              {afterCarrier
                ? ' Đơn kho đã đóng gói: hàng tự nhập lại kho (phiếu nhập hàng hoàn).'
                : ''}
              {skipped > 0
                ? afterCarrier
                  ? ` ${skipped} đơn đã hủy hoặc hãng đã lấy hàng sẽ bị bỏ qua (xử lý bằng hoàn hàng).`
                  : ` ${skipped} đơn đã hủy hoặc kho đã đóng gói sẽ bị bỏ qua (đã đóng gói thì nhờ trưởng phòng / quản trị hủy).`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-cancel-reason">Lý do hủy (tùy chọn)</Label>
            <Input
              id="bulk-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Khách đổi ý, đặt trùng…"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={bulk.isPending} onClick={() => setOpen(false)}>
              Không hủy
            </Button>
            <Button
              variant="destructive"
              disabled={bulk.isPending || cancellable.length === 0}
              onClick={() => void submit()}
            >
              {bulk.isPending
                ? 'Đang hủy…'
                : rows.length === 1
                  ? 'Hủy đơn'
                  : `Hủy ${cancellable.length} đơn`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
