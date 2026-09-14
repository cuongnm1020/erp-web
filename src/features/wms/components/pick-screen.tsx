'use client';

import { CheckCircle2, CircleAlert, MapPin, Minus, Plus, WifiOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useScanSession } from '../scan-session';

/**
 * Màn pick trên trình duyệt máy PDA Android (PLAN-barcode-pick-pack D2, quyết định 1).
 * Một tay, theo DESIGN-BRIEF §6/§7.2: chạm ≥ 56 px, nút chính 72 px ở nửa dưới, chữ ≥ 16 px.
 * DataWedge xuất keystroke + Enter vào ô quét. Quét mã đơn / mã việc → nhận việc → dòng theo
 * lối đi (pickSequence) → quét SKU → đủ tự đóng dòng → xong đơn → quét đơn kế.
 * Không offline (app RN lo) — mất mạng thì banner cam, quét lại.
 */
export function PickScreen() {
  const ability = useAbility();
  const s = useScanSession('PICK');
  const scanRef = useRef<ScanInputHandle>(null);
  const [qty, setQty] = useState(1);

  if (!ability.can('execute', 'Task')) return <ForbiddenState className="m-4" />;

  const task = s.task;
  const current = task?.lines.find((l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED');
  const doneLines = task?.lines.filter((l) => l.status === 'COMPLETED').length ?? 0;

  const onScan = (code: string) => {
    if (s.phase === 'ready') {
      void s.scan(code, String(qty));
      setQty(1);
    } else if (s.phase === 'idle') {
      void s.open(code);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Lấy hàng</div>
          <div className="font-mono text-lg font-semibold">
            {task ? (s.order.docNumber ?? task.docNumber) : 'Chưa nhận việc'}
          </div>
        </div>
        {task ? (
          <div className="text-right text-sm text-muted-foreground">
            {doneLines}/{task.lines.length} dòng
          </div>
        ) : null}
      </header>

      {s.offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — quét lại khi có mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {s.feedback ? (
          <p
            role={s.feedback.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-3 font-medium',
              s.feedback.kind === 'error' &&
                'border-destructive/50 bg-destructive/10 text-destructive',
              s.feedback.kind === 'ok' && 'border-success/50 bg-success/10 text-success',
              s.feedback.kind === 'info' && 'border-info/50 bg-info/10 text-info',
            )}
          >
            {s.feedback.kind === 'error' ? (
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            )}
            {s.feedback.text}
          </p>
        ) : null}

        {s.phase === 'idle' && !task ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">Quét mã đơn để nhận việc</p>
            <p className="text-sm">Mã trên phiếu đơn hàng hoặc phiếu lấy hàng.</p>
          </div>
        ) : null}
        {s.phase === 'opening' ? (
          <p role="status" className="text-center text-muted-foreground">
            Đang nhận việc…
          </p>
        ) : null}

        {task && s.phase === 'ready' && current ? (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden />
              Vị trí
            </div>
            <div className="font-mono text-4xl font-bold leading-tight">
              {current.locationCode ?? '—'}
            </div>
            <div className="mt-3 text-lg font-semibold">{current.skuName}</div>
            <div className="font-mono text-sm text-muted-foreground">
              {current.skuCode}
              {current.lotNumber ? ` · lô ${current.lotNumber}` : ''}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">
                {formatQuantity(current.qtyRemaining)}
              </span>
              <span className="text-muted-foreground">
                còn lấy · đã {formatQuantity(current.qtyDone)}/{formatQuantity(current.qtyPlanned)}
              </span>
            </div>
          </section>
        ) : null}

        {task && s.phase === 'ready' ? (
          <ol className="flex flex-col gap-1 text-sm">
            {task.lines.map((l) => (
              <li
                key={l.taskLineId}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  l.status === 'COMPLETED' &&
                    'border-success/40 bg-success/5 text-muted-foreground',
                  l.taskLineId === current?.taskLineId && 'border-primary',
                )}
              >
                <span>
                  <span className="font-mono font-semibold">{l.locationCode ?? '—'}</span>{' '}
                  <span>{l.skuName}</span>
                </span>
                <span className="tabular-nums">
                  {formatQuantity(l.qtyDone)}/{formatQuantity(l.qtyPlanned)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {s.phase === 'done' && task ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="h-16 w-16 text-success" aria-hidden />
            <p className="text-2xl font-bold">Xong đơn {s.order.docNumber ?? task.docNumber}</p>
            <p className="text-muted-foreground">
              Chuyển hàng sang bàn đóng gói. Quét đơn kế tiếp.
            </p>
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        {task && s.phase === 'ready' ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Số lượng mỗi lần quét</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-14 w-14"
                aria-label="Giảm số lượng"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus aria-hidden />
              </Button>
              <span className="w-10 text-center text-2xl font-bold tabular-nums" aria-live="polite">
                {qty}
              </span>
              <Button
                variant="outline"
                className="h-14 w-14"
                aria-label="Tăng số lượng"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
        <ScanInput
          ref={scanRef}
          size="lg"
          label={task && s.phase === 'ready' ? 'Quét sản phẩm' : 'Quét mã đơn'}
          placeholder={task && s.phase === 'ready' ? 'Quét mã sản phẩm…' : 'Quét mã đơn / mã việc…'}
          onScan={onScan}
          disabled={s.phase === 'opening'}
        />
        {s.phase === 'done' ? (
          <Button className="h-[72px] text-lg" onClick={s.clear}>
            Quét đơn kế tiếp
          </Button>
        ) : task ? (
          <Button variant="outline" className="h-14" onClick={s.clear}>
            Bỏ việc đang mở
          </Button>
        ) : (
          <Button className="h-[72px] text-lg" onClick={() => scanRef.current?.focus()}>
            Quét mã vạch
          </Button>
        )}
      </footer>
    </div>
  );
}
