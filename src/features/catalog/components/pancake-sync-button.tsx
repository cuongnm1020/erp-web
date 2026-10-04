'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import {
  isBulkPushRunning,
  usePancakeBulkPushStatus,
  useStartPancakeBulkPush,
  type PancakeBulkPushStatus,
} from '../api/use-pancake-push';

const COUNT_LABELS: Array<[keyof PancakeBulkPushStatus['counts'], string]> = [
  ['created', 'Tạo mới'],
  ['linked', 'Đã có sẵn — liên kết'],
  ['updated', 'Cập nhật'],
  ['hidden', 'Ẩn'],
  ['skipped', 'Bỏ qua'],
  ['failed', 'Lỗi'],
];

function summary(s: PancakeBulkPushStatus): string {
  const c = s.counts;
  return `${s.total} sản phẩm: ${c.created} tạo mới, ${c.linked} liên kết, ${c.updated} cập nhật, ${c.failed} lỗi`;
}

/**
 * Nút "Đồng bộ Pancake" ở danh sách sản phẩm: đẩy TOÀN BỘ sản phẩm (trừ combo, đã xóa) lên
 * MỌI shop Pancake đang kết nối. Server chạy nền (job BullMQ) — mỗi sản phẩm dò trên Pancake
 * theo mã sản phẩm / mã SKU trước khi tạo, thấy thì liên kết + cập nhật, không tạo trùng.
 * Dialog hiện tiến độ, kết quả lượt gần nhất và các dòng lỗi. Bọc trong <Can config Sync>.
 */
export function PancakeSyncButton() {
  const [open, setOpen] = useState(false);
  const status = usePancakeBulkPushStatus();
  const start = useStartPancakeBulkPush();
  const s = status.data;
  const running = isBulkPushRunning(s);

  // Báo khi lượt đang chạy vừa xong — kể cả khi dialog đã đóng.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!s) return;
    if (wasRunning.current && !running) {
      if (s.state === 'failed') toast.error('Đồng bộ Pancake dừng giữa chừng — mở lại để xem lỗi');
      else if (s.counts.failed > 0)
        toast.error(`Đồng bộ Pancake xong nhưng có lỗi — ${summary(s)}`);
      else toast.success(`Đồng bộ Pancake xong — ${summary(s)}`);
    }
    wasRunning.current = running;
  }, [s, running]);

  const onStart = () =>
    start.mutate(undefined, {
      onSuccess: () => toast.success('Đã bắt đầu đồng bộ sản phẩm lên Pancake'),
      onError: (err) => toast.error(messageFor(err)),
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw
          aria-hidden
          className={running ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
        {running && s ? `Đang đồng bộ ${s.done}/${s.total || '…'}` : 'Đồng bộ Pancake'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Đồng bộ sản phẩm lên Pancake</DialogTitle>
            <DialogDescription>
              Đẩy toàn bộ sản phẩm (trừ combo và sản phẩm đã xóa) lên mọi shop Pancake đang kết nối.
              Sản phẩm đã có trên Pancake — trùng mã sản phẩm hoặc mã SKU — được liên kết và cập
              nhật, không tạo bản trùng. Chạy nền, có thể đóng cửa sổ này.
            </DialogDescription>
          </DialogHeader>

          {status.isError ? (
            <p className="text-sm text-destructive">{messageFor(status.error)}</p>
          ) : s && s.state !== 'idle' ? (
            <BulkStatus s={s} />
          ) : (
            <p className="text-sm text-muted-foreground">Chưa chạy lần nào.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button onClick={onStart} disabled={running || start.isPending || status.isLoading}>
              <RefreshCw aria-hidden />
              {running ? 'Đang chạy…' : s && s.state !== 'idle' ? 'Chạy lại' : 'Bắt đầu đồng bộ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkStatus({ s }: { s: PancakeBulkPushStatus }) {
  const running = isBulkPushRunning(s);
  const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 flex justify-between text-muted-foreground">
          <span>
            {running
              ? s.state === 'waiting'
                ? 'Đang chờ worker…'
                : 'Đang đồng bộ…'
              : s.state === 'failed'
                ? 'Dừng giữa chừng'
                : 'Lượt gần nhất'}
            {s.finishedAt ? ` · xong ${formatDateTime(s.finishedAt)}` : ''}
          </span>
          <span className="tabular-nums">
            {s.done}/{s.total} sản phẩm
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {COUNT_LABELS.map(([k, label]) => (
          <div key={k} className="rounded border px-2 py-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={
                k === 'failed' && s.counts.failed > 0
                  ? 'font-medium tabular-nums text-destructive'
                  : 'font-medium tabular-nums'
              }
            >
              {s.counts[k]}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">Mỗi sản phẩm tính một lần cho mỗi shop.</p>

      {s.error && <p className="text-destructive">Lỗi: {s.error}</p>}

      {s.failures.length > 0 && (
        <div className="max-h-48 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Sản phẩm</th>
                <th className="px-2 py-1 text-left font-medium">Shop</th>
                <th className="px-2 py-1 text-left font-medium">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {s.failures.map((f) => (
                <tr key={`${f.shopId}-${f.productId}`} className="border-t align-top">
                  <td className="px-2 py-1">
                    <Link
                      href={`/catalog/products/${f.productId}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {f.productCode}
                    </Link>
                    <div className="text-muted-foreground">{f.productName}</div>
                  </td>
                  <td className="px-2 py-1 tabular-nums">{f.shopId}</td>
                  <td className="px-2 py-1 break-words">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
