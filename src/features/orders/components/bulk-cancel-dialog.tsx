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
import { messageFor } from '@/lib/error-messages';
import { useBulkCancelOrders, type SalesOrder } from '../api/use-orders';
import { orderCancellable } from '../labels';
import { useControlledOpen } from '../use-controlled-open';

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

  const cancellable = rows.filter((r) => orderCancellable(r.status, r.fulfilmentStatus));
  const skipped = rows.length - cancellable.length;

  const submit = async () => {
    if (cancellable.length === 0 || bulk.isPending) return;
    try {
      const r = await bulk.mutateAsync({
        orderIds: cancellable.map((o) => o.id),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const failedDocs = r.failed.map((f) => f.docNumber ?? f.orderId.slice(0, 8)).join(', ');
      toast.success(`Đã hủy ${r.cancelled.length} đơn`, {
        description:
          r.failed.length > 0
            ? `${r.failed.length} đơn không hủy được: ${failedDocs}`
            : skipped > 0
              ? `${skipped} đơn đã hủy / đã đóng gói được bỏ qua`
              : 'Hàng đang giữ cho các đơn đã được nhả về khả dụng.',
        duration: r.failed.length > 0 ? 10_000 : undefined,
      });
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
          className="h-7 border-destructive-line px-2 text-xs text-destructive hover:bg-destructive-weak hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Ban aria-hidden />
          Hủy đơn
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !bulk.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy {cancellable.length} đơn đã chọn?</DialogTitle>
            <DialogDescription>
              Không hoàn tác được. Hàng đang giữ cho các đơn sẽ được nhả về khả dụng; muốn bán lại
              thì tạo đơn mới.
              {skipped > 0
                ? ` ${skipped} đơn đã hủy hoặc kho đã đóng gói sẽ bị bỏ qua (đã đóng gói thì xử lý bằng hoàn hàng).`
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
              {bulk.isPending ? 'Đang hủy…' : `Hủy ${cancellable.length} đơn`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
