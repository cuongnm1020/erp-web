'use client';

import { useQueryClient } from '@tanstack/react-query';
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
  isResyncRunning,
  usePancakeOrderResyncStatus,
  useStartPancakeOrderResync,
  type PancakeOrderResyncStatus,
} from '../api/use-pancake-order-resync';
import { orderKeys, usePancakeShops } from '../api/use-orders';

const COUNT_LABELS: Array<[keyof PancakeOrderResyncStatus['counts'], string]> = [
  ['updated', 'Đã ghi đè'],
  ['pickReplanned', 'Sinh lại việc lấy hàng'],
  ['skipped', 'Bỏ qua — kho đã làm'],
  ['failed', 'Lỗi'],
];

function summary(s: PancakeOrderResyncStatus): string {
  const c = s.counts;
  return `${s.total} đơn: ${c.updated} ghi đè, ${c.skipped} bỏ qua, ${c.failed} lỗi`;
}

/**
 * Nút "Đồng bộ đơn Pancake" ở danh sách đơn (2026-10-12): chọn POS → server chạy nền, lấy lại
 * từng đơn "Chờ xử lý kho" của POS đó từ Pancake và GHI ĐÈ lên ERP (khách, địa chỉ giao, sản phẩm,
 * tiền, trạng thái). Đơn kho đã nhận việc lấy hàng / đóng gói giữ nguyên. Bọc trong <Can map Sync>.
 * `defaultShopId` = POS đang lọc trên danh sách (nếu có).
 */
export function PancakeOrderResyncButton({ defaultShopId = '' }: { defaultShopId?: string }) {
  const [open, setOpen] = useState(false);
  const shops = usePancakeShops();
  const active = (shops.data ?? []).filter((s) => s.isActive);
  const [picked, setPicked] = useState('');
  const shopId = picked || defaultShopId || (active.length === 1 ? (active[0]?.shopId ?? '') : '');
  const status = usePancakeOrderResyncStatus(shopId);
  const start = useStartPancakeOrderResync();
  const qc = useQueryClient();
  const s = status.data;
  const running = isResyncRunning(s);

  // Lượt vừa xong → báo + làm mới danh sách đơn (kể cả khi dialog đã đóng).
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!s) return;
    if (wasRunning.current && !running) {
      void qc.invalidateQueries({ queryKey: orderKeys.lists() });
      if (s.state === 'failed')
        toast.error('Đồng bộ đơn Pancake dừng giữa chừng — mở lại để xem lỗi');
      else if (s.counts.failed > 0)
        toast.error(`Đồng bộ đơn Pancake xong nhưng có lỗi — ${summary(s)}`);
      else toast.success(`Đồng bộ đơn Pancake xong — ${summary(s)}`);
    }
    wasRunning.current = running;
  }, [s, running, qc]);

  const shopName = (id: string) => {
    const shop = (shops.data ?? []).find((x) => x.shopId === id);
    return shop?.shopName ? `Pancake · ${shop.shopName}` : `Pancake · ${id}`;
  };

  const onStart = () =>
    start.mutate(shopId, {
      onSuccess: () => toast.success(`Đã bắt đầu đồng bộ đơn từ ${shopName(shopId)}`),
      onError: (err) => toast.error(messageFor(err)),
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw
          aria-hidden
          className={running ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
        {running && s ? `Đang đồng bộ ${s.done}/${s.total || '…'}` : 'Đồng bộ đơn Pancake'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Đồng bộ đơn từ Pancake</DialogTitle>
            <DialogDescription>
              Lấy lại từ Pancake các đơn đang <strong>Chờ xử lý kho</strong> của POS đã chọn và ghi
              đè thông tin trên hệ thống: khách, địa chỉ giao, sản phẩm, tiền, trạng thái. Đơn kho
              đã nhận việc lấy hàng hoặc đã đóng gói được giữ nguyên. Địa chỉ và trạng thái đã sửa
              tay trên hệ thống không bị ghi đè. Chạy nền, có thể đóng cửa sổ này.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">POS</legend>
            {shops.isLoading ? (
              <p className="text-sm text-muted-foreground">Đang tải danh sách POS…</p>
            ) : shops.isError ? (
              <p className="text-sm text-destructive">{messageFor(shops.error)}</p>
            ) : active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có POS nào đang kết nối.{' '}
                <Link href="/admin/pancake" className="text-primary hover:underline">
                  Kết nối Pancake
                </Link>
              </p>
            ) : (
              <div className="grid gap-1">
                {active.map((shop) => (
                  <label
                    key={shop.shopId}
                    className="flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="pancake-resync-shop"
                      value={shop.shopId}
                      checked={shopId === shop.shopId}
                      onChange={() => setPicked(shop.shopId)}
                      disabled={running}
                    />
                    <span>{shop.shopName ?? 'Chưa đặt tên'}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {shop.shopId}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {shopId === '' ? null : status.isError ? (
            <p className="text-sm text-destructive">{messageFor(status.error)}</p>
          ) : s && s.state !== 'idle' ? (
            <ResyncStatus s={s} />
          ) : (
            <p className="text-sm text-muted-foreground">POS này chưa đồng bộ lần nào.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={onStart}
              disabled={shopId === '' || running || start.isPending || status.isLoading}
            >
              <RefreshCw aria-hidden />
              {running ? 'Đang chạy…' : 'Đồng bộ đơn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResyncStatus({ s }: { s: PancakeOrderResyncStatus }) {
  const running = isResyncRunning(s);
  const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  const rows = [
    ...s.failures.map((f) => ({ ...f, kind: 'Lỗi' as const })),
    ...s.skippedOrders.map((f) => ({ ...f, kind: 'Bỏ qua' as const })),
  ];
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
            {s.done}/{s.total} đơn
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

      <dl className="grid grid-cols-2 gap-2">
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

      {s.error && <p className="text-destructive">Lỗi: {s.error}</p>}

      {rows.length > 0 && (
        <div className="max-h-48 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Đơn</th>
                <th className="px-2 py-1 text-left font-medium">Kết quả</th>
                <th className="px-2 py-1 text-left font-medium">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.orderId}`} className="border-t align-top">
                  <td className="px-2 py-1">
                    <Link
                      href={`/crm/orders/${r.orderId}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {r.docNumber}
                    </Link>
                    <div className="text-muted-foreground">Pancake #{r.externalId}</div>
                  </td>
                  <td className={r.kind === 'Lỗi' ? 'px-2 py-1 text-destructive' : 'px-2 py-1'}>
                    {r.kind}
                  </td>
                  <td className="px-2 py-1 break-words">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
