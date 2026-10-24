'use client';

import Decimal from 'decimal.js';
import { ArrowLeft, Camera, CheckCircle2, Info, PackageOpen, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { CameraScanner, isCameraScanSupported } from '@/components/data/camera-scanner';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState, ListSkeleton } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useBarcodeLookup } from '../api/use-locations';
import {
  useCreateReturn,
  usePostReturn,
  useReturnable,
  type ReturnableLine,
  type ReturnableOrder,
} from '../api/use-returns';
import { SHIPMENT_STATUS_BADGE } from '../labels';
import {
  dec,
  RETURN_REASONS,
  returnBodyLines,
  returnLineError,
  usedQty,
  type ReturnLineInput,
} from '../return-lines';
import { PdaFeedbackBanner, type PdaFeedback } from './pda-feedback';

/** Kiện vừa nhận trong phiên (chỉ bộ nhớ màn — danh sách thật ở /wms/returns). */
interface Received {
  receiptId: string;
  receiptDoc: string;
  orderDoc: string;
  parcel: string;
  qty: string;
}

/**
 * Quét kiện hoàn trên máy PDA / điện thoại (2026-10-24, mockup BYJLeCXZZGwGcjmsgogDuR): quét mã
 * vạch vận đơn trên kiện (máy quét kiểu bàn phím, hoặc camera điện thoại qua BarcodeDetector) →
 * ra đơn → nhập SL nhập lại kho / hỏng từng dòng (quét mã sản phẩm để cộng) → NHẬP KHO = tạo
 * phiếu nhập hàng hoàn + post ngay. Mã kiện đang xem nằm trên URL (`?code=`, luật 8).
 */
export function PdaReturnsScreen() {
  const canReceive = useAbility().can('receive', 'Stock');
  const router = useRouter();
  const code = useSearchParams().get('code')?.trim() || undefined;
  const query = useReturnable(canReceive && code ? { code } : {});
  const scanRef = useRef<ScanInputHandle>(null);
  const [camera, setCamera] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);
  const [received, setReceived] = useState<Received[]>([]);
  const [done, setDone] = useState<Received | null>(null);
  // Chỉ biết sau khi lên client (window) — tránh lệch SSR / hydrate.
  useEffect(() => setCameraOk(isCameraScanSupported()), []);

  if (!canReceive) return <ForbiddenState className="m-4" />;

  const openParcel = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setDone(null);
    router.replace(`/pda/returns?code=${encodeURIComponent(v)}`);
  };
  const reset = () => {
    setDone(null);
    router.replace('/pda/returns');
    scanRef.current?.focus();
  };
  const onPosted = (r: Received) => {
    beep('ok');
    setReceived((cur) => [r, ...cur].slice(0, 20));
    setDone(r);
    router.replace('/pda/returns');
  };

  const order = code && !done ? query.data : undefined;
  const offline = query.isError && isApiError(query.error) && query.error.status === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="border-b bg-card px-4 py-3">
        {order ? (
          <button
            type="button"
            onClick={reset}
            className="-m-2 flex min-h-control items-center gap-1 p-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Quét kiện khác
          </button>
        ) : (
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Nhập hàng hoàn
          </div>
        )}
        <h1 className={cn('text-xl font-bold', order && 'font-mono')}>
          {order ? order.docNumber : 'Quét kiện hoàn'}
        </h1>
      </header>

      {offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning-weak px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — nhập hàng hoàn cần mạng.
        </p>
      ) : null}

      {done ? (
        <DoneView done={done} received={received} onNext={reset} />
      ) : !code ? (
        <IdleView
          scanRef={scanRef}
          cameraOk={cameraOk}
          onScan={openParcel}
          onCamera={() => setCamera(true)}
        />
      ) : query.isPending ? (
        <main className="flex-1 px-4 py-3">
          <ListSkeleton rows={4} />
        </main>
      ) : query.isError ? (
        <LookupError code={code} error={query.error} onRetry={reset} />
      ) : order ? (
        <OrderForm
          key={order.orderId}
          order={order}
          parcel={code}
          onNewParcel={openParcel}
          onPosted={onPosted}
        />
      ) : null}

      {camera ? (
        <CameraScanner
          title="Quét vận đơn"
          hint="Đưa mã vạch vận đơn vào khung. Máy rung và tự đóng khi đọc được."
          onClose={() => setCamera(false)}
          onDetect={(c) => {
            setCamera(false);
            openParcel(c);
          }}
        />
      ) : null}
    </div>
  );
}

function IdleView({
  scanRef,
  cameraOk,
  onScan,
  onCamera,
}: {
  scanRef: RefObject<ScanInputHandle | null>;
  cameraOk: boolean;
  onScan: (code: string) => void;
  onCamera: () => void;
}) {
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <PackageOpen className="h-16 w-16 text-muted-foreground" aria-hidden />
        <p className="text-xl font-bold">Quét mã vạch vận đơn trên kiện</p>
        <p className="text-muted-foreground">
          Máy ra đơn của kiện để nhập lại kho. Nhận mã vận đơn GHTK, Viettel Post, VNPost, mã phiếu
          giao hoặc số đơn.
        </p>
      </main>
      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        <ScanInput
          ref={scanRef}
          size="lg"
          label="Mã trên kiện"
          placeholder="Quét hoặc gõ mã vận đơn…"
          onScan={onScan}
        />
        {cameraOk ? (
          <Button className="h-pda-primary text-xl font-bold" onClick={onCamera}>
            <Camera className="h-6 w-6" aria-hidden />
            QUÉT BẰNG CAMERA
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          {cameraOk
            ? 'Máy PDA: bóp cò quét, mã tự vào ô trên. Điện thoại: bấm nút camera.'
            : 'Bóp cò máy quét, hoặc gõ mã rồi Enter.'}
        </p>
      </footer>
    </>
  );
}

function LookupError({
  code,
  error,
  onRetry,
}: {
  code: string;
  error: unknown;
  onRetry: () => void;
}) {
  const feedback: PdaFeedback =
    isApiError(error) && error.status === 404
      ? {
          kind: 'error',
          text: `Không ra đơn nào cho mã ${code}`,
          detail:
            'Kiểm tra lại tem, hoặc gõ số đơn ghi trên phiếu giao. Tem GHTK: quét mã vạch chính, không quét mã QR shop.',
        }
      : isApiError(error) && error.status === 403
        ? {
            kind: 'error',
            text: 'Đơn của kiện này thuộc kho bạn chưa được cấp',
            detail: 'Chuyển kiện về đúng kho hoặc nhờ quản lý cấp quyền kho.',
          }
        : {
            kind: 'error',
            text: messageFor(error),
            traceId: isApiError(error) ? error.traceId : undefined,
          };
  useEffect(() => beep('error'), []);
  return (
    <>
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <PdaFeedbackBanner feedback={feedback} />
      </main>
      <footer className="sticky bottom-0 border-t bg-background px-4 pb-4 pt-3">
        <Button
          variant="destructive"
          className="h-pda-primary w-full text-xl font-bold"
          onClick={onRetry}
        >
          QUÉT LẠI
        </Button>
      </footer>
    </>
  );
}

function OrderForm({
  order,
  parcel,
  onNewParcel,
  onPosted,
}: {
  order: ReturnableOrder;
  parcel: string;
  onNewParcel: (code: string) => void;
  onPosted: (r: Received) => void;
}) {
  const create = useCreateReturn();
  const post = usePostReturn();
  const lookupBarcode = useBarcodeLookup();
  const sh = order.shipment;
  const [inputs, setInputs] = useState<Record<string, ReturnLineInput>>({});
  const [reason, setReason] = useState<string>(
    sh && sh.status !== 'DELIVERED' ? RETURN_REASONS[1] : RETURN_REASONS[0],
  );
  const [feedback, setFeedback] = useState<PdaFeedback | null>(null);
  // Idempotency-Key theo phiên form — sinh lúc bấm, đổi khi SL đổi (luật 4).
  const idemKey = useRef<string | null>(null);
  // Phiếu nháp đã tạo nhưng post lỗi → bấm lại chỉ post, không tạo phiếu mới.
  const draftRef = useRef<{ receiptId: string; docNumber: string } | null>(null);
  const pending = create.isPending || post.isPending;

  const open = order.lines.filter((l) => new Decimal(l.qtyReturnable).gt(0));
  const nothingLeft = open.length === 0;
  const badge = sh ? SHIPMENT_STATUS_BADGE[sh.status] : undefined;
  const notReturnedYet = sh && sh.status !== 'RETURNED' && sh.status !== 'DELIVERED';

  const setLine = (id: string, patch: Partial<ReturnLineInput>) => {
    idemKey.current = null;
    draftRef.current = null;
    setInputs((cur) => ({ ...cur, [id]: { restock: '', scrap: '', ...cur[id], ...patch } }));
  };
  const step = (l: ReturnableLine, field: keyof ReturnLineInput, delta: number) => {
    const cur = dec(inputs[l.orderLineId]?.[field] ?? '') ?? new Decimal(0);
    const next = Decimal.max(cur.add(delta), 0);
    if (delta > 0 && usedQty(inputs[l.orderLineId]).add(delta).gt(l.qtyReturnable)) return;
    setLine(l.orderLineId, { [field]: next.isZero() ? '' : next.toString() });
  };
  const fillAll = () => {
    idemKey.current = null;
    draftRef.current = null;
    setInputs(
      Object.fromEntries(
        open.map((l) => [
          l.orderLineId,
          { restock: new Decimal(l.qtyReturnable).toString(), scrap: '' },
        ]),
      ),
    );
  };

  const errors = order.lines.map((l) => returnLineError(l, inputs[l.orderLineId]));
  const body = returnBodyLines(order.lines, inputs);
  const total = body.reduce((a, l) => a.add(l.qty), new Decimal(0));
  const restockTotal = body
    .filter((l) => l.disposition !== 'SCRAP')
    .reduce((a, l) => a.add(l.qty), new Decimal(0));
  const canSubmit = body.length > 0 && errors.every((e) => e === null) && !pending;

  /** Quét trên màn này: mã sản phẩm của đơn → +1 nhập lại; mã lạ khi chưa nhập gì → kiện mới. */
  const onScan = async (scanned: string) => {
    setFeedback(null);
    let lookup;
    try {
      ({ lookup } = await lookupBarcode(scanned));
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        if (body.length === 0) {
          onNewParcel(scanned);
          return;
        }
        beep('error');
        setFeedback({
          kind: 'warn',
          text: `Đang nhập dở đơn ${order.docNumber}`,
          detail: 'Bấm NHẬP KHO hoặc "Quét kiện khác" trước khi quét kiện mới.',
        });
        return;
      }
      beep('error');
      setFeedback({ kind: 'error', text: messageFor(err) });
      return;
    }
    const factor = new Decimal(lookup.factor);
    const same = order.lines.filter((l) => l.skuId === lookup.sku.id);
    if (same.length === 0) {
      beep('error');
      setFeedback({
        kind: 'error',
        text: `${lookup.sku.name} không có trong đơn ${order.docNumber}`,
      });
      return;
    }
    const target = same.find((l) =>
      usedQty(inputs[l.orderLineId]).add(factor).lte(l.qtyReturnable),
    );
    if (!target) {
      beep('error');
      setFeedback({ kind: 'warn', text: `${lookup.sku.name}: đã đủ số còn hoàn được` });
      return;
    }
    beep('ok');
    const next = (dec(inputs[target.orderLineId]?.restock ?? '') ?? new Decimal(0)).add(factor);
    setLine(target.orderLineId, { restock: next.toString() });
  };

  const submit = async () => {
    setFeedback(null);
    idemKey.current ??= crypto.randomUUID();
    try {
      const draft =
        draftRef.current ??
        (await create.mutateAsync({
          key: idemKey.current,
          body: { orderId: order.orderId, reason, note: `Kiện ${parcel}`, lines: body },
        }));
      draftRef.current = draft;
      await post.mutateAsync(draft.receiptId);
      onPosted({
        receiptId: draft.receiptId,
        receiptDoc: draft.docNumber,
        orderDoc: order.docNumber,
        parcel: sh?.trackingNo ?? parcel,
        qty: total.toString(),
      });
    } catch (err) {
      beep('error');
      setFeedback({
        kind: 'error',
        text: messageFor(err),
        traceId: isApiError(err) ? err.traceId : undefined,
      });
    }
  };

  return (
    <>
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {feedback ? <PdaFeedbackBanner feedback={feedback} /> : null}

        <section
          aria-label="Kiện vừa quét"
          className="flex flex-col gap-1.5 rounded-lg border bg-card p-3.5"
        >
          {sh ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{sh.carrierName ?? 'Chưa gán hãng'}</span>
                {badge ? <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> : null}
              </div>
              {sh.trackingNo ? (
                <div className="break-all font-mono text-lg">{sh.trackingNo}</div>
              ) : null}
              <div className="text-sm text-muted-foreground">Phiếu giao {sh.docNumber}</div>
            </>
          ) : (
            <div className="text-muted-foreground">Đơn chưa có phiếu giao — kiểm tra lại kiện.</div>
          )}
        </section>

        {order.stockNotDeducted ? (
          <p role="note" className="flex gap-2.5 rounded-lg bg-info-weak p-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
            <span>
              Đơn gửi qua Pancake, kho chưa trừ tồn lúc gửi. Hàng nhập lại vào vị trí <b>DEFAULT</b>
              , giá vốn tạm tính theo lô đang mở.
            </span>
          </p>
        ) : null}

        {nothingLeft ? (
          <PdaFeedbackBanner
            feedback={{
              kind: 'warn',
              text: `Đơn ${order.docNumber} không còn hàng để hoàn`,
              detail:
                'Đã nhập hoàn đủ (kiện có thể bị quét trùng), hoặc đơn chưa đóng gói. Xem phiếu ở màn Nhập hàng hoàn.',
            }}
          />
        ) : (
          <>
            {notReturnedYet && badge ? (
              <PdaFeedbackBanner
                feedback={{
                  kind: 'warn',
                  text: 'Hãng chưa báo hoàn kiện này',
                  detail: `Trạng thái hiện tại: ${badge.label}. Vẫn nhập hoàn được nếu kiện đã về tay kho.`,
                }}
              />
            ) : null}

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs text-muted-foreground">Lý do hoàn</legend>
              <div className="grid grid-cols-2 gap-2">
                {RETURN_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(r)}
                    className={cn(
                      'min-h-pda-touch rounded-lg border px-2 text-base',
                      reason === r
                        ? 'border-2 border-primary bg-secondary font-bold text-primary'
                        : 'border-input bg-card',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-xs text-muted-foreground">
              {open.length} dòng · quét mã từng sản phẩm để cộng, hoặc bấm số
            </p>

            <ul className="flex flex-col gap-2" aria-label="Dòng đơn">
              {open.map((l) => (
                <ReturnLineCard
                  key={l.orderLineId}
                  line={l}
                  input={inputs[l.orderLineId]}
                  error={errors[order.lines.indexOf(l)] ?? null}
                  onStep={(field, delta) => step(l, field, delta)}
                />
              ))}
            </ul>
          </>
        )}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-2 border-t bg-background px-4 pb-4 pt-3">
        <ScanInput
          size="lg"
          label="Quét mã sản phẩm hoặc kiện"
          placeholder="Quét mã sản phẩm hoàn về…"
          onScan={(c) => void onScan(c)}
          disabled={pending}
        />
        {!nothingLeft ? (
          <>
            <Button
              className="h-pda-primary text-xl font-bold"
              disabled={!canSubmit}
              loading={pending}
              onClick={() => void submit()}
            >
              {total.gt(0) ? `NHẬP KHO ${formatQuantity(total.toString())} SẢN PHẨM` : 'NHẬP KHO'}
            </Button>
            <div className="flex justify-center gap-6">
              <button type="button" className="min-h-pda-touch underline" onClick={fillAll}>
                Hoàn hết
              </button>
            </div>
            {restockTotal.lt(total) ? (
              <p className="text-center text-xs text-muted-foreground">
                {formatQuantity(total.sub(restockTotal).toString())} sản phẩm hỏng — không nhập kho.
              </p>
            ) : null}
          </>
        ) : null}
      </footer>
    </>
  );
}

function ReturnLineCard({
  line,
  input,
  error,
  onStep,
}: {
  line: ReturnableLine;
  input: ReturnLineInput | undefined;
  error: string | null;
  onStep: (field: keyof ReturnLineInput, delta: number) => void;
}) {
  const full = usedQty(input).gte(line.qtyReturnable);
  const loc = [line.defaultLocationCode, line.defaultLotNumber && `lô ${line.defaultLotNumber}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className={cn(
        'flex flex-col gap-2.5 rounded-lg border bg-card p-3.5',
        full && 'border-2 border-success',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold">{line.skuName}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {line.skuCode} · còn hoàn {formatQuantity(line.qtyReturnable)}
            {loc ? ` · về ${loc}` : ''}
          </div>
        </div>
        {full ? <StatusBadge tone="ok">Đủ</StatusBadge> : null}
      </div>
      <Stepper
        label="Nhập lại kho"
        value={input?.restock ?? ''}
        canAdd={!full}
        onStep={(d) => onStep('restock', d)}
        lineNo={line.lineNo}
      />
      <Stepper
        label="Hỏng, không nhập"
        value={input?.scrap ?? ''}
        canAdd={!full}
        onStep={(d) => onStep('scrap', d)}
        lineNo={line.lineNo}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </li>
  );
}

function Stepper({
  label,
  value,
  canAdd,
  onStep,
  lineNo,
}: {
  label: string;
  value: string;
  canAdd: boolean;
  onStep: (delta: number) => void;
  lineNo: number;
}) {
  const n = dec(value) ?? new Decimal(0);
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-pda-touch w-pda-touch text-2xl"
          aria-label={`Bớt 1 — ${label} dòng ${lineNo}`}
          disabled={n.isZero()}
          onClick={() => onStep(-1)}
        >
          −
        </Button>
        <span
          className={cn(
            'w-12 text-center text-3xl font-bold tabular-nums',
            n.isZero() && 'text-subtle-foreground',
          )}
          aria-label={`${label} dòng ${lineNo}`}
        >
          {formatQuantity(n.toString())}
        </span>
        <Button
          variant="outline"
          className="h-pda-touch w-pda-touch text-2xl"
          aria-label={`Thêm 1 — ${label} dòng ${lineNo}`}
          disabled={!canAdd}
          onClick={() => onStep(1)}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function DoneView({
  done,
  received,
  onNext,
}: {
  done: Received;
  received: Received[];
  onNext: () => void;
}) {
  return (
    <>
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-lg border border-success bg-success-weak px-4 py-6 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
          <span className="text-xl font-bold text-success">Đã nhập kho hàng hoàn</span>
          <span className="font-mono text-lg">{done.receiptDoc}</span>
          <span>
            {formatQuantity(done.qty)} sản phẩm · đơn {done.orderDoc}
          </span>
        </div>
        {received.length > 0 ? (
          <section aria-label="Vừa nhận trong phiên" className="rounded-lg border bg-card">
            <h2 className="border-b px-3.5 py-2.5 text-xs font-bold text-muted-foreground">
              VỪA NHẬN TRONG PHIÊN
            </h2>
            <ul>
              {received.map((r) => (
                <li
                  key={r.receiptId}
                  className="flex justify-between gap-3 border-b px-3.5 py-3 last:border-b-0"
                >
                  <span className="min-w-0 truncate font-mono" title={r.parcel}>
                    {r.parcel}
                  </span>
                  <span className="font-bold tabular-nums">{formatQuantity(r.qty)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <footer className="sticky bottom-0 flex flex-col gap-2 border-t bg-background px-4 pb-4 pt-3">
        <Button className="h-pda-primary text-xl font-bold" onClick={onNext}>
          QUÉT KIỆN TIẾP
        </Button>
        <Link
          href={`/wms/returns/${done.receiptId}`}
          className="flex min-h-pda-touch items-center justify-center text-primary underline"
        >
          Xem phiếu {done.receiptDoc}
        </Link>
      </footer>
    </>
  );
}
