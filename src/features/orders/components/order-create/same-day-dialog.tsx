'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
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
import { formatMoney, formatPhone, formatTime } from '@/lib/format';
import type { SameDayOrders } from '../../api/use-order-create';
import { orderStatusLabel, orderStatusTone } from '../../labels';

/**
 * Cảnh báo đơn trùng trong ngày (CSKH-5, C4 — cảnh báo, không chặn): khách cùng SĐT đã có đơn chưa
 * hủy hôm nay. Liệt kê đơn người dùng xem được; đơn của team khác chỉ thành một dòng đếm.
 * "Vẫn tạo đơn" gửi đúng đơn đang chờ (cùng Idempotency-Key), "Quay lại sửa" đóng hộp.
 */
export function SameDayDialog({
  data,
  phone,
  customerName,
  pending,
  onConfirm,
  onCancel,
}: {
  data: SameDayOrders;
  phone: string;
  customerName: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-weak text-warning"
              aria-hidden
            >
              <TriangleAlert className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>Khách này đã có {data.total} đơn hôm nay</DialogTitle>
              <DialogDescription>
                SĐT {formatPhone(phone)}
                {customerName ? ` · ${customerName}` : ''}. Kiểm tra để không giao trùng. Đơn chưa
                hủy, tính cả đơn từ Pancake.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {data.orders.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="h-8 px-2.5 text-left font-semibold">Số đơn</th>
                  <th className="h-8 px-2.5 text-left font-semibold">Giờ</th>
                  <th className="h-8 px-2.5 text-left font-semibold">Nguồn</th>
                  <th className="h-8 px-2.5 text-left font-semibold">Trạng thái</th>
                  <th className="h-8 px-2.5 text-right font-semibold">Tổng tiền</th>
                  <th className="h-8 px-2.5 text-left font-semibold">Người lên đơn</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="h-8 px-2.5">
                      <Link
                        href={`/crm/orders/${o.id}`}
                        target="_blank"
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {o.docNumber}
                      </Link>
                    </td>
                    <td className="h-8 px-2.5 tabular-nums">{formatTime(o.orderDate)}</td>
                    <td className="h-8 px-2.5">{o.source === 'PANCAKE' ? 'Pancake' : 'ERP'}</td>
                    <td className="h-8 px-2.5">
                      <StatusBadge tone={orderStatusTone(o.status)}>
                        {orderStatusLabel(o.status)}
                      </StatusBadge>
                    </td>
                    <td className="h-8 px-2.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                    <td className="h-8 px-2.5">{o.ownerName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data.hiddenCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.orders.length > 0 ? 'Và ' : ''}
            {data.hiddenCount} đơn của team khác — không xem được chi tiết.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Quay lại sửa
          </Button>
          <Button type="button" onClick={onConfirm} loading={pending} autoFocus>
            Vẫn tạo đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
