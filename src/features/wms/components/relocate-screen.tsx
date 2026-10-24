'use client';

import { ArrowLeft, ArrowRightLeft, CheckCircle2, MapPin, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ErrorState, ForbiddenState, ListSkeleton } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import {
  useLocationContents,
  useRelocate,
  useResolveCode,
  type PdaRelocateBody,
  type PdaRelocateResult,
  type PdaResolveResult,
} from '../api/use-pda';
import { padToBase, plainQty, qtyGt, ZERO } from '../putaway-basket';
import {
  EMPTY_SELECTION,
  isLocked,
  itemKey,
  looseMovable,
  relocateItems,
  selectionEmpty,
  selectionQty,
  setLoose,
  toggleUnits,
  unitsForCode,
  type LocationContents,
  type Selection,
} from '../relocate-selection';
import { PdaFeedbackBanner, type PdaFeedback } from './pda-feedback';

type LocationRef = NonNullable<PdaResolveResult['location']>;

/** Thân request đúng DTO — giữ nguyên để GỬI LẠI cùng key khi mất mạng (luật 4). */
interface Req {
  body: PdaRelocateBody;
  label: string;
}

/**
 * Chuyển hàng giữa vị trí trên trình duyệt (LOC-8 bản web, cùng luồng P-13 của app): ở vị trí A
 * (`?from=`) chọn thùng (quét / tick), hàng rời (gõ số lượng) hoặc "Chọn tất cả" → quét / gõ vị
 * trí B → "Chuyển sang B" → `POST /pda/relocate`. Server trỏ lại / tách dòng lấy hàng đang nhắm
 * A khi A không còn đủ (LOC-7). Quyền `stock.transfer`.
 */
export function RelocateScreen() {
  const ability = useAbility();
  const canMove = ability.can('transfer', 'Stock');
  const fromId = useSearchParams().get('from');
  const contents = useLocationContents(canMove ? fromId : null);
  const resolve = useResolveCode();
  const relocate = useRelocate();
  const scanRef = useRef<ScanInputHandle>(null);

  const [sel, setSel] = useState<Selection>(EMPTY_SELECTION);
  /** Ô hàng rời theo itemKey — chuỗi người gõ; hợp lệ mới vào `sel.loose`. */
  const [looseText, setLooseText] = useState<Record<string, string>>({});
  const [all, setAll] = useState(false);
  const [askAll, setAskAll] = useState(false);
  const [target, setTarget] = useState<LocationRef | null>(null);
  const [pending, setPending] = useState<Req | null>(null);
  const [result, setResult] = useState<PdaRelocateResult | null>(null);
  const [feedback, setFeedback] = useState<PdaFeedback | null>(null);
  const [offline, setOffline] = useState(false);

  if (!canMove) return <ForbiddenState className="m-4" />;

  const flash = (kind: PdaFeedback['kind'], text: string, detail?: string) => {
    beep(kind === 'error' || kind === 'warn' ? 'error' : 'ok');
    setFeedback({ kind, text, ...(detail ? { detail } : {}) });
  };

  const data = contents.data;
  const reset = () => {
    setSel(EMPTY_SELECTION);
    setLooseText({});
    setAll(false);
    setTarget(null);
    setPending(null);
    setResult(null);
    setFeedback(null);
  };

  const looseBad = (data?.items ?? []).some((i) => {
    const raw = looseText[itemKey(i)]?.trim();
    if (!raw) return false;
    const base = padToBase(raw, '1');
    return base === null || qtyGt(base, looseMovable(i, { ...sel, loose: {} }));
  });
  const nothing = selectionEmpty(sel) && !all;

  const send = async (req: Req) => {
    try {
      const r = await relocate.mutateAsync(req.body);
      setOffline(false);
      setPending(null);
      setResult(r);
      beep('ok');
    } catch (err) {
      if (isApiError(err) && err.status === 0) {
        setOffline(true);
        setPending(req);
        flash(
          'warn',
          'Mất mạng — chưa chắc đã chuyển',
          'Bấm "Gửi lại" khi có mạng, đừng chọn lại.',
        );
        return;
      }
      setPending(null);
      beep('error');
      setFeedback({
        kind: 'error',
        text: messageFor(err),
        ...(isApiError(err) && err.traceId ? { traceId: err.traceId } : {}),
      });
    }
  };

  const confirmSend = (c: LocationContents, loc: LocationRef) =>
    void send({
      label: loc.code,
      body: {
        fromLocationId: c.location.id,
        toLocationId: loc.id,
        ...(all ? { all: true } : relocateItems(c, sel)),
        idempotencyKey: newIdempotencyKey(),
      },
    });

  const onScan = async (code: string) => {
    if (!data || pending || relocate.isPending || result) return;
    setFeedback(null);
    const units = unitsForCode(data, code);
    if (units.length > 0) {
      const free = units.filter((u) => !isLocked(u));
      if (free.length === 0) {
        flash('error', `Thùng ${code} đã được quét lấy cho đơn`, 'Không chuyển được.');
        return;
      }
      setAll(false);
      setTarget(null);
      setSel((s) =>
        toggleUnits(
          s,
          free.map((u) => u.id),
        ),
      );
      beep('ok');
      return;
    }
    if (nothing) {
      flash(
        'warn',
        `Mã ${code} không phải thùng ở ${data.location.code}`,
        'Chọn hàng trước rồi mới quét vị trí đích.',
      );
      return;
    }
    try {
      const r = await resolve.mutateAsync(code);
      setOffline(false);
      if (r.kind === 'location' && r.location) {
        if (r.location.id === data.location.id) {
          flash('warn', 'Đây là vị trí đang chuyển đi', 'Quét vị trí đích khác.');
          return;
        }
        setTarget(r.location);
        beep('ok');
        return;
      }
      flash('error', `Mã ${code} không phải tem vị trí`);
    } catch (err) {
      beep('error');
      setFeedback({
        kind: 'error',
        text: isApiError(err) && err.status === 404 ? `Không nhận ra mã ${code}` : messageFor(err),
      });
    }
  };

  const changeLoose = (key: string, raw: string) => {
    const value = raw.replace(/[^\d.,]/g, '').slice(0, 14);
    setLooseText((t) => ({ ...t, [key]: value }));
    setAll(false);
    setTarget(null);
    setSel((s) => setLoose(s, key, padToBase(value, '1') ?? ZERO));
  };

  const fromCode = data?.location.code ?? '…';

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              href={fromId ? `/pda/location?id=${encodeURIComponent(fromId)}` : '/pda/location'}
              className="-m-2 flex items-center gap-1 p-2 hover:text-foreground"
              aria-label="Về tra vị trí"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Tra vị trí
            </Link>
            <span aria-hidden>·</span>
            Chuyển hàng
          </div>
          <div className="font-mono text-lg font-semibold">Chuyển từ {fromCode}</div>
        </div>
      </header>

      {offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning-weak px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — chuyển hàng cần mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {feedback && !result ? <PdaFeedbackBanner feedback={feedback} /> : null}

        {!fromId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MapPin className="h-12 w-12" aria-hidden />
            <p className="text-lg font-medium text-foreground">Chưa chọn vị trí nguồn</p>
            <Button asChild>
              <Link href="/pda/location">Quét vị trí cần chuyển hàng đi</Link>
            </Button>
          </div>
        ) : contents.isPending ? (
          <ListSkeleton rows={4} />
        ) : contents.isError ? (
          <ErrorState error={contents.error} onRetry={() => void contents.refetch()} />
        ) : result ? (
          <RelocateDone result={result} />
        ) : data ? (
          <>
            {target ? (
              <section
                className="rounded-lg border border-primary bg-card p-4"
                aria-label="Vị trí đích"
              >
                <div className="text-sm text-muted-foreground">Chuyển sang</div>
                <div className="font-mono text-4xl font-bold leading-tight">{target.code}</div>
                <p className="text-sm text-muted-foreground">
                  {all
                    ? 'Tất cả hàng chuyển được'
                    : `${sel.units.length} thùng · ${formatQuantity(selectionQty(data, sel))} tổng`}{' '}
                  · kiểm tra rồi bấm “Chuyển sang {target.code}”.
                </p>
              </section>
            ) : null}

            <section
              className={cn(
                'flex items-center justify-between rounded-lg border bg-card p-3',
                !nothing && 'border-primary',
              )}
              aria-label="Đã chọn"
            >
              <span className="text-sm font-semibold">
                {all
                  ? 'Đã chọn tất cả hàng chuyển được'
                  : nothing
                    ? 'Quét / tick thùng, hoặc gõ số hàng rời cần chuyển'
                    : `Đã chọn ${sel.units.length} thùng · ${formatQuantity(selectionQty(data, sel))}`}
              </span>
              {!nothing ? (
                <Button variant="ghost" size="sm" onClick={reset} disabled={pending !== null}>
                  Bỏ chọn
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.items.some((i) => qtyGt(i.movable, ZERO))}
                  onClick={() => setAskAll(true)}
                >
                  Chọn tất cả
                </Button>
              )}
            </section>

            <RelocateItems
              data={data}
              sel={sel}
              all={all}
              looseText={looseText}
              onToggle={(ids) => {
                setAll(false);
                setTarget(null);
                setSel((s) => toggleUnits(s, ids));
              }}
              onLoose={changeLoose}
            />
          </>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        {result ? (
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-14" asChild>
              <Link href={`/pda/location?id=${encodeURIComponent(result.toLocation.id)}`}>
                Xem vị trí {result.toLocation.code}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-14"
              onClick={() => {
                reset();
                void contents.refetch();
              }}
            >
              Chuyển tiếp từ {result.fromLocation.code}
            </Button>
          </div>
        ) : (
          <>
            <ScanInput
              ref={scanRef}
              size="lg"
              paused={askAll}
              label={nothing ? 'Quét thùng' : 'Quét thùng hoặc vị trí đích'}
              placeholder={
                nothing ? 'Quét mã thùng / pallet…' : 'Quét mã vị trí đích (hoặc gõ mã rồi Enter)…'
              }
              onScan={(c) => void onScan(c)}
              disabled={!data || resolve.isPending || relocate.isPending}
            />
            {pending ? (
              <Button
                className="h-pda-primary text-lg"
                loading={relocate.isPending}
                onClick={() => void send(pending)}
              >
                Gửi lại · chuyển sang {pending.label}
              </Button>
            ) : (
              <Button
                className="h-pda-primary text-lg"
                disabled={!data || !target || nothing || looseBad}
                loading={relocate.isPending}
                loadingText="Đang chuyển…"
                onClick={() => data && target && confirmSend(data, target)}
              >
                <ArrowRightLeft aria-hidden />
                {looseBad
                  ? 'Số lượng hàng rời không hợp lệ'
                  : target
                    ? `Chuyển sang ${target.code}`
                    : nothing
                      ? 'Chọn hàng cần chuyển'
                      : 'Quét vị trí đích'}
              </Button>
            )}
          </>
        )}
      </footer>

      <ConfirmDialog
        open={askAll}
        onOpenChange={(o) => {
          setAskAll(o);
          if (!o) scanRef.current?.focus();
        }}
        title={`Chuyển tất cả ở ${fromCode}?`}
        description="Mọi thùng và hàng rời chuyển được sẽ đi sang vị trí bạn quét tiếp theo. Hàng đã quét lấy cho đơn ở lại."
        confirmLabel="Chọn tất cả"
        destructive={false}
        onConfirm={() => {
          setSel(EMPTY_SELECTION);
          setLooseText({});
          setTarget(null);
          setAll(true);
        }}
      />
    </div>
  );
}

function RelocateItems({
  data,
  sel,
  all,
  looseText,
  onToggle,
  onLoose,
}: {
  data: LocationContents;
  sel: Selection;
  all: boolean;
  looseText: Record<string, string>;
  onToggle: (ids: string[]) => void;
  onLoose: (key: string, value: string) => void;
}) {
  const items = data.items.filter((i) => qtyGt(i.movable, ZERO));
  if (items.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-4 py-6 text-center text-muted-foreground">
        Không còn hàng chuyển được ở vị trí này (trống hoặc đã quét lấy cho đơn).
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Hàng chuyển được">
      {items.map((i) => {
        const key = itemKey(i);
        const max = looseMovable(i, { ...sel, loose: {} });
        const raw = looseText[key] ?? '';
        const base = raw.trim() ? padToBase(raw, '1') : null;
        const bad = raw.trim() !== '' && (base === null || qtyGt(base, max));
        return (
          <li key={key} className={cn('rounded-lg border bg-card p-3', all && 'border-primary')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{i.skuName}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {i.skuCode}
                  {i.lotNumber ? ` · lô ${i.lotNumber}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xl font-bold tabular-nums">{formatQuantity(i.movable)}</span>{' '}
                <span className="text-sm text-muted-foreground">{i.baseUomCode} chuyển được</span>
              </div>
            </div>
            {qtyGt(i.inHand, ZERO) ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Đã quét lấy {formatQuantity(i.inHand)} cho đơn — ở lại.
              </p>
            ) : null}
            {i.containers.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {i.containers.map((c) => {
                  const locked = isLocked(c);
                  return (
                    <li key={c.id}>
                      <label
                        className={cn(
                          'flex min-h-10 items-center gap-2',
                          locked && 'text-muted-foreground',
                        )}
                      >
                        <Checkbox
                          checked={all ? !locked : sel.units.includes(c.id)}
                          disabled={locked || all}
                          onCheckedChange={() => onToggle([c.id])}
                          aria-label={`Chọn thùng ${c.barcode}`}
                        />
                        <span className="flex-1 font-mono">
                          {c.barcode}
                          {c.parentBarcode ? (
                            <span className="text-muted-foreground">
                              {' '}
                              · trong {c.parentBarcode}
                            </span>
                          ) : null}
                          {locked ? <span className="text-warning"> · đã quét lấy</span> : null}
                        </span>
                        <span className="tabular-nums">{formatQuantity(c.qty)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {qtyGt(i.looseQty, ZERO) ? (
              <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Hàng rời chuyển ({i.baseUomCode}, tối đa {formatQuantity(max)})
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Hàng rời ${i.skuCode} chuyển`}
                  aria-invalid={bad}
                  disabled={all}
                  className={cn(
                    'h-10 w-28 rounded-md border bg-background px-2 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    bad && 'border-destructive text-destructive',
                  )}
                  value={raw}
                  placeholder="0"
                  onChange={(e) => onLoose(key, e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={all || !qtyGt(max, ZERO)}
                  onClick={() => onLoose(key, plainQty(max))}
                >
                  Hết
                </Button>
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RelocateDone({ result: r }: { result: PdaRelocateResult }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <CheckCircle2 className="h-16 w-16 text-success" aria-hidden />
      <p className="text-2xl font-bold">
        Đã chuyển {r.fromLocation.code} → {r.toLocation.code}
      </p>
      <p className="text-muted-foreground">
        {r.containersMoved > 0 ? `${r.containersMoved} thùng · ` : ''}
        {formatQuantity(r.qtyMoved)} tổng số lượng
      </p>
      {r.pickLinesRepointed > 0 ? (
        <p>
          {r.pickLinesRepointed} dòng lấy hàng chuyển sang vị trí mới
          {r.pickLinesSplit > 0 ? ` (${r.pickLinesSplit} dòng tách)` : ''}
        </p>
      ) : null}
      {r.skippedPicked.length > 0 ? (
        <p className="text-warning">Bỏ qua {r.skippedPicked.length} thùng đã quét lấy cho đơn</p>
      ) : null}
      {r.shortages.length > 0 ? (
        <p className="text-warning">
          {r.shortages.length} đơn thiếu hàng → Sự cố:{' '}
          {r.shortages.map((s) => s.taskDocNumber).join(', ')}
        </p>
      ) : null}
    </div>
  );
}
