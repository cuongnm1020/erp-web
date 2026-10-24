'use client';

import { ArrowLeft, CheckCircle2, MapPin, PackageCheck, Search, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ErrorState, ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useAssignPutAway,
  useClaimTask,
  usePdaQueue,
  usePdaStats,
  usePutAwayView,
  useResolveCode,
  type PdaPutAwayAssignBody,
  type PdaResolveResult,
} from '../api/use-pda';
import {
  addLoose,
  addUnits,
  assignItems,
  basketEmpty,
  basketUnitCount,
  classifyCode,
  entryQty,
  freeUnits,
  looseFree,
  looseGroup,
  padToBase,
  pickUnits,
  qtyGt,
  ZERO,
  type Basket,
  type PutAwayGroup,
  type PutAwayUnit,
  type PutAwayView,
} from '../putaway-basket';
import { PdaFeedbackBanner, type PdaFeedback } from './pda-feedback';
import { PdaListColumn } from './pda-list-column';

type LocationRef = NonNullable<PdaResolveResult['location']>;

/** Ô số: số THÙNG của một nhóm, hoặc số lượng hàng RỜI theo ĐVT của mã vừa quét. */
type Pad =
  | { mode: 'units'; group: PutAwayGroup; scanned: PutAwayUnit; value: string; max: number }
  | { mode: 'loose'; group: PutAwayGroup; factor: string; uomCode: string; value: string };

/** Thân request đúng DTO — giữ nguyên để GỬI LẠI cùng key khi mất mạng (luật 4). */
interface Req {
  body: PdaPutAwayAssignBody;
  label: string;
}

type Phase = 'idle' | 'opening' | 'error' | 'ready' | 'done';

const unitCount = (v: string): number => (/^\d+$/.test(v) ? Number.parseInt(v, 10) : 0);

/**
 * Cất hàng tự chọn vị trí trên trình duyệt máy PDA (LOC-6 bản web, `docs/PLAN-putaway-relocate.md`;
 * cùng luồng với app PDA P-09 v2): nhận việc PUT_AWAY → quét thùng + gõ số thùng / quét SP hàng
 * rời + gõ số lượng vào GIỎ → quét mã vị trí → "Cất vào …" → `POST /pda/putaway/:id/assign`.
 * Rải một phiếu ra nhiều vị trí bằng nhiều giỏ. Hết chỗ → "Cất còn lại vào DEFAULT".
 *
 * Màn chờ: hàng đợi cất hàng + đã cất hôm nay. `?task=<id>` (từ màn lấy hàng) → tự nhận việc.
 */
export function PutAwayScreen() {
  const ability = useAbility();
  const canExecute = ability.can('execute', 'Task');
  const queue = usePdaQueue('PUT_AWAY', canExecute);
  const doneToday = usePdaStats('PUT_AWAY', null, canExecute);
  const claim = useClaimTask();
  const loadView = usePutAwayView();
  const assign = useAssignPutAway();
  const resolve = useResolveCode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get('task');
  const scanRef = useRef<ScanInputHandle>(null);
  const padRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const [view, setView] = useState<PutAwayView | null>(null);
  const [basket, setBasket] = useState<Basket>([]);
  const [pad, setPad] = useState<Pad | null>(null);
  const [target, setTarget] = useState<LocationRef | null>(null);
  const [pending, setPending] = useState<Req | null>(null);
  const [feedback, setFeedback] = useState<PdaFeedback | null>(null);
  const [offline, setOffline] = useState(false);
  const [askDefault, setAskDefault] = useState(false);

  const flash = (kind: PdaFeedback['kind'], text: string, detail?: string) => {
    if (kind === 'error' || kind === 'warn') beep('error');
    else if (kind === 'ok') beep('ok');
    setFeedback({ kind, text, ...(detail ? { detail } : {}) });
  };
  const fail = (err: unknown) => {
    if (isApiError(err) && err.status === 0) setOffline(true);
    beep('error');
    setFeedback({
      kind: 'error',
      text: messageFor(err),
      ...(isApiError(err) && err.traceId ? { traceId: err.traceId } : {}),
    });
  };

  const openTask = async (id: string) => {
    setPhase('opening');
    setTaskId(id);
    setFeedback(null);
    setOpenError(null);
    setBasket([]);
    setPad(null);
    setTarget(null);
    setPending(null);
    try {
      await claim.mutateAsync(id);
      const v = await loadView.mutateAsync(id);
      setOffline(false);
      setView(v);
      if (v.status === 'COMPLETED') {
        setPhase('done');
        return;
      }
      setPhase('ready');
      flash('info', `Đã nhận ${v.docNumber}. Quét thùng để cho vào giỏ.`);
    } catch (err) {
      if (isApiError(err) && err.status === 0) setOffline(true);
      setOpenError(err);
      setPhase('error');
    }
  };

  const openedParam = useRef<string | null>(null);
  useEffect(() => {
    if (!taskParam || !canExecute || openedParam.current === taskParam) return;
    openedParam.current = taskParam;
    router.replace('/pda/put-away');
    void openTask(taskParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, canExecute]);
  const idle = phase === 'idle';
  useEffect(() => {
    // Quay về màn chờ → làm tươi hai cột ngay, không đợi 30s.
    if (idle && canExecute) {
      void queue.refetch();
      void doneToday.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, canExecute]);
  useEffect(() => {
    if (pad) padRef.current?.focus();
  }, [pad]);

  if (!canExecute) return <ForbiddenState className="m-4" />;

  const send = async (req: Req) => {
    if (!taskId) return;
    try {
      const r = await assign.mutateAsync({ taskId, body: req.body });
      setOffline(false);
      setPending(null);
      setTarget(null);
      setBasket([]);
      setView(r.view);
      const what =
        r.containersPlaced > 0
          ? `${r.containersPlaced} thùng`
          : `${formatQuantity(r.looseQtyPlaced)} hàng rời`;
      flash('ok', `Đã cất ${what} vào ${r.toLocation.code}`, r.toLocation.label);
      if (r.taskCompleted) setPhase('done');
    } catch (err) {
      if (isApiError(err) && err.status === 0) {
        // Chưa chắc server đã ghi — giữ nguyên thân + key để gửi lại (server dedupe theo key).
        setOffline(true);
        setPending(req);
        flash('warn', 'Mất mạng — chưa chắc đã cất', 'Bấm "Gửi lại" khi có mạng, đừng quét lại.');
        return;
      }
      setPending(null);
      fail(err);
    }
  };

  const assignTo = (loc: LocationRef) =>
    void send({
      label: loc.code,
      body: { toLocationId: loc.id, ...assignItems(basket), idempotencyKey: newIdempotencyKey() },
    });

  const toDefault = () =>
    send({
      label: view?.defaultLocation?.code ?? 'DEFAULT',
      body: { toDefault: true, allRemaining: true, idempotencyKey: newIdempotencyKey() },
    });

  /** Mã không khớp thùng của việc: resolve → SKU (hàng rời) hoặc vị trí (đích cất). */
  const resolveCode = async (code: string) => {
    if (!view) return;
    try {
      const r = await resolve.mutateAsync(code);
      setOffline(false);
      if (r.kind === 'location' && r.location) {
        if (basketEmpty(basket)) {
          flash(
            'warn',
            `Giỏ trống — chưa có gì để cất vào ${r.location.code}`,
            'Quét thùng trước.',
          );
          return;
        }
        setTarget(r.location);
        setFeedback(null);
        beep('ok');
        return;
      }
      if (r.kind === 'sku' && r.sku) {
        const g = looseGroup(view, r.sku.sku.id);
        if (!g) {
          flash(
            'error',
            `${r.sku.sku.code} không còn hàng rời phải cất`,
            'Hàng theo thùng: quét mã thùng.',
          );
          return;
        }
        setPad({
          mode: 'loose',
          group: g,
          factor: r.sku.factor,
          uomCode: r.sku.uom.code,
          value: '',
        });
        return;
      }
      flash(
        'error',
        `Mã ${code} không thuộc ${view.docNumber}`,
        'Quét thùng của phiếu hoặc mã vị trí.',
      );
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        flash('error', `Không nhận ra mã ${code}`, 'Quét thùng của phiếu hoặc mã vị trí.');
        return;
      }
      fail(err);
    }
  };

  const onScanReady = (code: string) => {
    if (!view || pending || assign.isPending) return;
    setFeedback(null);
    const hit = classifyCode(view, code);
    if (hit.kind === 'unit') {
      const free = freeUnits(hit.group, basket);
      if (!free.some((u) => u.id === hit.unit.id)) {
        flash('warn', `Thùng ${hit.unit.barcode} đã trong giỏ`);
        return;
      }
      setTarget(null);
      setPad({ mode: 'units', group: hit.group, scanned: hit.unit, value: '1', max: free.length });
      return;
    }
    if (hit.kind === 'pallet') {
      setPad(null);
      setTarget(null);
      setBasket((b) => addUnits(b, hit.group, hit.units));
      flash(
        'ok',
        `Pallet ${hit.barcode}: ${hit.units.length} thùng vào giỏ`,
        'Quét mã vị trí để cất.',
      );
      return;
    }
    setPad(null);
    void resolveCode(code);
  };

  const openCode = async (code: string) => {
    try {
      const r = await resolve.mutateAsync(code);
      if (r.kind === 'task' && r.task) {
        if (r.task.type !== 'PUT_AWAY') {
          flash('info', `${r.task.docNumber} không phải việc cất hàng.`);
          return;
        }
        await openTask(r.task.id);
        return;
      }
      if (r.kind === 'location' && r.location) {
        router.push(`/pda/location?id=${encodeURIComponent(r.location.id)}`);
        return;
      }
      flash(
        'info',
        `Mã ${code} không mở được việc cất hàng nào.`,
        'Quét mã phiếu PUT… hoặc chạm một việc.',
      );
    } catch (err) {
      fail(err);
    }
  };

  const onScan = (code: string) => {
    if (phase === 'ready') onScanReady(code);
    else if (phase === 'idle' || phase === 'done') {
      if (phase === 'done') setPhase('idle');
      void openCode(code);
    }
  };

  const padBase = pad?.mode === 'loose' ? padToBase(pad.value, pad.factor) : pad ? pad.value : null;
  const padBad =
    pad?.mode === 'units'
      ? unitCount(pad.value) < 1 || unitCount(pad.value) > pad.max
      : pad?.mode === 'loose'
        ? padBase === null || qtyGt(padBase, looseFree(pad.group, basket))
        : false;

  const confirmPad = () => {
    if (!pad || padBad) return;
    if (pad.mode === 'units') {
      const units = pickUnits(pad.group, pad.scanned, unitCount(pad.value), basket);
      setBasket((b) => addUnits(b, pad.group, units));
      flash(
        'ok',
        `${units.length} thùng ${pad.group.skuCode} vào giỏ`,
        'Quét thêm thùng hoặc quét mã vị trí để cất.',
      );
    } else if (padBase) {
      setBasket((b) => addLoose(b, pad.group, padBase));
      flash(
        'ok',
        `${formatQuantity(padBase)} ${pad.group.baseUomCode} ${pad.group.skuCode} vào giỏ`,
        'Quét mã vị trí để cất.',
      );
    }
    setPad(null);
    scanRef.current?.focus();
  };

  /** Chạm nhóm (không có máy quét / tem thùng mờ): như quét thùng đầu tiên còn lại của nhóm. */
  const pickGroup = (g: PutAwayGroup) => {
    if (pending) return;
    setTarget(null);
    setFeedback(null);
    const free = freeUnits(g, basket);
    if (g.containerTypeCode !== null) {
      if (free.length === 0) {
        flash('warn', `Mọi thùng ${g.skuCode} đã trong giỏ`);
        return;
      }
      setPad({
        mode: 'units',
        group: g,
        scanned: free[0]!,
        value: String(free.length),
        max: free.length,
      });
      return;
    }
    setPad({ mode: 'loose', group: g, factor: '1', uomCode: g.baseUomCode, value: '' });
  };

  const backToQueue = () => {
    setPhase('idle');
    setView(null);
    setTaskId(null);
    setBasket([]);
    setPad(null);
    setTarget(null);
    setPending(null);
    setFeedback(null);
    scanRef.current?.focus();
  };

  const inBasket = basketUnitCount(basket);
  const remainingGroups =
    view?.groups.filter((g) => g.remainingCount > 0 || qtyGt(g.remainingQty, ZERO)) ?? [];
  const defaultCode = view?.defaultLocation?.code ?? 'DEFAULT';
  const busy = assign.isPending || resolve.isPending || claim.isPending || loadView.isPending;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              href="/pda/pick"
              className="-m-2 flex items-center gap-1 p-2 hover:text-foreground"
              aria-label="Về màn lấy hàng"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Lấy hàng
            </Link>
            <span aria-hidden>·</span>
            Cất hàng
          </div>
          <div className="font-mono text-lg font-semibold">
            {view?.docNumber ?? 'Chưa nhận việc'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view && phase === 'ready' ? (
            <span className="text-sm text-muted-foreground">còn {view.remainingCount}</span>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/pda/location">
              <Search aria-hidden />
              Tra vị trí
            </Link>
          </Button>
        </div>
      </header>

      {offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning-weak px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — cất hàng cần mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {feedback && phase !== 'error' ? <PdaFeedbackBanner feedback={feedback} /> : null}

        {phase === 'idle' ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col items-center gap-1 py-2 text-center text-muted-foreground">
              <p className="text-lg font-medium text-foreground">Chạm một việc để cất hàng</p>
              <p className="text-sm">
                Hoặc quét mã phiếu cất hàng (PUT…). Việc sinh ra khi phiếu nhập được duyệt.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PdaListColumn
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
                      onClick={() => void openTask(q.taskId)}
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
              </PdaListColumn>
            </div>
          </div>
        ) : null}

        {phase === 'opening' ? (
          <p role="status" className="text-center text-muted-foreground">
            Đang nhận việc…
          </p>
        ) : null}

        {phase === 'error' ? (
          <ErrorState
            error={openError}
            title="Không mở được việc cất hàng"
            onRetry={taskId ? () => void openTask(taskId) : undefined}
          />
        ) : null}

        {phase === 'ready' && view ? (
          <>
            {pad ? (
              <section
                className="rounded-lg border border-primary bg-card p-4"
                aria-label="Số lượng cho vào giỏ"
              >
                <div className="text-lg font-semibold">{pad.group.skuName}</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {pad.group.skuCode}
                  {pad.group.lotNumber ? ` · lô ${pad.group.lotNumber}` : ''}
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">
                    {pad.mode === 'units'
                      ? `Số thùng (còn ${pad.max}, thùng ${pad.scanned.barcode} trước)`
                      : `Số lượng (${pad.uomCode}) · còn ${formatQuantity(looseFree(pad.group, basket))} ${pad.group.baseUomCode} chưa cất`}
                  </span>
                  <input
                    ref={padRef}
                    type="text"
                    inputMode={pad.mode === 'units' ? 'numeric' : 'decimal'}
                    aria-label={pad.mode === 'units' ? 'Số thùng' : 'Số lượng hàng rời'}
                    aria-invalid={padBad}
                    className={cn(
                      'h-14 w-40 rounded-md border bg-background text-center text-2xl font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      padBad && pad.value !== '' && 'border-destructive text-destructive',
                    )}
                    value={pad.value}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value =
                        pad.mode === 'units'
                          ? raw.replace(/\D/g, '').slice(0, 5)
                          : raw.replace(/[^\d.,]/g, '').slice(0, 14);
                      setPad({ ...pad, value });
                    }}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmPad();
                      } else if (e.key === 'Escape') {
                        setPad(null);
                        scanRef.current?.focus();
                      }
                    }}
                  />
                </label>
                {pad.mode === 'loose' && pad.factor !== '1' && padBase ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    = {formatQuantity(padBase)} {pad.group.baseUomCode}
                  </p>
                ) : null}
              </section>
            ) : target ? (
              <section
                className="rounded-lg border border-primary bg-card p-4"
                aria-label="Vị trí cất"
              >
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Cất giỏ vào
                </div>
                <div className="font-mono text-4xl font-bold leading-tight">{target.code}</div>
                <p className="text-sm text-muted-foreground">
                  {inBasket > 0 ? `${inBasket} thùng` : 'hàng rời'} · kiểm tra đúng vị trí rồi bấm
                  “Cất vào {target.code}”.
                </p>
              </section>
            ) : null}

            <section
              className={cn(
                'rounded-lg border bg-card p-3',
                !basketEmpty(basket) && 'border-primary',
              )}
              aria-label="Giỏ"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Giỏ{inBasket > 0 ? ` · ${inBasket} thùng` : ''}
                </span>
                {!basketEmpty(basket) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBasket([]);
                      setTarget(null);
                    }}
                    disabled={pending !== null}
                  >
                    Xoá giỏ
                  </Button>
                ) : null}
              </div>
              {basketEmpty(basket) ? (
                <p className="text-sm text-muted-foreground">
                  Trống — quét thùng (gõ số thùng) hoặc mã sản phẩm hàng rời.
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {basket
                    .filter((e) => qtyGt(entryQty(e), ZERO))
                    .map((e) => (
                      <li key={e.groupKey} className="flex justify-between gap-2">
                        <span className="truncate">
                          <span className="font-mono font-semibold">{e.skuCode}</span> {e.skuName}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {e.units.length > 0 ? `${e.units.length} thùng · ` : ''}
                          {formatQuantity(entryQty(e))} {e.uomCode}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section aria-label="Chưa cất">
              <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Chưa cất</h2>
              {remainingGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đã cất hết hàng của việc.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {remainingGroups.map((g) => (
                    <li key={g.key}>
                      <button
                        type="button"
                        className="flex min-h-14 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-muted"
                        onClick={() => pickGroup(g)}
                        aria-label={`Chọn ${g.skuCode}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{g.skuName}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {g.skuCode}
                            {g.lotNumber ? ` · lô ${g.lotNumber}` : ''}
                            {g.containerTypeName ? ` · ${g.containerTypeName}` : ' · hàng rời'}
                            {g.suggestedLocationCode ? ` · gợi ý ${g.suggestedLocationCode}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums">
                          {g.containerTypeCode ? (
                            <span className="block font-semibold">{g.remainingCount} thùng</span>
                          ) : null}
                          {formatQuantity(g.remainingQty)} {g.baseUomCode}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {view.placed.length > 0 ? (
              <section aria-label="Đã cất">
                <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Đã cất</h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {view.placed.map((p) => (
                    <li
                      key={p.locationId}
                      className="flex items-center justify-between rounded-md border border-success-line bg-success-weak px-3 py-2"
                    >
                      <Link
                        href={`/pda/location?id=${encodeURIComponent(p.locationId)}`}
                        className="font-mono font-semibold hover:underline"
                      >
                        {p.locationCode}
                      </Link>
                      <span className="tabular-nums">
                        {p.containerCount > 0 ? `${p.containerCount} thùng · ` : ''}
                        {formatQuantity(p.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {phase === 'done' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2 className="h-16 w-16 text-success" aria-hidden />
            <p className="text-2xl font-bold">Xong {view?.docNumber ?? 'việc cất hàng'}</p>
            {view?.placed.map((p) => (
              <p key={p.locationId} className="text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{p.locationCode}</span>:{' '}
                {p.containerCount > 0 ? `${p.containerCount} thùng · ` : ''}
                {formatQuantity(p.qty)}
              </p>
            ))}
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        <ScanInput
          ref={scanRef}
          size="lg"
          paused={pad !== null || askDefault}
          label={
            phase === 'ready'
              ? basketEmpty(basket)
                ? 'Quét thùng'
                : 'Quét thùng hoặc vị trí'
              : 'Quét mã việc'
          }
          placeholder={
            phase === 'ready'
              ? basketEmpty(basket)
                ? 'Quét mã thùng / sản phẩm…'
                : 'Quét thêm thùng, hoặc mã vị trí để cất…'
              : 'Quét mã phiếu cất hàng…'
          }
          onScan={onScan}
          disabled={phase === 'opening' || busy}
        />
        {phase === 'ready' ? (
          pending ? (
            <Button
              className="h-pda-primary text-lg"
              loading={assign.isPending}
              onClick={() => void send(pending)}
            >
              Gửi lại · cất vào {pending.label}
            </Button>
          ) : pad ? (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-14" disabled={padBad} onClick={confirmPad}>
                {padBad
                  ? 'Số lượng không hợp lệ'
                  : pad.mode === 'units'
                    ? `Cho ${pad.value} thùng vào giỏ`
                    : `Cho ${pad.value} ${pad.uomCode} vào giỏ`}
              </Button>
              <Button
                variant="outline"
                className="h-14"
                onClick={() => {
                  setPad(null);
                  scanRef.current?.focus();
                }}
              >
                Huỷ
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-14"
                disabled={!target || basketEmpty(basket)}
                loading={assign.isPending}
                loadingText="Đang cất…"
                onClick={() => target && assignTo(target)}
              >
                <PackageCheck aria-hidden />
                {target ? `Cất vào ${target.code}` : 'Quét vị trí để cất'}
              </Button>
              <Button
                variant="outline"
                className="h-14"
                disabled={!view?.defaultLocation || assign.isPending}
                onClick={() => setAskDefault(true)}
              >
                Cất còn lại vào {defaultCode}
              </Button>
              <Button variant="ghost" className="col-span-2" onClick={backToQueue}>
                Về hàng đợi
              </Button>
            </div>
          )
        ) : phase === 'done' ? (
          <Button className="h-pda-primary text-lg" onClick={backToQueue}>
            Việc cất tiếp theo
          </Button>
        ) : phase === 'error' ? (
          <Button variant="outline" className="h-14" onClick={backToQueue}>
            Về hàng đợi
          </Button>
        ) : (
          <Button className="h-pda-primary text-lg" onClick={() => scanRef.current?.focus()}>
            Quét mã vạch
          </Button>
        )}
      </footer>

      <ConfirmDialog
        open={askDefault}
        onOpenChange={(o) => {
          setAskDefault(o);
          if (!o) scanRef.current?.focus();
        }}
        title={`Cất còn lại vào ${defaultCode}?`}
        description={`Mọi thùng / hàng chưa cất của ${view?.docNumber ?? 'việc này'} (kể cả giỏ đang chọn) sẽ ghi vào vị trí ${defaultCode}. Lấy hàng sẽ ưu tiên lấy ở đây trước.`}
        confirmLabel={`Cất vào ${defaultCode}`}
        destructive={false}
        onConfirm={toDefault}
      />
    </div>
  );
}
