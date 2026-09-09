'use client';

import { Truck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { useBulkUpdateOrders, type SalesOrder } from '../api/use-orders';
import { orderEditable } from '../labels';
import { normalizeWeightInput } from './order-edit-screen';

const KEEP = '__keep__';
const NONE = '__none__';

/**
 * Hành động hàng loạt trên danh sách đơn: đặt cân nặng gửi hãng + gán hãng cho các đơn đã
 * chọn — một lượt cho cả lô (vd lọc đơn 1,2 kg → đặt 1 kg → gán GHTK). POST
 * /sales-orders/bulk-update; server sửa từng đơn, đơn hỏng về `failed` và được báo riêng.
 * Không optimistic (luật 5): chờ server rồi mới bỏ chọn và invalidate.
 */
export function BulkShippingDialog({ rows, onDone }: { rows: SalesOrder[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [carrierId, setCarrierId] = useState(KEEP);
  const [weight, setWeight] = useState('');
  const [clearWeight, setClearWeight] = useState(false);
  const carriers = useCarriers();
  const bulk = useBulkUpdateOrders();

  const editable = rows.filter((r) => orderEditable(r.status));
  const skipped = rows.length - editable.length;
  const nextWeight = normalizeWeightInput(weight);
  const weightInvalid = !clearWeight && weight.trim() !== '' && nextWeight === null;
  const carrierPatch = carrierId === KEEP ? undefined : carrierId === NONE ? null : carrierId;
  const weightPatch = clearWeight ? null : nextWeight === null ? undefined : nextWeight;
  const nothing = carrierPatch === undefined && weightPatch === undefined;

  const submit = async () => {
    if (nothing || weightInvalid || editable.length === 0 || bulk.isPending) return;
    try {
      const r = await bulk.mutateAsync({
        orderIds: editable.map((o) => o.id),
        ...(carrierPatch !== undefined ? { carrierId: carrierPatch } : {}),
        ...(weightPatch !== undefined ? { shippingWeightKg: weightPatch } : {}),
      });
      const failedDocs = r.failed.map((f) => f.docNumber ?? f.orderId.slice(0, 8)).join(', ');
      toast.success(`Đã cập nhật ${r.updated.length} đơn`, {
        description:
          r.failed.length > 0
            ? `${r.failed.length} đơn không sửa được: ${failedDocs}`
            : skipped > 0
              ? `${skipped} đơn đã chốt/hủy được bỏ qua`
              : undefined,
        duration: r.failed.length > 0 ? 10_000 : undefined,
      });
      setOpen(false);
      setCarrierId(KEEP);
      setWeight('');
      setClearWeight(false);
      onDone();
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <>
      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <Truck aria-hidden />
        Gán hãng / cân nặng
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gán hãng / cân nặng cho {rows.length} đơn</DialogTitle>
            <DialogDescription>
              Áp cùng một hãng và một cân nặng gửi hãng cho các đơn đã chọn. Để trống mục nào thì
              mục đó giữ nguyên.
              {skipped > 0 ? ` ${skipped} đơn đã chốt/hủy sẽ bị bỏ qua.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-carrier">Hãng vận chuyển</Label>
              <Select value={carrierId} onValueChange={setCarrierId} disabled={carriers.isPending}>
                <SelectTrigger id="bulk-carrier" aria-label="Hãng vận chuyển" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>— Giữ nguyên —</SelectItem>
                  <SelectItem value={NONE}>— Bỏ chọn hãng —</SelectItem>
                  {(carriers.data ?? [])
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-weight">Cân nặng gửi hãng (kg)</Label>
              <Input
                id="bulk-weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder="vd 1 hoặc 1,2 — trống = giữ nguyên"
                aria-invalid={weightInvalid || undefined}
                disabled={clearWeight}
                className="h-9 text-right tabular-nums"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
              {weightInvalid ? (
                <p className="text-xs text-destructive">
                  Nhập số kg lớn hơn 0, tối đa 4 số lẻ (vd 0,5 hay 1.25)
                </p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={clearWeight}
                  onCheckedChange={(v) => setClearWeight(v === true)}
                  aria-label="Bỏ cân nặng đặt tay"
                />
                Bỏ cân nặng đặt tay — hãng nhận Σ cân nặng SKU của từng đơn
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={bulk.isPending}>
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={nothing || weightInvalid || editable.length === 0 || bulk.isPending}
            >
              {bulk.isPending ? 'Đang cập nhật…' : `Cập nhật ${editable.length} đơn`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
