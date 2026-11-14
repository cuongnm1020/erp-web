'use client';

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
import { useCancelOrderWaybills } from '../api/use-orders';

/** Đơn đưa vào hộp hủy vận đơn — chỉ cần số đơn + mã vận đơn (nếu danh sách có sẵn). */
export interface CancelWaybillRow {
  id: string;
  docNumber: string;
  trackingNo?: string | null;
}

/** Dòng danh sách đủ trường để xét "Hủy vận đơn" ở thanh chọn nhiều. */
interface CancellableWaybillRow {
  status: string;
  sentToCarrierAt: string | null;
  shipment: { status: string; trackingNo: string | null } | null;
}

/**
 * Đơn đưa được vào "Hủy vận đơn" ở thanh chọn nhiều (2026-11-14) — cùng luật màn chi tiết: đã có
 * mã vận đơn, HOẶC đã Gửi sang ĐVVC mà phiếu giao còn chờ (hãng từ chối cấp mã — tab Cần sửa).
 * Đơn chưa có mã thì API chỉ đưa về Đã xác nhận, gỡ lỗi vận đơn để gửi hãng khác.
 */
export function cancellableWaybill(r: CancellableWaybillRow): boolean {
  if (r.status === 'CANCELLED') return false;
  if (r.shipment?.trackingNo) return true;
  return Boolean(r.sentToCarrierAt) && (!r.shipment || r.shipment.status === 'PENDING');
}

/**
 * Câu lý do của một đơn không hủy được vận đơn. Mã hủy-đơn dùng chung (ORDER_CARRIER_*) có câu
 * nói về "hủy đơn" — ở đây đơn không bị hủy nên dùng câu riêng; mã khác đi bảng chung (luật 6).
 */
const WAYBILL_FAIL_TEXT: Record<string, string> = {
  ORDER_CARRIER_PICKED_UP: 'Hãng đã lấy hàng — không hủy vận đơn được nữa.',
  ORDER_CARRIER_CANCEL_REJECTED: 'Hãng không đồng ý hủy vận đơn — xử lý trên portal hãng.',
  ORDER_CARRIER_CANCEL_FAILED: 'Không gọi được hãng để hủy vận đơn. Thử lại sau ít phút.',
  CARRIER_OPERATION_UNSUPPORTED:
    'Hãng này không hủy vận đơn qua hệ thống được — hủy tay trên portal hãng.',
};

function failText(f: { code: string; carrierMessage: string | null }): string {
  const base = WAYBILL_FAIL_TEXT[f.code] ?? messageForItemCode(f.code);
  return f.carrierMessage ? `${base} ${carrierSaid(f.carrierMessage)}` : base;
}

/**
 * "Hủy vận đơn" (2026-11-02) — POST /sales-orders/cancel-waybill cho một hay nhiều đơn: hãng hủy
 * mã vận đơn (đúng tài khoản đã cấp), phiếu giao về Hãng hủy ngay → "Gửi sang ĐVVC" lại được bằng
 * tài khoản / hãng khác. Đơn, hàng giữ, hàng đã đóng gói giữ nguyên. Không optimistic (luật 5).
 */
export function CancelWaybillDialog({
  rows,
  open,
  onOpenChange,
  onDone,
}: {
  rows: CancelWaybillRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gọi khi có ít nhất một vận đơn đã hủy. */
  onDone?: () => void;
}) {
  const [reason, setReason] = useState('');
  const cancel = useCancelOrderWaybills();
  const one = rows.length === 1 ? rows[0] : undefined;
  // `trackingNo: null` = biết chắc chưa có mã (undefined = nơi gọi không có sẵn mã, không nói gì).
  const noCode = rows.filter((r) => r.trackingNo === null).length;

  const submit = async () => {
    if (rows.length === 0 || cancel.isPending) return;
    try {
      const r = await cancel.mutateAsync({
        orderIds: rows.map((o) => o.id),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (r.cancelled.length > 0) {
        // 2026-11-07: kho chưa lấy xong hàng → đơn về Đã xác nhận (sửa lại được); đã lấy / đóng gói
        // → giữ ở Đang đóng hàng, gửi lại hãng khác.
        const back = r.cancelled.filter((c) => c.revertedToConfirmed);
        const kept = r.cancelled.filter((c) => !c.revertedToConfirmed);
        const label = (c: (typeof r.cancelled)[number]) =>
          c.trackingNo ? `${c.docNumber} (${c.trackingNo})` : c.docNumber;
        toast.success(`Đã hủy ${r.cancelled.length} vận đơn`, {
          description: [
            back.length > 0
              ? `${back.map(label).join(', ')} — về Đã xác nhận, sửa đơn / gửi hãng khác được.`
              : null,
            kept.length > 0
              ? `${kept.map(label).join(', ')} — kho đã lấy hàng, gửi sang ĐVVC lại để lấy vận đơn mới.`
              : null,
          ]
            .filter(Boolean)
            .join('\n'),
          duration: 10_000,
        });
      }
      if (r.failed.length > 0) {
        toast.error(`${r.failed.length} đơn KHÔNG hủy được vận đơn`, {
          description: r.failed
            .map((f) => `${f.docNumber ?? f.orderId.slice(0, 8)}: ${failText(f)}`)
            .join('\n'),
          duration: 20_000,
        });
      }
      onOpenChange(false);
      setReason('');
      if (r.cancelled.length > 0) onDone?.();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !cancel.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {one
              ? `Hủy vận đơn${one.trackingNo ? ` ${one.trackingNo}` : ''} của đơn ${one.docNumber}?`
              : `Hủy vận đơn của ${rows.length} đơn đã chọn?`}
          </DialogTitle>
          <DialogDescription>
            Hãng sẽ hủy mã vận đơn — không đến lấy hàng theo mã này nữa. Kho chưa lấy hàng thì đơn
            về <strong>Đã xác nhận</strong>: sửa lại đơn, rồi gửi sang ĐVVC (đổi hãng được). Đơn
            hãng đã lấy hàng sẽ báo lỗi riêng.
            {noCode > 0 ? (
              <>
                {' '}
                {one ? 'Đơn' : `${noCode} đơn`} chưa có mã (hãng chưa cấp / từ chối) — không gọi
                hãng, chỉ đưa về Đã xác nhận.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-waybill-reason">Lý do (tùy chọn, gửi cho hãng)</Label>
          <Input
            id="cancel-waybill-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Đổi tài khoản / hãng vận chuyển…"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={cancel.isPending} onClick={() => onOpenChange(false)}>
            Không hủy
          </Button>
          <Button
            variant="destructive"
            loading={cancel.isPending}
            disabled={rows.length === 0}
            onClick={() => void submit()}
          >
            {one ? 'Hủy vận đơn' : `Hủy ${rows.length} vận đơn`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
