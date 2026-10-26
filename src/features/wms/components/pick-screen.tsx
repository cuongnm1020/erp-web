'use client';

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDot,
  Layers,
  MapPin,
  PackageX,
  UserCheck,
  Warehouse,
  WifiOff,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { beep } from '@/lib/beep';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity, toDecimal } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  usePdaHandoverState,
  usePdaMyTasks,
  usePdaMyWaves,
  usePdaQueue,
  usePdaStats,
  useResolveCode,
  useSelfMergeWave,
} from '../api/use-pda';
import { HandoverDialog } from './handover-dialog';
import { NewOrdersColumn } from './new-orders-column';
import { useScanSession, type ScanFeedback, type Shortage } from '../scan-session';
import { useScanQty } from '../use-scan-qty';
import { useWaveSession } from '../wave-session';
import { PdaListColumn } from './pda-list-column';
import { ScanQtyBar } from './scan-qty-bar';
import { ShortPickDialog } from './short-pick-dialog';
import { ContainerHint } from './container-hint';
import { ScanCounter } from './scan-counter';
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
 *
 * 2026-10-12 (spec `docs/screens/FE-PDA-2-new-orders-handover.md`, luồng
 * `apps/api/docs/pick-pack-flow.md`): cột "Đơn mới" (chọn đơn → Lấy đơn, ai trước được), nút
 * "Gộp lượt lấy" (gộp mọi việc đang giữ chưa bắt đầu), lấy xong → BẮT BUỘC chọn người đóng gói
 * (HandoverDialog). Đơn thiếu hàng không hoàn thành pick, chuyển điều phối.
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
  const handover = usePdaHandoverState(canExecute);
  const selfMerge = useSelfMergeWave();
  const [handoverMode, setHandoverMode] = useState<'new' | 'change' | null>(null);
  const mergeKey = useRef<{ sig: string; key: string } | null>(null);
  const idle = !resolving && task.phase === 'idle' && wave.phase === 'idle';
  const finished = task.phase === 'done' || wave.phase === 'done';
  useEffect(() => {
    // Quay về màn chờ (sau "Quét đơn kế tiếp") hoặc vừa xong việc → làm tươi các cột ngay, không
    // đợi 30s (xong việc cần biết còn việc nào không để mời chọn người đóng gói).
    if ((idle || finished) && canExecute) {
      void myTasks.refetch();
      void myWaves.refetch();
      void doneToday.refetch();
      void putQueue.refetch();
      void handover.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, finished, canExecute]);

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
      if (r.kind === 'location' && r.location) {
        // Tem vị trí ở màn chờ → tra hàng ở vị trí đó (LOC-3).
        router.push(`/pda/location?id=${encodeURIComponent(r.location.id)}`);
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
  // Tiến độ cả đơn / lượt theo đơn vị (thanh ở đầu màn) — dòng hủy không tính.
  const unitLines =
    mode === 'wave'
      ? (wave.wave?.lines ?? [])
      : (task.task?.lines.filter((l) => l.status !== 'CANCELLED') ?? []);
  const unitsPlanned = unitLines.reduce(
    (sum, l) => sum.plus(toDecimal(l.qtyPlanned) ?? 0),
    new Decimal(0),
  );
  const unitsDone = unitLines.reduce(
    (sum, l) => sum.plus(toDecimal(l.qtyDone) ?? 0),
    new Decimal(0),
  );
  const unitsPct = unitsPlanned.gt(0)
    ? unitsDone.div(unitsPlanned).times(100).toDecimalPlaces(0).toNumber()
    : 0;
  const current = currentWave ?? currentTask;
  // Đơn vị cơ bản của dòng đang lấy = gợi ý không phải thùng / kiện ("5 CHAI").
  const currentUnit = current?.suggested?.find((x) => !x.containerTypeCode)?.uomCode ?? null;
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

  // "Gộp lượt lấy": mọi việc PICK của tôi chưa bắt đầu (ASSIGNED), ngoài lượt — tối đa 30.
  const mergeIds = (myPicks ?? [])
    .filter((t) => t.status === 'ASSIGNED')
    .slice(0, 30)
    .map((t) => t.taskId);
  const onMerge = () => {
    if (mergeIds.length < 2 || selfMerge.isPending) return;
    const sig = [...mergeIds].sort().join(',');
    // Luật 4: key sinh lúc bấm, giữ khi bấm lại cùng danh sách.
    if (mergeKey.current?.sig !== sig) mergeKey.current = { sig, key: newIdempotencyKey() };
    selfMerge.mutate(
      { taskIds: mergeIds, idempotencyKey: mergeKey.current.key },
      {
        onSuccess: (w) => {
          mergeKey.current = null;
          toast.success(`Đã gộp ${mergeIds.length} đơn thành lượt ${w.docNumber}`);
          void openWave(w.id);
        },
        onError: (err) => {
          mergeKey.current = null;
          toast.error(messageFor(err));
        },
      },
    );
  };
  const pendingHandover = handover.data?.pending.length ?? 0;
  const latestHandover = handover.data?.latest ?? null;
  // Xong việc mà không còn việc được giao → bắt buộc giao người đóng gói.
  const noMoreWork = assignedCount === 0;

  const working = phase === 'ready';
  // Danh sách dòng (task) / nhóm (lượt) — một hình cho cả hai, cột phải trên desktop.
  const rows = (
    mode === 'wave'
      ? (wave.wave?.lines ?? []).map((g) => ({
          key: g.key,
          productName: g.productName,
          skuName: g.skuName,
          imageUrl: g.imageUrl,
          locationCode: g.locationCode,
          qtyDone: g.qtyDone,
          qtyPlanned: g.qtyPlanned,
          extra: `${g.shares.length} đơn`,
          state: g.complete ? 'done' : g.key === currentWave?.key ? 'current' : 'pending',
        }))
      : (task.task?.lines ?? []).map((l) => ({
          key: l.taskLineId,
          productName: l.productName,
          skuName: l.skuName,
          imageUrl: l.imageUrl,
          locationCode: l.locationCode,
          qtyDone: l.qtyDone,
          qtyPlanned: l.qtyPlanned,
          extra: null as string | null,
          state:
            l.status === 'COMPLETED'
              ? 'done'
              : l.status === 'EXCEPTION'
                ? 'short'
                : l.taskLineId === currentTask?.taskLineId
                  ? 'current'
                  : 'pending',
        }))
  ).map((r) => {
    const planned = toDecimal(r.qtyPlanned);
    const pct =
      planned && planned.gt(0)
        ? Decimal.min(100, (toDecimal(r.qtyDone) ?? new Decimal(0)).div(planned).times(100))
            .toDecimalPlaces(0)
            .toNumber()
        : 0;
    return { ...r, pct };
  });
  const actions = (
    <>
      <Button
        variant="outline"
        className="h-14 border-warning-line text-warning lg:h-control"
        disabled={!current || s.busy}
        onClick={() => setShortOpen(true)}
      >
        <PackageX aria-hidden />
        Thiếu hàng
      </Button>
      <Button variant="outline" className="h-14 lg:h-control" onClick={clear}>
        Bỏ việc đang mở
      </Button>
    </>
  );

  // Desktop (lg): lưới 3 cột — khu đang lấy + ô quét chiếm 2 cột, danh sách dòng cột phải.
  // PDA: một cột, ô quét dính đáy. Thiết kế 2026-10-26 canvas 74cSn4eQquHQ56iaAxHmL3.
  return (
    <div className="flex min-h-dvh flex-col bg-background text-base lg:grid lg:grid-cols-3 lg:content-start lg:gap-x-5">
      <header className="flex flex-col gap-2 border-b bg-card px-4 py-3 lg:col-span-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8 lg:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              {mode === 'wave' ? <Layers className="h-3 w-3" aria-hidden /> : null}
              {mode === 'wave' ? 'Lượt lấy gộp' : 'Lấy hàng'}
            </div>
            <div className="font-mono text-lg font-semibold lg:text-xl">{heading}</div>
          </div>
          {progress ? (
            <div className="text-right text-sm text-muted-foreground lg:hidden">{progress}</div>
          ) : null}
        </div>
        {unitsPlanned.gt(0) ? (
          <div className="flex flex-col gap-1 lg:max-w-lg lg:flex-1">
            <div className="flex justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {mode === 'wave' ? 'Cả lượt' : 'Cả đơn'} ·{' '}
                <b className="font-semibold text-foreground tabular-nums">
                  {formatQuantity(unitsDone.toFixed(6))}/{formatQuantity(unitsPlanned.toFixed(6))}
                </b>{' '}
                sản phẩm
              </span>
              {progress ? <span className="hidden lg:inline">{progress}</span> : null}
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-border lg:h-2"
              role="progressbar"
              aria-label="Tiến độ lấy hàng"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={unitsPct}
            >
              <div className="h-full bg-primary" style={{ width: `${unitsPct}%` }} />
            </div>
          </div>
        ) : null}
      </header>

      {offline ? (
        <p
          role="status"
          className="flex items-center gap-2 bg-warning-weak px-4 py-2 text-sm lg:col-span-3"
        >
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — quét lại khi có mạng.
        </p>
      ) : null}

      <main
        className={cn(
          'flex flex-1 flex-col gap-3 px-4 py-3 lg:py-5 lg:pl-6 lg:pr-0',
          working ? 'lg:col-span-2' : 'lg:col-span-3 lg:pr-6',
        )}
      >
        {shortages.length > 0 ? (
          <aside
            role="status"
            aria-label="Cảnh báo thiếu hàng"
            className="rounded-md border border-warning-line bg-warning-weak px-3 py-2 text-sm"
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

        {/* Đang lấy: phản hồi lần quét nằm trong khung đếm (ScanCounter), không lặp ở đây. */}
        {feedback && !(working && current) ? (
          <p
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-3 font-medium',
              feedback.kind === 'error' &&
                'border-destructive-line bg-destructive-weak text-destructive',
              feedback.kind === 'warn' && 'border-warning-line bg-warning-weak text-warning',
              feedback.kind === 'ok' && 'border-success-line bg-success-weak text-success',
              feedback.kind === 'info' && 'border-info-line bg-info-weak text-info',
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
                chọn đơn mới / chạm một việc bên dưới.
              </p>
            </div>
            {pendingHandover > 0 ? (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2"
              >
                <span className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
                  {pendingHandover} đơn đã lấy xong chưa giao người đóng gói
                </span>
                <Button className="h-12" onClick={() => setHandoverMode('new')}>
                  <UserCheck aria-hidden />
                  Chọn người đóng gói
                </Button>
              </div>
            ) : null}
            {latestHandover && latestHandover.changeable > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                <span>
                  Đã giao {latestHandover.orders.length} đơn cho{' '}
                  <b>{latestHandover.packer.fullName}</b>
                </span>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => setHandoverMode('change')}
                >
                  Đổi người đóng gói
                </Button>
              </div>
            ) : null}
            {mergeIds.length >= 2 ? (
              <Button
                variant="outline"
                className="h-14 border-primary text-base text-primary"
                disabled={selfMerge.isPending}
                onClick={onMerge}
              >
                <Layers aria-hidden />
                {selfMerge.isPending ? 'Đang gộp lượt…' : `Gộp lượt lấy · ${mergeIds.length} đơn`}
              </Button>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <NewOrdersColumn
                enabled={canExecute}
                blocked={pendingHandover > 0}
                onTaken={() => {
                  void myTasks.refetch();
                  void myWaves.refetch();
                }}
                onHandoverRequired={() => setHandoverMode('new')}
              />
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
                            ? 'bg-secondary text-primary'
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
                            ? 'bg-secondary text-primary'
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
                            ? 'bg-secondary text-primary'
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

        {working && current ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-3.5 lg:gap-4 lg:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
              <SkuIdentity sku={current} className="lg:flex-1" />
              <div className="flex items-center gap-x-3 gap-y-0.5 rounded-md bg-muted px-3 py-2 lg:flex-col lg:items-end lg:px-4">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Vị trí
                </span>
                <span className="font-mono text-2xl font-bold leading-tight lg:text-3xl">
                  {current.locationCode ?? '—'}
                </span>
                {current.binRemaining !== null ? (
                  <span
                    className="ml-auto flex items-center gap-1 text-sm text-muted-foreground lg:ml-0"
                    aria-live="polite"
                    title="Đã trừ phần lấy chưa đóng gói"
                  >
                    <Archive className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      Trên kệ còn{' '}
                      <b className="font-semibold text-foreground tabular-nums">
                        {formatQuantity(current.binRemaining)}
                      </b>
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
            <SkuBarcodes barcodes={current.barcodes} />
            <ContainerHint
              containerBarcode={current.containerBarcode}
              suggested={current.suggested}
            />
            <ScanCounter
              done={current.qtyDone}
              planned={current.qtyPlanned}
              unit={currentUnit}
              feedback={feedback}
            />
            {currentWave ? (
              <ul className="mt-2 flex flex-wrap gap-1 text-xs">
                {currentWave.shares.map((sh) => (
                  <li
                    key={sh.taskLineId}
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono',
                      sh.lineStatus === 'COMPLETED' && 'border-success-line text-success',
                      sh.lineStatus === 'EXCEPTION' && 'border-warning-line text-warning',
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
              {/* 2026-10-12: đơn thiếu hàng không hoàn thành pick, không sang đóng gói. */}
              {shortages.length > 0
                ? `Có ${shortages.length} ${mode === 'wave' ? 'nhóm' : 'dòng'} thiếu hàng — đơn thiếu chuyển điều phối xử lý, không sang đóng gói.`
                : 'Mang hàng về bàn đóng gói.'}{' '}
              {noMoreWork ? 'Chọn người đóng gói nhận các đơn đã lấy.' : 'Quét đơn kế tiếp.'}
            </p>
          </div>
        ) : null}
      </main>

      {working && rows.length > 0 ? (
        <aside className="flex flex-col gap-1.5 px-4 pb-3 lg:row-span-2 lg:mr-6 lg:mt-5 lg:self-start lg:overflow-hidden lg:rounded-lg lg:border lg:bg-card lg:p-0">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground lg:min-h-card-header lg:border-b lg:px-4 lg:text-sm lg:normal-case lg:text-foreground">
            <span>{mode === 'wave' ? 'Các nhóm của lượt' : 'Các dòng của đơn'}</span>
            <span className="font-normal text-muted-foreground tabular-nums">
              {rows.filter((r) => r.state === 'done').length}/{rows.length} xong
            </span>
          </div>
          <ol className="flex flex-col gap-1.5 text-sm lg:p-2.5">
            {rows.map((r) => (
              <li
                key={r.key}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border bg-card px-3 py-2',
                  r.state === 'done' && 'border-success-line bg-success-weak',
                  r.state === 'short' && 'border-warning-line bg-warning-weak',
                  r.state === 'current' && 'border-2 border-primary',
                )}
              >
                {r.state === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Xong" />
                ) : r.state === 'current' ? (
                  <CircleDot className="h-5 w-5 shrink-0 text-primary" aria-label="Đang lấy" />
                ) : r.state === 'short' ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-label="Thiếu" />
                ) : (
                  <Circle
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-label="Chưa lấy"
                  />
                )}
                <SkuThumb src={r.imageUrl} alt={r.productName} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {r.productName}
                    {r.state === 'short' ? (
                      <span className="ml-1 text-xs font-normal text-warning">· thiếu</span>
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{r.locationCode ?? '—'}</span>
                    {r.skuName !== r.productName ? ` · ${r.skuName}` : ''}
                    {r.extra ? ` · ${r.extra}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-base font-bold tabular-nums">
                    {formatQuantity(r.qtyDone)}
                    <span className="font-normal text-muted-foreground">
                      /{formatQuantity(r.qtyPlanned)}
                    </span>
                  </span>
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-border">
                    <span
                      className={cn(
                        'block h-full',
                        r.state === 'done' ? 'bg-success' : 'bg-primary',
                      )}
                      style={{ width: `${r.pct}%` }}
                    />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}

      <footer
        className={cn(
          'sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3',
          'lg:static lg:border-0 lg:pb-6 lg:pl-6 lg:pr-0 lg:pt-0',
          working ? 'lg:col-span-2 lg:flex-row lg:flex-wrap lg:items-end' : 'lg:col-span-3 lg:pr-6',
        )}
      >
        {phase === 'ready' ? (
          <ScanQtyBar ctl={scanQty} verb="Lấy" className="lg:w-80 lg:shrink-0" />
        ) : null}
        <ScanInput
          ref={scanRef}
          size="lg"
          className={working ? 'lg:order-first lg:flex-1' : undefined}
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
          noMoreWork ? (
            <div className="grid gap-2">
              <Button className="h-pda-primary text-lg" onClick={() => setHandoverMode('new')}>
                <UserCheck aria-hidden />
                Chọn người đóng gói
              </Button>
              <Button variant="outline" className="h-12" onClick={clear}>
                Về màn chờ
              </Button>
            </div>
          ) : (
            <Button className="h-pda-primary text-lg" onClick={clear}>
              Quét đơn kế tiếp
            </Button>
          )
        ) : phase === 'ready' ? (
          <div className="grid grid-cols-2 gap-2 lg:flex lg:w-full lg:justify-end">{actions}</div>
        ) : (
          <Button className="h-pda-primary text-lg" onClick={() => scanRef.current?.focus()}>
            Quét mã vạch
          </Button>
        )}
      </footer>

      <HandoverDialog
        open={handoverMode !== null}
        change={handoverMode === 'change'}
        onOpenChange={(o) => {
          if (o) return;
          setHandoverMode(null);
          // Giao xong từ màn "Xong" → về màn chờ để lấy đơn mới.
          if (phase === 'done') clear();
        }}
      />
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
