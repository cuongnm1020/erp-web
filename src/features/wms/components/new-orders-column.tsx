'use client';

import Decimal from 'decimal.js';
import { CheckSquare, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import { usePdaNewOrders, useTakeNewOrders } from '../api/use-pda';
import { PdaListColumn } from './pda-list-column';

/** Cân nặng kg: tối đa 2 số lẻ, dấu phẩy thập phân (luật 10 — qua util tập trung). */
const kg = (v: string) => formatQuantity(v, { maxDp: 2, unit: 'kg' });

/**
 * Cột "Đơn mới" của màn chờ `/pda/pick` (spec `docs/screens/FE-PDA-2-new-orders-handover.md` §1,
 * luồng `apps/api/docs/pick-pack-flow.md` §7): đơn chưa ai giữ đã "Gửi sang ĐVVC", giá trị cao
 * trước. Chạm dòng = chọn; tổng cân nặng các đơn đã chọn cộng bằng decimal.js. "Lấy N đơn" nhận cả
 * lô — người sau 409 PDA_NEW_ORDERS_TAKEN → bỏ chọn hết, tải lại, chọn lại.
 */
export function NewOrdersColumn({
  enabled,
  blocked,
  onTaken,
  onHandoverRequired,
}: {
  enabled: boolean;
  /** Còn đơn đã lấy xong chưa giao người đóng gói → không lấy thêm (server cũng chặn). */
  blocked: boolean;
  onTaken: () => void;
  onHandoverRequired: () => void;
}) {
  const query = usePdaNewOrders(enabled);
  const take = useTakeNewOrders();
  const [selected, setSelected] = useState<string[]>([]);
  // Luật 4: key sinh lúc bấm, giữ khi bấm lại CÙNG tập đơn (mạng rớt → server trả kết quả cũ).
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const data = query.data;

  // Đơn đã chọn không còn trong danh sách (người khác vừa lấy) → bỏ chọn.
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((i) => i.taskId));
    setSelected((s) => (s.every((id) => ids.has(id)) ? s : s.filter((id) => ids.has(id))));
  }, [data]);

  const byId = useMemo(() => new Map((data?.items ?? []).map((i) => [i.taskId, i])), [data]);
  const room = data ? Math.max(0, data.limit - data.holding) : 0;
  const weight = selected
    .reduce((acc, id) => acc.plus(new Decimal(byId.get(id)?.weightKg ?? '0')), new Decimal(0))
    .toFixed(4);

  const toggle = (taskId: string) => {
    if (selected.includes(taskId)) {
      setSelected(selected.filter((id) => id !== taskId));
      return;
    }
    if (selected.length >= room) {
      toast.error(
        `Chỉ chọn thêm được ${room} đơn (đang giữ ${data?.holding ?? 0}/${data?.limit ?? 0}).`,
      );
      return;
    }
    setSelected([...selected, taskId]);
  };

  const onTake = () => {
    if (selected.length === 0 || take.isPending) return;
    const taskIds = [...selected];
    const sig = [...taskIds].sort().join(',');
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };
    take.mutate(
      { taskIds, idempotencyKey: keyRef.current.key },
      {
        onSuccess: (r) => {
          keyRef.current = null;
          setSelected([]);
          toast.success(`Đã lấy ${r.taskIds.length} đơn`);
          onTaken();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'PDA_NEW_ORDERS_TAKEN') {
            keyRef.current = null;
            setSelected([]);
            const docs = (err.details as { docNumbers?: unknown } | null | undefined)?.docNumbers;
            toast.error(
              Array.isArray(docs) && docs.length > 0
                ? `Đơn ${docs.join(', ')} đã có người lấy hoặc không còn chờ lấy. Danh sách đã tải lại — chọn lại.`
                : messageFor(err),
            );
            void query.refetch();
            return;
          }
          if (err instanceof ApiError && err.code === 'PDA_HANDOVER_PENDING') {
            keyRef.current = null;
            onHandoverRequired();
          }
          toast.error(messageFor(err));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <PdaListColumn
        title="Đơn mới"
        hint={data ? `đang giữ ${data.holding}/${data.limit} · giá trị cao trước` : ''}
        count={data?.total ?? (query.isError ? 0 : null)}
        error={query.isError}
        empty="Chưa có đơn mới — đơn hiện ở đây khi sale đã Gửi sang ĐVVC."
      >
        {data?.items.map((o) => {
          const on = selected.includes(o.taskId);
          return (
            <li key={o.taskId}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`${o.docNumber}, ${o.skuCount} SKU, ${kg(o.weightKg)}`}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted',
                  on && 'bg-secondary',
                )}
                onClick={() => toggle(o.taskId)}
              >
                {on ? (
                  <CheckSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Square className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="flex flex-col">
                  <span className="font-mono font-semibold">{o.docNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.skuCount} SKU · {kg(o.weightKg)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </PdaListColumn>
      <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2">
        <p className="text-center text-base font-semibold" data-testid="new-orders-total">
          {selected.length > 0
            ? `Đã chọn ${selected.length} đơn · ${kg(weight)}`
            : 'Chạm vào đơn để chọn'}
        </p>
        <Button
          className="h-14 text-base"
          disabled={selected.length === 0 || blocked || take.isPending}
          onClick={onTake}
        >
          {take.isPending
            ? 'Đang lấy đơn…'
            : selected.length > 0
              ? `Lấy ${selected.length} đơn`
              : 'Lấy đơn'}
        </Button>
      </div>
    </div>
  );
}
