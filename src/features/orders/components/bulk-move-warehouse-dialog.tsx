'use client';

import { ArrowRightLeft } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor, messageForCode } from '@/lib/error-messages';
import { useWarehouse } from '@/lib/warehouse';
import { useMoveOrdersWarehouse, type SalesOrder } from '../api/use-orders';

/**
 * Chuyển các đơn đã chọn sang kho khác — POST /sales-orders/move-warehouse (PLAN-warehouse-context
 * K3). Chỉ đơn chưa ai bắt đầu lấy hàng (trạng thái kho "Chưa xử lý"); đơn khác bỏ qua ngay ở
 * client, server kiểm lại từng đơn và trả lý do đơn không chuyển được. Không optimistic (luật 5).
 */
export function BulkMoveWarehouseDialog({
  rows,
  onDone,
}: {
  rows: SalesOrder[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [failures, setFailures] = useState<{ doc: string; reason: string }[]>([]);
  const { options } = useWarehouse();
  const move = useMoveOrdersWarehouse();

  const movable = rows.filter(
    (r) =>
      r.status !== 'CANCELLED' &&
      r.status !== 'POSTED' &&
      (r.fulfilmentStatus === null || r.fulfilmentStatus === 'NOT_STARTED'),
  );
  const skipped = rows.length - movable.length;

  const submit = async () => {
    if (!target || movable.length === 0 || move.isPending) return;
    try {
      const r = await move.mutateAsync({
        orderIds: movable.map((o) => o.id),
        warehouseId: target,
      });
      const moved = r.moved.filter((m) => m.outcome === 'MOVED');
      const waiting = moved.filter((m) => m.awaitingStock).length;
      toast.success(`Đã chuyển ${moved.length} đơn sang ${nameOf(target)}`, {
        description:
          waiting > 0
            ? `${waiting} đơn Pancake thiếu hàng ở kho mới — đơn chờ hàng về.`
            : 'Hàng đã giữ ở kho mới, việc lấy hàng đã lập lại theo kho mới.',
      });
      if (r.failed.length > 0) {
        setFailures(
          r.failed.map((f) => ({
            doc: f.docNumber ?? f.orderId.slice(0, 8),
            reason: messageForCode(f.code, 409),
          })),
        );
        return;
      }
      close();
      onDone();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? 'kho mới';
  const close = () => {
    setOpen(false);
    setTarget('');
    setFailures([]);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
        disabled={options.length < 2}
      >
        <ArrowRightLeft aria-hidden />
        Chuyển kho
      </Button>
      <Dialog open={open} onOpenChange={(o) => !move.isPending && (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển {movable.length} đơn sang kho khác</DialogTitle>
            <DialogDescription>
              Hàng đang giữ ở kho cũ được nhả và giữ lại ở kho mới; việc lấy hàng lập lại theo kho
              mới. Chỉ chuyển được đơn kho chưa bắt đầu lấy hàng.
              {skipped > 0 ? ` ${skipped} đơn đã bắt đầu lấy hàng / đã kết thúc sẽ bị bỏ qua.` : ''}
            </DialogDescription>
          </DialogHeader>
          {failures.length > 0 ? (
            <div className="space-y-1 rounded-md border border-destructive-line p-2 text-sm">
              <p className="font-medium text-destructive">
                {failures.length} đơn không chuyển được:
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {failures.map((f) => (
                  <li key={f.doc}>
                    <span className="font-mono">{f.doc}</span> — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-move-warehouse">Chuyển tới kho</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="bulk-move-warehouse" aria-label="Chuyển tới kho">
                  <SelectValue placeholder="Chọn kho" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            {failures.length > 0 ? (
              <Button
                onClick={() => {
                  close();
                  onDone();
                }}
              >
                Đóng
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled={move.isPending} onClick={close}>
                  Không chuyển
                </Button>
                <Button
                  disabled={move.isPending || !target || movable.length === 0}
                  onClick={() => void submit()}
                >
                  {move.isPending ? 'Đang chuyển…' : `Chuyển ${movable.length} đơn`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
