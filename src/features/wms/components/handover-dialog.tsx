'use client';

import { CircleDot, Circle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { useHandoverToPacker, usePdaHandoverState, usePdaPackers } from '../api/use-pda';

/**
 * "Giao người đóng gói" trên `/pda/pick` (spec `docs/screens/FE-PDA-2-new-orders-handover.md` §3,
 * luồng `apps/api/docs/pick-pack-flow.md` §10). Bắt buộc sau khi lấy xong: giao TẤT CẢ đơn đã lấy
 * xong cho một người đóng gói cùng kho. `change` = đổi người của lần giao gần nhất (chuyển hết
 * đơn chưa bắt đầu đóng). Người đóng gói đã nhận thì người khác không mở được đơn đó.
 */
export function HandoverDialog({
  open,
  onOpenChange,
  change = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  change?: boolean;
}) {
  const state = usePdaHandoverState(open);
  const latest = state.data?.latest ?? null;
  const warehouseId = change
    ? (latest?.warehouseId ?? null)
    : (state.data?.pendingWarehouseId ?? null);
  const packersQ = usePdaPackers(open ? warehouseId : null);
  const submit = useHandoverToPacker();
  const [picked, setPicked] = useState<string | null>(null);
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  const orders = change ? (latest?.orders ?? []) : (state.data?.pending ?? []);
  const count = change ? (latest?.changeable ?? 0) : orders.length;
  const packers = (packersQ.data ?? []).filter((p) => !change || p.id !== latest?.packer.id);
  const target = packers.find((p) => p.id === picked) ?? null;
  const docs = orders.map((o) => o.docNumber);
  const docLine =
    docs.length > 5 ? `${docs.slice(0, 5).join(' · ')} · +${docs.length - 5}` : docs.join(' · ');

  const onSubmit = () => {
    if (!target || submit.isPending) return;
    const handoverId = change ? (latest?.id ?? null) : null;
    const sig = `${handoverId ?? 'new'}:${target.id}`;
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };
    submit.mutate(
      { handoverId, packerId: target.id, idempotencyKey: keyRef.current.key },
      {
        onSuccess: (h) => {
          keyRef.current = null;
          toast.success(
            change
              ? `Đã chuyển ${h.changeable} đơn sang ${h.packer.fullName}`
              : `Đã giao ${h.orders.length} đơn cho ${h.packer.fullName}`,
          );
          onOpenChange(false);
        },
        onError: (err) => {
          if (
            err instanceof ApiError &&
            (err.code === 'PDA_HANDOVER_EMPTY' || err.code === 'PDA_INVALID_PACKER')
          ) {
            keyRef.current = null;
            void state.refetch();
            void packersQ.refetch();
          }
          toast.error(messageFor(err));
        },
      },
    );
  };

  const loading = state.isLoading || (warehouseId !== null && packersQ.isLoading);
  const error = state.isError || packersQ.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{change ? 'Đổi người đóng gói' : 'Giao người đóng gói'}</DialogTitle>
          <DialogDescription>
            {change
              ? `Đang giao cho ${latest?.packer.fullName ?? '—'} · ${count} đơn còn đổi được`
              : `${count} đơn đã lấy xong — chọn người đóng gói nhận tất cả.`}
          </DialogDescription>
        </DialogHeader>
        {docLine ? <p className="font-mono text-sm text-muted-foreground">{docLine}</p> : null}
        {!change && (state.data?.openPicks ?? 0) > 0 ? (
          <p className="text-sm text-warning">
            Bạn còn {state.data?.openPicks} đơn đang lấy dở — đơn đó giao ở lần sau.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Không tải được danh sách.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void state.refetch();
                void packersQ.refetch();
              }}
            >
              Thử lại
            </button>
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">
            {change
              ? 'Không còn đơn nào đổi người được (đã bắt đầu đóng gói).'
              : 'Không có đơn nào chờ giao người đóng gói.'}
          </p>
        ) : packers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kho chưa có người đóng gói nào được gán kho làm việc — gán ở Quản trị → Nhân viên.
          </p>
        ) : (
          <ul role="radiogroup" aria-label="Người đóng gói" className="flex flex-col gap-2">
            {packers.map((p) => {
              const on = p.id === picked;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left hover:bg-muted',
                      on && 'border-primary bg-primary/10',
                    )}
                    onClick={() => setPicked(p.id)}
                  >
                    {on ? (
                      <CircleDot className="h-5 w-5 text-primary" aria-hidden />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                    <span className="flex flex-col">
                      <span className="font-semibold">{p.fullName}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button disabled={!target || count === 0 || submit.isPending} onClick={onSubmit}>
            {submit.isPending
              ? 'Đang giao…'
              : target
                ? change
                  ? `Chuyển ${count} đơn cho ${target.fullName}`
                  : `Giao ${count} đơn cho ${target.fullName}`
                : 'Chọn người đóng gói'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
