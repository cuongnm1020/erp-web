'use client';

import { CheckCircle2, CircleAlert, Keyboard, PackageCheck, WifiOff } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Barcode } from '@/components/data/barcode';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { EmptyState, ForbiddenState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { taskStatusLabel } from '../labels';
import { usePdaQueue, usePdaStats } from '../api/use-pda';
import { useScanSession } from '../scan-session';
import { LabelPrintDialog } from './label-print-dialog';

/**
 * Trạm đóng gói (PLAN-barcode-pick-pack D1) — desktop + máy quét USB (keyboard wedge).
 * Quét mã đơn → nhận task PACK (claim) → quét từng SKU (server đối chiếu, không tin client)
 * → dòng đủ tự đóng → dòng cuối → popup nhãn vận đơn (LabelPrintDialog). Đơn đang đóng nằm
 * trên URL `?order=` (luật 8). Phím: F2 về ô quét, Esc bỏ đơn đang mở, ? trợ giúp.
 * Quyền: task.execute (quét) + shipment.pack (nhãn) — cả hai thuộc role WAREHOUSE.
 */
export function PackStationScreen() {
  const ability = useAbility();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const s = useScanSession('PACK');
  const scanRef = useRef<ScanInputHandle>(null);
  const [qty, setQty] = useState('1');
  const [help, setHelp] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const canExecute = ability.can('execute', 'Task');
  // Hàng đợi đóng gói (đơn đã pick xong, chưa ai nhận + của tôi) và số đơn tôi đã đóng hôm nay.
  const queue = usePdaQueue('PACK', canExecute);
  const stats = usePdaStats('PACK', null, canExecute);

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
      void s.scan(code, qty || '1');
      setQty('1');
    } else if (s.phase === 'idle') {
      void s.open(code);
    }
  };

  if (!canExecute) return <ForbiddenState className="m-6" />;

  const task = s.task;
  const doneLines = task?.lines.filter((l) => l.status === 'COMPLETED').length ?? 0;

  return (
    <>
      <PageHeader
        title="Trạm đóng gói"
        description={
          task
            ? `${s.order.docNumber ?? task.docNumber} · ${doneLines}/${task.lines.length} dòng`
            : `Quét mã đơn hàng để bắt đầu · hôm nay bạn đã đóng ${stats.data?.completed ?? '…'} đơn · ${queue.data?.waiting ?? '…'} đơn chờ`
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Trạm đóng gói' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHelp(true)} title="Phím tắt (?)">
              <Keyboard aria-hidden />
              Phím tắt
            </Button>
            {task ? (
              <Button variant="outline" size="sm" onClick={clearOrder}>
                Bỏ đơn đang mở (Esc)
              </Button>
            ) : null}
          </div>
        }
      />

      {s.offline ? (
        <p
          role="status"
          className="mb-3 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
        >
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — lần quét vừa rồi chưa được ghi. Kiểm tra mạng rồi quét lại.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <ScanInput
          ref={scanRef}
          className="flex-1"
          size="lg"
          label={task ? 'Quét sản phẩm' : 'Quét mã đơn'}
          placeholder={task ? 'Quét mã vạch sản phẩm…' : 'Quét mã đơn / mã việc / vận đơn…'}
          onScan={onScan}
          paused={labelOpen || help}
          disabled={s.phase === 'opening' || s.phase === 'done'}
        />
        {task ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Số lượng / lần quét</span>
            <Input
              inputMode="numeric"
              className="h-14 w-24 text-center text-lg"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
              onFocus={(e) => e.target.select()}
              aria-label="Số lượng mỗi lần quét"
            />
          </label>
        ) : null}
      </div>

      {s.feedback ? (
        <p
          role={s.feedback.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
            s.feedback.kind === 'error' &&
              'border-destructive/50 bg-destructive/10 text-destructive',
            s.feedback.kind === 'ok' && 'border-success/50 bg-success/10 text-success',
            s.feedback.kind === 'info' && 'border-info/50 bg-info/10 text-info',
          )}
        >
          {s.feedback.kind === 'error' ? (
            <CircleAlert className="h-4 w-4" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          )}
          {s.feedback.text}
        </p>
      ) : null}

      {s.phase === 'opening' ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Đang mở việc…
        </p>
      ) : null}

      {!task && s.phase === 'idle' ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <EmptyState
            className="lg:col-span-2"
            title="Chưa có đơn nào đang đóng"
            description="Quét mã vạch trên phiếu đơn hàng (hoặc mã việc PACK) để nhận việc và bắt đầu quét sản phẩm. Hoặc chọn một đơn trong hàng đợi bên cạnh."
          />
          <section className="rounded-md border bg-card" aria-label="Hàng đợi đóng gói">
            <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
              <span className="font-semibold">Chờ đóng gói</span>
              <span className="text-muted-foreground">
                {queue.data ? `${queue.data.waiting} chờ · ${queue.data.mine} của tôi` : '…'}
              </span>
            </header>
            {queue.isError ? (
              <p className="px-3 py-3 text-xs text-destructive">Không tải được hàng đợi.</p>
            ) : !queue.data ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Đang tải…</p>
            ) : queue.data.items.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                Không có đơn nào chờ đóng gói — đơn pick xong sẽ hiện ở đây.
              </p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {queue.data.items.map((q) => (
                  <li key={q.taskId}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => void s.open(q.refDocNumber ?? q.docNumber)}
                      aria-label={`Mở ${q.refDocNumber ?? q.docNumber}`}
                    >
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">
                          {q.refDocNumber ?? q.docNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {q.lineCount} dòng · chờ {q.ageMinutes} phút
                        </span>
                      </span>
                      <StatusBadge tone={q.assignedToMe ? 'brand' : 'neutral'}>
                        {q.assignedToMe ? 'Của tôi' : 'Chưa nhận'}
                      </StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <footer className="border-t px-3 py-2 text-xs text-muted-foreground">
              Hôm nay ({stats.data?.date ?? '…'}) bạn đã đóng{' '}
              <b className="text-foreground">{stats.data?.completed ?? '…'}</b> đơn
              {stats.data?.items[0]?.completedAt
                ? ` · gần nhất ${formatDateTime(stats.data.items[0].completedAt)}`
                : ''}
              .
            </footer>
          </section>
        </div>
      ) : null}

      {task ? (
        <div className="mt-3 overflow-hidden rounded-md border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="font-mono font-semibold">{s.order.docNumber ?? task.docNumber}</span>
              {s.order.customerName ? (
                <span className="text-muted-foreground">· {s.order.customerName}</span>
              ) : null}
              <StatusBadge tone={task.status === 'COMPLETED' ? 'ok' : 'brand'}>
                {taskStatusLabel(task.status)}
              </StatusBadge>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{task.docNumber}</span>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Sản phẩm</TableHead>
                  <TableHead className="w-24 px-2.5 text-right text-xs">Cần</TableHead>
                  <TableHead className="w-24 px-2.5 text-right text-xs">Đã quét</TableHead>
                  <TableHead className="w-24 px-2.5 text-right text-xs">Còn</TableHead>
                  <TableHead className="w-44 px-2.5 text-xs">Mã quét</TableHead>
                  <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.lines.map((l) => {
                  const done = l.status === 'COMPLETED';
                  return (
                    <TableRow key={l.taskLineId} className={done ? 'bg-success/5' : undefined}>
                      <TableCell className="px-2.5 py-1.5">
                        <div className="font-semibold">{l.skuName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{l.skuCode}</div>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatQuantity(l.qtyPlanned)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatQuantity(l.qtyDone)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                        {formatQuantity(l.qtyRemaining)}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {l.barcodes[0] ? (
                          <Barcode value={l.barcodes[0]} symbology="code128" height={6} scale={1} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge
                          tone={done ? 'ok' : l.status === 'IN_PROGRESS' ? 'warn' : 'neutral'}
                        >
                          {done ? 'Đủ' : taskStatusLabel(l.status)}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

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
    </>
  );
}
