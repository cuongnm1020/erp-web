'use client';

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Info,
  MapPin,
  Minus,
  Plus,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { usePdaQueue, usePdaStats } from '../api/use-pda';
import { currentPutAwayLine, isFullyScanned, usePutAwaySession } from '../put-away-session';
import { SkuBarcodes } from './sku-barcodes';

/**
 * Màn cất hàng trên trình duyệt máy PDA (task PUT_AWAY sinh khi post phiếu nhập; bin đích do
 * P1-08 gợi ý theo SKU cố định → gom cùng SKU → bin trống). Một tay như màn pick: chạm ≥ 56 px,
 * nút chính 72 px ở nửa dưới, chữ ≥ 16 px.
 *
 * Luồng: chạm việc trong hàng đợi (hoặc quét mã PUT…) → nhận → mỗi dòng: lấy hàng ở vị trí
 * nhận (DOCK), quét sản phẩm đủ số lượng, đem tới ô kệ đích, quét mã ô kệ (hoặc bấm "Đã cất
 * vào …") → server chuyển tồn DOCK → bin. Hết dòng → việc xong. Dòng không có ô kệ (kho hết
 * chỗ trống, EXCEPTION) hiện mờ để điều phối chỉ định — máy quét không làm được.
 */
export function PutAwayScreen() {
  const ability = useAbility();
  const s = usePutAwaySession();
  const scanRef = useRef<ScanInputHandle>(null);
  const [qty, setQty] = useState(1);
  const canExecute = ability.can('execute', 'Task');
  const queue = usePdaQueue('PUT_AWAY', canExecute);
  const doneToday = usePdaStats('PUT_AWAY', null, canExecute);
  const idle = s.phase === 'idle';
  useEffect(() => {
    // Quay về màn chờ (sau "Việc kế tiếp") → làm tươi hai cột ngay, không đợi 30s.
    if (idle && canExecute) {
      void queue.refetch();
      void doneToday.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, canExecute]);

  if (!canExecute) return <ForbiddenState className="m-4" />;

  const { phase, feedback, task } = s;
  const current = currentPutAwayLine(task);
  const awaitingBin = current !== null && isFullyScanned(current);

  const onScan = (code: string) => {
    if (phase === 'ready') {
      void s.scan(code, String(qty));
      setQty(1);
    } else if (phase === 'idle') {
      void s.open(code);
    }
  };

  const clear = () => {
    s.clear();
    setQty(1);
    scanRef.current?.focus();
  };

  const progress = task
    ? `${task.lines.filter((l) => l.status === 'COMPLETED').length}/${task.lines.length} dòng`
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Cất hàng</div>
          <div className="font-mono text-lg font-semibold">
            {task?.docNumber ?? 'Chưa nhận việc'}
          </div>
        </div>
        {progress ? (
          <div className="text-right text-sm text-muted-foreground">{progress}</div>
        ) : null}
      </header>

      {s.offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — quét lại khi có mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {feedback ? (
          <p
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-3 font-medium',
              feedback.kind === 'error' &&
                'border-destructive/50 bg-destructive/10 text-destructive',
              feedback.kind === 'warn' && 'border-warning/60 bg-warning/10 text-warning-foreground',
              feedback.kind === 'ok' && 'border-success/50 bg-success/10 text-success',
              feedback.kind === 'info' && 'border-info/50 bg-info/10 text-info',
            )}
          >
            {feedback.kind === 'error' ? (
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden />
            ) : feedback.kind === 'info' ? (
              <Info className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            )}
            {feedback.text}
          </p>
        ) : null}

        {phase === 'idle' ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col items-center gap-1 py-2 text-center text-muted-foreground">
              <p className="text-lg font-medium text-foreground">Chạm một việc để cất hàng</p>
              <p className="text-sm">
                Hoặc quét mã phiếu cất hàng (PUT…). Việc sinh ra khi phiếu nhập được post.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Column
                title="Hàng đợi cất hàng"
                hint={queue.data ? `${queue.data.waiting} chờ · ${queue.data.mine} của tôi` : ''}
                count={queue.data?.items.length ?? null}
                error={queue.isError}
                empty="Chưa có việc cất hàng — hàng nhập đã cất hết."
              >
                {queue.data?.items.map((q) => (
                  <li key={q.taskId}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => void s.openTask(q.taskId)}
                      aria-label={`Mở ${q.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">{q.docNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {q.lineCount} dòng · chờ {q.ageMinutes} phút
                        </span>
                      </span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-xs font-medium',
                          q.assignedToMe
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {q.assignedToMe
                          ? q.status === 'IN_PROGRESS'
                            ? 'Đang cất'
                            : 'Của tôi'
                          : 'Chưa ai nhận'}
                      </span>
                    </button>
                  </li>
                ))}
              </Column>
              <Column
                title="Đã cất xong hôm nay"
                hint={doneToday.data?.date ?? ''}
                count={doneToday.data?.completed ?? null}
                error={doneToday.isError}
                empty="Hôm nay chưa cất xong việc nào."
              >
                {doneToday.data?.items.map((d) => (
                  <li
                    key={d.taskId}
                    className="flex min-h-12 items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="font-mono font-semibold">{d.docNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(d.completedAt)}
                    </span>
                  </li>
                ))}
              </Column>
            </div>
          </div>
        ) : null}
        {phase === 'opening' ? (
          <p role="status" className="text-center text-muted-foreground">
            Đang nhận việc…
          </p>
        ) : null}

        {phase === 'ready' && current ? (
          <section
            className={cn('rounded-lg border bg-card p-4', awaitingBin && 'border-primary')}
            aria-label="Dòng đang cất"
          >
            <div className="flex items-end gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Lấy ở
                </div>
                <div className="truncate font-mono text-2xl font-semibold leading-tight">
                  {current.locationCode ?? '—'}
                </div>
              </div>
              <ArrowRight className="mb-1 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Cất vào</div>
                <div className="truncate font-mono text-4xl font-bold leading-tight">
                  {current.toLocationCode ?? '—'}
                </div>
              </div>
            </div>
            <div className="mt-3 text-lg font-semibold">{current.skuName}</div>
            <div className="font-mono text-sm text-muted-foreground">
              {current.skuCode}
              {current.lotNumber ? ` · lô ${current.lotNumber}` : ''}
            </div>
            <SkuBarcodes barcodes={current.barcodes} />
            {awaitingBin ? (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 font-medium"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                Đã quét đủ {formatQuantity(current.qtyPlanned)} — quét mã ô kệ{' '}
                {current.toLocationCode ?? '—'} để xác nhận cất.
              </p>
            ) : (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl font-bold tabular-nums">
                  {formatQuantity(current.qtyRemaining)}
                </span>
                <span className="text-muted-foreground">
                  còn quét · đã {formatQuantity(current.qtyDone)}/
                  {formatQuantity(current.qtyPlanned)}
                </span>
              </div>
            )}
          </section>
        ) : null}

        {phase === 'ready' && task ? (
          <ol className="flex flex-col gap-1 text-sm">
            {task.lines.map((l) => (
              <li
                key={l.taskLineId}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  l.status === 'COMPLETED' &&
                    'border-success/40 bg-success/5 text-muted-foreground',
                  l.status === 'EXCEPTION' && 'border-warning/60 bg-warning/10',
                  l.taskLineId === current?.taskLineId && 'border-primary',
                )}
              >
                <span>
                  <span className="font-mono font-semibold">{l.toLocationCode ?? '—'}</span>{' '}
                  <span>{l.skuName}</span>
                  {l.status === 'EXCEPTION' ? (
                    <span className="ml-1 text-xs text-warning-foreground">
                      · chưa có ô kệ — điều phối chỉ định
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums">
                  {formatQuantity(l.qtyDone)}/{formatQuantity(l.qtyPlanned)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {phase === 'done' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="h-16 w-16 text-success" aria-hidden />
            <p className="text-2xl font-bold">Xong {task?.docNumber ?? 'việc'}</p>
            <p className="text-muted-foreground">
              Hàng đã về ô kệ — lấy hàng sẽ đi đúng chỗ. Chạm việc kế tiếp.
            </p>
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        {phase === 'ready' && !awaitingBin ? (
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
          label={phase === 'ready' ? (awaitingBin ? 'Quét ô kệ' : 'Quét sản phẩm') : 'Quét mã việc'}
          placeholder={
            phase === 'ready'
              ? awaitingBin
                ? `Quét mã ô kệ ${current?.toLocationCode ?? ''}…`
                : 'Quét mã sản phẩm…'
              : 'Quét mã phiếu cất hàng…'
          }
          onScan={onScan}
          disabled={phase === 'opening'}
        />
        {phase === 'done' ? (
          <Button className="h-[72px] text-lg" onClick={clear}>
            Việc kế tiếp
          </Button>
        ) : phase === 'ready' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-14"
              disabled={!awaitingBin || s.busy}
              onClick={() => current && void s.confirm(current.taskLineId)}
            >
              Đã cất vào {current?.toLocationCode ?? '—'}
            </Button>
            <Button variant="outline" className="h-14" onClick={clear}>
              Bỏ việc đang mở
            </Button>
          </div>
        ) : (
          <Button className="h-[72px] text-lg" onClick={() => scanRef.current?.focus()}>
            Quét mã vạch
          </Button>
        )}
      </footer>
    </div>
  );
}

/** Một cột trên màn chờ: tiêu đề + đếm + danh sách chạm được. */
function Column({
  title,
  hint,
  count,
  error,
  empty,
  children,
}: {
  title: string;
  hint: string;
  count: number | null;
  error: boolean;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card" aria-label={title}>
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="font-semibold">
          {title}
          {count !== null ? ` · ${count}` : ''}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </header>
      {error ? (
        <p className="px-3 py-3 text-sm text-destructive">Không tải được danh sách.</p>
      ) : count === null ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : count === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}
