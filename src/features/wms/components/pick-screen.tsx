'use client';

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleAlert,
  Layers,
  MapPin,
  PackageX,
  Warehouse,
  WifiOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { beep } from '@/lib/beep';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  usePdaMyTasks,
  usePdaMyWaves,
  usePdaQueue,
  usePdaStats,
  useResolveCode,
} from '../api/use-pda';
import { useScanSession, type ScanFeedback, type Shortage } from '../scan-session';
import { useScanQty } from '../use-scan-qty';
import { useWaveSession } from '../wave-session';
import { PdaListColumn } from './pda-list-column';
import { ScanQtyBar } from './scan-qty-bar';
import { ShortPickDialog } from './short-pick-dialog';
import { ContainerHint } from './container-hint';
import { SkuBarcodes } from './sku-barcodes';
import { SkuIdentity, SkuThumb } from './sku-identity';

type Mode = 'task' | 'wave';

/**
 * Màn pick trên trình duyệt máy PDA Android (PLAN-barcode-pick-pack D2 + E3, quyết định 1, 4).
 * Một tay theo DESIGN-BRIEF §6/§7.2: chạm ≥ 56 px, nút chính 72 px ở nửa dưới, chữ ≥ 16 px.
 * Quét mã đơn / mã việc → việc đơn lẻ; quét mã WAVE → lượt gộp (nhóm theo vị trí, server tự
 * chia về từng đơn). Thiếu hàng → nút "Thiếu hàng" → cảnh báo vàng giữ trên màn, phần thiếu
 * không sang đóng gói, điều phối nhận cảnh báo. Không offline (app RN lo).
 *
 * 2026-09-22: quét mã SKU → nhập số lượng → Enter (lấy 30 một lần, không bấm +/−); thẻ dòng
 * đang lấy hiện ảnh + tên thương mại + vị trí + "trên kệ còn N" (server tính = tồn bin − đã
 * lấy chưa đóng gói, bất biến 3 — pick không chạm ledger).
 *
 * 2026-10-01: màn chờ hiện thêm cột "Việc cất hàng" (hàng đợi PUT_AWAY: của tôi + chưa ai nhận)
 * để người lấy hàng thấy cả việc lấy và việc cất trên một màn. Chạm / quét mã PUT… → chuyển sang
 * /pda/put-away?task=… (màn cất hàng tự nhận việc), không gộp luồng cất vào phiên pick.
 */
export function PickScreen() {
  const ability = useAbility();
  const router = useRouter();
  const resolve = useResolveCode();
  const task = useScanSession('PICK');
  const wave = useWaveSession();
  const scanRef = useRef<ScanInputHandle>(null);
  const [mode, setMode] = useState<Mode>('task');
  const scanQty = useScanQty({
    lines: mode === 'wave' ? (wave.wave?.lines ?? []) : (task.task?.lines ?? []),
    send: (code, qty) => void (mode === 'wave' ? wave : task).scan(code, qty),
  });
  const [shortOpen, setShortOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const canExecute = ability.can('execute', 'Task');
  // Hai cột khi chưa nhận việc: việc điều phối đã giao cho tôi + đơn tôi đã lấy xong hôm nay.
  const myTasks = usePdaMyTasks(canExecute);
  const myWaves = usePdaMyWaves(canExecute);
  const doneToday = usePdaStats('PICK', null, canExecute);
  const putQueue = usePdaQueue('PUT_AWAY', canExecute);
  const idle = !resolving && task.phase === 'idle' && wave.phase === 'idle';
  useEffect(() => {
    // Quay về màn chờ (sau "Quét đơn kế tiếp") → làm tươi hai cột ngay, không đợi 30s.
    if (idle && canExecute) {
      void myTasks.refetch();
      void myWaves.refetch();
      void doneToday.refetch();
      void putQueue.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, canExecute]);

  if (!canExecute) return <ForbiddenState className="m-4" />;

  const s = mode === 'wave' ? wave : task;
  const phase = resolving ? 'opening' : s.phase;
  const feedback: ScanFeedback | null = resolveError
    ? { kind: 'error', text: resolveError }
    : s.feedback;
  const shortages: Shortage[] = s.shortages;
  const offline = task.offline || wave.offline;

  const openPutAway = (taskId: string) => {
    router.push(`/pda/put-away?task=${encodeURIComponent(taskId)}`);
  };

  const openCode = async (code: string) => {
    setResolving(true);
    setResolveError(null);
    try {
      const r = await resolve.mutateAsync(code);
      if (r.kind === 'task' && r.task?.type === 'PUT_AWAY') {
        openPutAway(r.task.id);
        return;
      }
      if (r.kind === 'wave' && r.wave) {
        setMode('wave');
        task.clear();
        await wave.open(r.wave.id);
      } else {
        setMode('task');
        wave.clear();
        await task.openResolved(r, code);
      }
    } catch (err) {
      beep('error');
      setResolveError(messageFor(err));
    } finally {
      setResolving(false);
    }
  };

  const onScan = (code: string) => {
    if (phase === 'ready') {
      scanQty.onScan(code);
    } else if (phase === 'idle') {
      void openCode(code);
    }
  };

  const clear = () => {
    task.clear();
    wave.clear();
    scanQty.reset();
    setResolveError(null);
    setMode('task');
    scanRef.current?.focus();
  };

  // Dòng / nhóm đang đứng — vị trí to, còn lấy bao nhiêu.
  const currentTask =
    mode === 'task'
      ? (task.task?.lines.find(
          (l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED' && l.status !== 'EXCEPTION',
        ) ?? null)
      : null;
  const currentWave = mode === 'wave' ? wave.current : null;
  const heading =
    mode === 'wave'
      ? (wave.wave?.docNumber ?? 'Chưa nhận việc')
      : task.task
        ? (task.order.docNumber ?? task.task.docNumber)
        : 'Chưa nhận việc';
  const progress =
    mode === 'wave' && wave.wave
      ? `${wave.wave.taskDoneCount}/${wave.wave.taskCount} đơn · ${wave.wave.lines.filter((g) => g.complete).length}/${wave.wave.lines.length} nhóm`
      : task.task
        ? `${task.task.lines.filter((l) => l.status === 'COMPLETED' || l.status === 'EXCEPTION').length}/${task.task.lines.length} dòng`
        : null;
  const shortWhat = currentWave
    ? `${currentWave.skuCode} · ${currentWave.skuName} tại ${currentWave.locationCode ?? '—'} (${currentWave.shares.length} đơn)`
    : currentTask
      ? `${currentTask.skuCode} · ${currentTask.skuName} tại ${currentTask.locationCode ?? '—'}`
      : '';
  const shortRemaining = currentWave?.qtyRemaining ?? currentTask?.qtyRemaining ?? '0';
  // GET /pda/tasks trả mọi loại việc còn mở của tôi — màn này chỉ là lấy hàng.
  // Việc lẻ: PICK không thuộc lượt. Đơn con của lượt gộp KHÔNG rải ra đây — lượt là một mục riêng.
  const myPicks = myTasks.data?.filter((t) => t.type === 'PICK' && !t.waveId) ?? null;
  const myWaveItems = myWaves.data?.items ?? null;
  const assignedCount =
    myPicks === null && myWaveItems === null
      ? null
      : (myPicks?.length ?? 0) + (myWaveItems?.length ?? 0);

  // Chạm mục "Lượt" → nhận cả lượt (POST /pda/waves/:id/claim), không qua resolve.
  const openWave = async (waveId: string) => {
    setResolveError(null);
    setMode('wave');
    task.clear();
    await wave.open(waveId);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            {mode === 'wave' ? <Layers className="h-3 w-3" aria-hidden /> : null}
            {mode === 'wave' ? 'Lượt lấy gộp' : 'Lấy hàng'}
          </div>
          <div className="font-mono text-lg font-semibold">{heading}</div>
        </div>
        {progress ? (
          <div className="text-right text-sm text-muted-foreground">{progress}</div>
        ) : null}
      </header>

      {offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — quét lại khi có mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {shortages.length > 0 ? (
          <aside
            role="status"
            aria-label="Cảnh báo thiếu hàng"
            className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
              Thiếu hàng {shortages.length} {mode === 'wave' ? 'nhóm' : 'dòng'} — đã báo điều phối
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {shortages.map((x) => (
                <li key={x.taskLineId} className="flex justify-between gap-2">
                  <span>
                    <span className="font-mono">{x.skuCode}</span> {x.skuName}
                    {x.note !== 'Thiếu hàng' ? ` · ${x.note}` : ''}
                  </span>
                  <span className="tabular-nums">thiếu {formatQuantity(x.shortageQty)}</span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

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
            ) : feedback.kind === 'warn' ? (
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            )}
            {feedback.text}
          </p>
        ) : null}

        {phase === 'idle' ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col items-center gap-1 py-2 text-center text-muted-foreground">
              <p className="text-lg font-medium text-foreground">Quét mã đơn để nhận việc</p>
              <p className="text-sm">
                Mã trên phiếu đơn hàng, phiếu lấy hàng, phiếu lượt gộp hoặc phiếu cất hàng — hoặc
                chạm một việc bên dưới.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PdaListColumn
                title="Việc được giao"
                hint="chưa lấy xong"
                count={assignedCount}
                error={myTasks.isError || myWaves.isError}
                empty="Chưa có việc nào được giao — điều phối sẽ gán trên bảng điều phối."
              >
                {myWaveItems?.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => void openWave(w.id)}
                      aria-label={`Mở lượt ${w.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1 font-mono font-semibold">
                          <Layers className="h-4 w-4 text-primary" aria-hidden />
                          {w.docNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Lượt gộp · {w.taskDoneCount}/{w.taskCount} đơn
                        </span>
                      </span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-xs font-medium',
                          w.status === 'IN_PROGRESS'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {w.status === 'IN_PROGRESS' ? 'Đang lấy' : 'Chưa bắt đầu'}
                      </span>
                    </button>
                  </li>
                ))}
                {myPicks?.map((t) => (
                  <li key={t.taskId}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => void openCode(t.refDocNumber ?? t.docNumber)}
                      aria-label={`Mở ${t.refDocNumber ?? t.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">
                          {t.refDocNumber ?? t.docNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.docNumber} · {t.lines.length} dòng
                        </span>
                      </span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-xs font-medium',
                          t.status === 'IN_PROGRESS'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {t.status === 'IN_PROGRESS' ? 'Đang lấy' : 'Chưa bắt đầu'}
                      </span>
                    </button>
                  </li>
                ))}
              </PdaListColumn>
              <PdaListColumn
                title="Việc cất hàng"
                hint={
                  putQueue.data
                    ? `${putQueue.data.waiting} chờ · ${putQueue.data.mine} của tôi`
                    : ''
                }
                count={putQueue.data?.items.length ?? null}
                error={putQueue.isError}
                empty="Chưa có việc cất hàng — hàng nhập đã cất hết."
              >
                {putQueue.data?.items.map((q) => (
                  <li key={q.taskId}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => openPutAway(q.taskId)}
                      aria-label={`Cất hàng ${q.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1 font-mono font-semibold">
                          <Warehouse className="h-4 w-4 text-primary" aria-hidden />
                          {q.docNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Cất hàng · {q.lineCount} dòng · chờ {q.ageMinutes} phút
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
              </PdaListColumn>
              <PdaListColumn
                title="Đã lấy xong hôm nay"
                hint={doneToday.data?.date ?? ''}
                count={doneToday.data?.completed ?? null}
                error={doneToday.isError}
                empty="Hôm nay chưa lấy xong đơn nào."
              >
                {doneToday.data?.items.map((d) => (
                  <li
                    key={d.taskId}
                    className="flex min-h-12 items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="flex flex-col">
                      <span className="font-mono font-semibold">
                        {d.refDocNumber ?? d.docNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">{d.docNumber}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(d.completedAt)}
                    </span>
                  </li>
                ))}
              </PdaListColumn>
            </div>
          </div>
        ) : null}
        {phase === 'opening' ? (
          <p role="status" className="text-center text-muted-foreground">
            Đang nhận việc…
          </p>
        ) : null}

        {phase === 'ready' && (currentTask || currentWave) ? (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden />
              Vị trí
            </div>
            <div className="font-mono text-4xl font-bold leading-tight">
              {(currentWave ?? currentTask)!.locationCode ?? '—'}
            </div>
            <SkuIdentity sku={(currentWave ?? currentTask)!} className="mt-3" />
            <SkuBarcodes barcodes={(currentWave ?? currentTask)!.barcodes} />
            <ContainerHint
              containerBarcode={(currentWave ?? currentTask)!.containerBarcode}
              suggested={(currentWave ?? currentTask)!.suggested}
            />
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">
                {formatQuantity((currentWave ?? currentTask)!.qtyRemaining)}
              </span>
              <span className="text-muted-foreground">
                còn lấy · đã {formatQuantity((currentWave ?? currentTask)!.qtyDone)}/
                {formatQuantity((currentWave ?? currentTask)!.qtyPlanned)}
              </span>
            </div>
            {(currentWave ?? currentTask)!.binRemaining !== null ? (
              <p
                className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-base"
                aria-live="polite"
              >
                <Archive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  Trên kệ còn{' '}
                  <b className="text-xl font-bold tabular-nums">
                    {formatQuantity((currentWave ?? currentTask)!.binRemaining)}
                  </b>{' '}
                  <span className="text-muted-foreground">· đã trừ phần lấy chưa đóng gói</span>
                </span>
              </p>
            ) : null}
            {currentWave ? (
              <ul className="mt-2 flex flex-wrap gap-1 text-xs">
                {currentWave.shares.map((sh) => (
                  <li
                    key={sh.taskLineId}
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono',
                      sh.lineStatus === 'COMPLETED' && 'border-success/50 text-success',
                      sh.lineStatus === 'EXCEPTION' && 'border-warning/60 text-warning-foreground',
                    )}
                  >
                    {sh.refDocNumber ?? sh.taskDocNumber} {formatQuantity(sh.qtyDone)}/
                    {formatQuantity(sh.qtyPlanned)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {phase === 'ready' && mode === 'task' && task.task ? (
          <ol className="flex flex-col gap-1 text-sm">
            {task.task.lines.map((l) => (
              <li
                key={l.taskLineId}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  l.status === 'COMPLETED' &&
                    'border-success/40 bg-success/5 text-muted-foreground',
                  l.status === 'EXCEPTION' && 'border-warning/60 bg-warning/10',
                  l.taskLineId === currentTask?.taskLineId && 'border-primary',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SkuThumb src={l.imageUrl} alt={l.productName} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      <span className="font-mono font-semibold">{l.locationCode ?? '—'}</span>{' '}
                      {l.productName}
                      {l.status === 'EXCEPTION' ? (
                        <span className="ml-1 text-xs text-warning-foreground">· thiếu</span>
                      ) : null}
                    </span>
                    {l.skuName !== l.productName ? (
                      <span className="truncate text-xs text-muted-foreground">{l.skuName}</span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatQuantity(l.qtyDone)}/{formatQuantity(l.qtyPlanned)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {phase === 'ready' && mode === 'wave' && wave.wave ? (
          <ol className="flex flex-col gap-1 text-sm">
            {wave.wave.lines.map((g) => (
              <li
                key={g.key}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  g.complete && 'border-success/40 bg-success/5 text-muted-foreground',
                  g.key === currentWave?.key && 'border-primary',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SkuThumb src={g.imageUrl} alt={g.productName} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      <span className="font-mono font-semibold">{g.locationCode ?? '—'}</span>{' '}
                      {g.productName}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {g.shares.length} đơn
                      </span>
                    </span>
                    {g.skuName !== g.productName ? (
                      <span className="truncate text-xs text-muted-foreground">{g.skuName}</span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatQuantity(g.qtyDone)}/{formatQuantity(g.qtyPlanned)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {phase === 'done' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            {shortages.length > 0 ? (
              <AlertTriangle className="h-16 w-16 text-warning" aria-hidden />
            ) : (
              <CheckCircle2 className="h-16 w-16 text-success" aria-hidden />
            )}
            <p className="text-2xl font-bold">
              {mode === 'wave' ? `Xong lượt ${heading}` : `Xong đơn ${heading}`}
            </p>
            <p className="text-muted-foreground">
              {shortages.length > 0
                ? `Có ${shortages.length} ${mode === 'wave' ? 'nhóm' : 'dòng'} thiếu hàng — điều phối đã nhận cảnh báo.`
                : 'Chuyển hàng sang bàn đóng gói.'}{' '}
              Quét đơn kế tiếp.
            </p>
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        {phase === 'ready' ? <ScanQtyBar ctl={scanQty} verb="Lấy" /> : null}
        <ScanInput
          ref={scanRef}
          size="lg"
          label={phase === 'ready' ? 'Quét sản phẩm' : 'Quét mã đơn'}
          placeholder={
            phase === 'ready'
              ? 'Quét mã sản phẩm hoặc mã thùng…'
              : 'Quét mã đơn / mã việc / mã lượt…'
          }
          onScan={onScan}
          paused={shortOpen || scanQty.pending !== null}
          disabled={phase === 'opening'}
        />
        {phase === 'done' ? (
          <Button className="h-[72px] text-lg" onClick={clear}>
            Quét đơn kế tiếp
          </Button>
        ) : phase === 'ready' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-14 border-warning/60 text-warning-foreground"
              disabled={!(currentTask || currentWave) || s.busy}
              onClick={() => setShortOpen(true)}
            >
              <PackageX aria-hidden />
              Thiếu hàng
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

      <ShortPickDialog
        open={shortOpen}
        onOpenChange={setShortOpen}
        what={shortWhat}
        remaining={formatQuantity(shortRemaining)}
        busy={s.busy}
        onConfirm={(note) =>
          mode === 'wave'
            ? wave.short(note)
            : currentTask
              ? task.short(currentTask.taskLineId, note)
              : Promise.resolve(null)
        }
      />
    </div>
  );
}
