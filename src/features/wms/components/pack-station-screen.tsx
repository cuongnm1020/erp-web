'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Keyboard,
  Minus,
  PackageCheck,
  Plus,
  WifiOff,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ForbiddenState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { usePdaQueue, usePdaStats } from '../api/use-pda';
import { useScanSession } from '../scan-session';
import { LabelPrintDialog } from './label-print-dialog';
import { PdaListColumn } from './pda-list-column';
import { SkuBarcodes } from './sku-barcodes';

/**
 * Trạm đóng gói (PLAN-barcode-pick-pack D1) — desktop + máy quét USB (keyboard wedge), cùng bố
 * cục với màn pick PDA: header việc đang mở + tiến độ, màn chờ hai cột ("Chờ đóng gói" /
 * "Đã đóng gói hôm nay"), thẻ dòng đang đóng to (tên, mã, mã vạch, còn bao nhiêu), danh sách
 * dòng, chân trang dính với ô quét + số lượng + nút chính.
 * Quét mã đơn → nhận task PACK (claim) → quét từng SKU (server đối chiếu, không tin client)
 * → dòng đủ tự đóng → dòng cuối → popup nhãn vận đơn (LabelPrintDialog). Đơn đang đóng nằm
 * trên URL `?order=` (luật 8). Phím: F2 về ô quét, Esc bỏ đơn đang mở, ? trợ giúp.
 * Quyền: task.execute (quét) + shipment.pack (nhãn) — cả hai thuộc role WAREHOUSE / PACKER.
 */
export function PackStationScreen() {
  const ability = useAbility();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const s = useScanSession('PACK');
  const scanRef = useRef<ScanInputHandle>(null);
  const [qty, setQty] = useState(1);
  const [help, setHelp] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const canExecute = ability.can('execute', 'Task');
  // Hai cột khi chưa mở đơn: hàng đợi (đơn đã pick xong, chưa ai nhận + của tôi) + đơn tôi đã đóng hôm nay.
  const queue = usePdaQueue('PACK', canExecute);
  const doneToday = usePdaStats('PACK', null, canExecute);
  const idle = s.phase === 'idle';
  useEffect(() => {
    // Quay về màn chờ (sau "Quét đơn kế tiếp") → làm tươi hai cột ngay, không đợi 30s.
    if (idle && canExecute) {
      void queue.refetch();
      void doneToday.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, canExecute]);

  // URL → phiên: F5 hoặc dán link ?order=SO… mở lại đúng đơn.
  const urlOrder = search.get('order');
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!canExecute) return;
    if (urlOrder && s.phase === 'idle' && opened.current !== urlOrder) {
      opened.current = urlOrder;
      void s.open(urlOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo URL lúc vào màn
  }, [urlOrder, canExecute]);

  const setUrlOrder = (doc: string | null) => {
    const params = new URLSearchParams(search);
    if (doc) params.set('order', doc);
    else params.delete('order');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (s.phase === 'ready' && s.order.docNumber && urlOrder !== s.order.docNumber) {
      setUrlOrder(s.order.docNumber);
    }
    if (s.phase === 'done' && s.completion) setLabelOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.order.docNumber]);

  const clearOrder = () => {
    s.clear();
    opened.current = null;
    setLabelOpen(false);
    setQty(1);
    setUrlOrder(null);
    scanRef.current?.focus();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanRef.current?.focus();
      } else if (e.key === 'Escape' && !labelOpen && !help) {
        clearOrder();
      } else if (e.key === '?' && !(e.target instanceof HTMLInputElement)) {
        setHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelOpen, help]);

  const onScan = (code: string) => {
    if (s.phase === 'ready' && s.task) {
      void s.scan(code, String(qty));
      setQty(1);
    } else if (s.phase === 'idle') {
      void s.open(code);
    }
  };

  if (!canExecute) return <ForbiddenState className="m-4" />;

  const { phase, feedback, task } = s;
  // Dòng đang đứng — dòng đầu tiên chưa đóng (thứ tự dòng của việc).
  const current =
    task?.lines.find(
      (l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED' && l.status !== 'EXCEPTION',
    ) ?? null;
  const heading = task ? (s.order.docNumber ?? task.docNumber) : 'Chưa nhận việc';
  const progress = task
    ? `${task.lines.filter((l) => l.status === 'COMPLETED').length}/${task.lines.length} dòng`
    : null;

  return (
    // -m-4 + min-h trừ header 3.5rem của shell: màn choán hết vùng nội dung để chân trang dính đáy.
    <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] flex-col bg-background text-base">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Đóng gói</div>
          <div className="truncate font-mono text-lg font-semibold">{heading}</div>
          {task && s.order.customerName ? (
            <div className="truncate text-sm text-muted-foreground">{s.order.customerName}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {progress ? (
            <div className="text-right text-sm text-muted-foreground">{progress}</div>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Phím tắt (?)"
            title="Phím tắt (?)"
            onClick={() => setHelp(true)}
          >
            <Keyboard aria-hidden />
          </Button>
        </div>
      </header>

      {s.offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — lần quét vừa rồi chưa được ghi. Kiểm tra mạng rồi quét lại.
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
                Mã trên phiếu đơn hàng, phiếu đóng gói hoặc vận đơn — hoặc chạm một đơn trong hàng
                đợi bên dưới.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PdaListColumn
                title="Chờ đóng gói"
                hint={queue.data ? `${queue.data.waiting} chờ · ${queue.data.mine} của tôi` : ''}
                count={queue.data?.items.length ?? null}
                error={queue.isError}
                empty="Không có đơn nào chờ đóng gói — đơn pick xong sẽ hiện ở đây."
              >
                {queue.data?.items.map((q) => (
                  <li key={q.taskId}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => void s.open(q.refDocNumber ?? q.docNumber)}
                      aria-label={`Mở ${q.refDocNumber ?? q.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">
                          {q.refDocNumber ?? q.docNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {q.docNumber} · {q.lineCount} dòng · chờ {q.ageMinutes} phút
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
                        {!q.assignedToMe
                          ? 'Chưa nhận'
                          : q.status === 'IN_PROGRESS'
                            ? 'Đang đóng gói'
                            : 'Của tôi'}
                      </span>
                    </button>
                  </li>
                ))}
              </PdaListColumn>
              <PdaListColumn
                title="Đã đóng gói hôm nay"
                hint={doneToday.data?.date ?? ''}
                count={doneToday.data?.completed ?? null}
                error={doneToday.isError}
                empty="Hôm nay chưa đóng gói xong đơn nào."
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

        {phase === 'ready' && current ? (
          <section className="rounded-lg border bg-card p-4" aria-label="Dòng đang đóng">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PackageCheck className="h-4 w-4" aria-hidden />
              Sản phẩm
            </div>
            <div className="text-3xl font-bold leading-tight">{current.skuName}</div>
            <div className="font-mono text-sm text-muted-foreground">
              {current.skuCode}
              {current.lotNumber ? ` · lô ${current.lotNumber}` : ''}
            </div>
            <SkuBarcodes barcodes={current.barcodes} />
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">
                {formatQuantity(current.qtyRemaining)}
              </span>
              <span className="text-muted-foreground">
                còn đóng · đã {formatQuantity(current.qtyDone)}/{formatQuantity(current.qtyPlanned)}
              </span>
            </div>
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
                  <span className="font-mono font-semibold">{l.skuCode}</span>{' '}
                  <span>{l.skuName}</span>
                  {l.status === 'COMPLETED' ? (
                    <span className="ml-1 text-xs text-success">· đủ</span>
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
            <p className="text-2xl font-bold">Xong đơn {heading}</p>
            <p className="text-muted-foreground">
              {s.completion?.waybill
                ? 'In nhãn vận đơn rồi dán lên kiện.'
                : 'Đơn đã đóng gói xong.'}{' '}
              Quét đơn kế tiếp.
            </p>
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        {phase === 'ready' ? (
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
          label={phase === 'ready' ? 'Quét sản phẩm' : 'Quét mã đơn'}
          placeholder={
            phase === 'ready' ? 'Quét mã vạch sản phẩm…' : 'Quét mã đơn / mã việc / vận đơn…'
          }
          onScan={onScan}
          paused={labelOpen || help}
          disabled={phase === 'opening' || phase === 'done'}
        />
        {phase === 'done' ? (
          <Button className="h-[72px] text-lg" onClick={clearOrder}>
            Quét đơn kế tiếp
          </Button>
        ) : phase === 'ready' ? (
          <Button variant="outline" className="h-14" onClick={clearOrder}>
            Bỏ đơn đang mở (Esc)
          </Button>
        ) : (
          <Button className="h-[72px] text-lg" onClick={() => scanRef.current?.focus()}>
            Quét mã vạch (F2)
          </Button>
        )}
      </footer>

      <LabelPrintDialog
        open={labelOpen}
        waybill={s.completion?.waybill ?? null}
        orderId={s.order.id}
        onClose={clearOrder}
      />

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Phím tắt trạm đóng gói</DialogTitle>
            <DialogDescription>Máy quét USB gõ mã rồi Enter — không cần chuột.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="font-mono">Enter</dt>
            <dd>Gửi mã vừa quét / gõ</dd>
            <dt className="font-mono">F2</dt>
            <dd>Về ô quét</dd>
            <dt className="font-mono">Esc</dt>
            <dd>Bỏ đơn đang mở, quét đơn khác</dd>
            <dt className="font-mono">?</dt>
            <dd>Bảng này</dd>
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
