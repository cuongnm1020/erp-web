'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ListSkeleton } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { Spinner } from '@/components/ui/spinner';
import {
  isShopPushRunning,
  usePancakeShopProducts,
  usePancakeShopPush,
  useProductPickSearch,
  useUpdatePancakeShopProducts,
  type PancakeShopConfig,
  type PancakeShopProduct,
  type PancakeShopPushStatus,
} from '../api/use-pancake-config';

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/**
 * Sản phẩm bán trên một shop (POS) Pancake — GET/PUT /pancake-sync/config/{shopId}/products.
 *
 * Mỗi POS bán bộ sản phẩm khác nhau. "Bán tất cả" = như trước (mọi sản phẩm ERP đẩy lên shop);
 * "Chỉ sản phẩm được chọn" = chỉ các sản phẩm tick ở đây được đẩy / hiện, sản phẩm khác đã có
 * trên shop sẽ bị ẩn. Lưu xong server đẩy ngay (job `pushJobId`): hộp thoại hiện tiến độ, đẩy hết
 * thì đóng kèm toast, còn sản phẩm chờ Pancake / lỗi thì giữ lại liệt kê (mockup duyệt 2026-11-11).
 * Danh sách chọn giữ khi chuyển về "Bán tất cả" để bật lại không phải chọn từ đầu.
 */
export function PancakeShopProductsDialog({
  shop,
  open,
  onOpenChange,
}: {
  shop: PancakeShopConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current = usePancakeShopProducts(shop.shopId);
  const save = useUpdatePancakeShopProducts(shop.shopId);
  const [restricted, setRestricted] = useState(false);
  const [selected, setSelected] = useState<Map<string, PancakeShopProduct>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim());
  const results = useProductPickSearch(debouncedQ, open && restricted);
  const [jobId, setJobId] = useState<string | null>(null);
  const push = usePancakeShopPush(shop.shopId, jobId);

  useEffect(() => {
    if (loaded || !current.data) return;
    setRestricted(current.data.restricted);
    setSelected(new Map(current.data.products.map((p) => [p.id, p])));
    setLoaded(true);
  }, [current.data, loaded]);

  const sortedSelected = useMemo(
    () => [...selected.values()].sort((a, b) => a.code.localeCompare(b.code)),
    [selected],
  );

  const toggle = (p: PancakeShopProduct) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });

  const running = !!jobId && !push.isError && isShopPushRunning(push.data);
  const finished = !!jobId && !running;
  // Đẩy hết không còn chờ / lỗi → toast + tự đóng; còn thì giữ hộp thoại liệt kê.
  const allDone =
    push.data?.state === 'missing' ||
    (push.data?.state === 'completed' &&
      push.data.counts.pending === 0 &&
      push.data.counts.failed === 0);

  useEffect(() => {
    if (!finished || !allDone || !push.data) return;
    toast.success('Đã lưu sản phẩm bán', {
      description:
        push.data.state === 'missing'
          ? `Shop ${shop.shopId}: đang cập nhật sản phẩm lên Pancake.`
          : push.data.total > 0
            ? `Shop ${shop.shopId}: đã đẩy ${push.data.total} sản phẩm lên Pancake.`
            : `Shop ${shop.shopId}: không có thay đổi cần đẩy lên Pancake.`,
    });
    onOpenChange(false);
  }, [finished, allDone, push.data, shop.shopId, onOpenChange]);

  const onSave = () => {
    save.mutate(
      { restricted, productIds: [...selected.keys()] },
      {
        onSuccess: (r) => {
          if (r.pushJobId) {
            setJobId(r.pushJobId);
            return;
          }
          // Không có lượt đẩy riêng: không có gì cần đẩy, hoặc server rơi về hàng đợi chung.
          toast.success('Đã lưu sản phẩm bán', {
            description:
              (r.queued ?? 0) > 0
                ? `Shop ${shop.shopId}: đang cập nhật ${r.queued} sản phẩm lên Pancake.`
                : `Shop ${shop.shopId}: không có thay đổi cần đẩy lên Pancake.`,
          });
          onOpenChange(false);
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };

  const label = shop.shopName ? `${shop.shopName} (${shop.shopId})` : `shop ${shop.shopId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent xl>
        <DialogHeader>
          <DialogTitle>Sản phẩm bán trên {label}</DialogTitle>
          <DialogDescription>
            Chọn sản phẩm POS này bán. Sản phẩm không được chọn sẽ không được đẩy lên shop, sản phẩm
            đã có trên shop sẽ bị ẩn.
          </DialogDescription>
        </DialogHeader>

        {current.isPending ? (
          <ListSkeleton rows={4} columns={2} />
        ) : current.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive-line px-3 py-2 text-sm">
            <span className="text-destructive">{messageFor(current.error)}</span>
            <Button size="sm" variant="outline" onClick={() => void current.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : finished ? (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">
                {restricted ? 'Chỉ sản phẩm được chọn' : 'Bán tất cả sản phẩm'}
              </span>
              {restricted ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {selected.size} sản phẩm đang chọn.
                </span>
              ) : null}
            </p>
            {push.isError ? (
              <div className="rounded-md border border-destructive-line px-3 py-2 text-sm text-destructive">
                Đã lưu, nhưng không xem được tiến độ đẩy: {messageFor(push.error)}
              </div>
            ) : push.data ? (
              <PushResultPanel status={push.data} />
            ) : null}
          </div>
        ) : (
          <div
            className={
              running
                ? 'pointer-events-none flex min-w-0 select-none flex-col gap-3 opacity-60'
                : 'flex min-w-0 flex-col gap-3'
            }
            aria-disabled={running || undefined}
          >
            <div role="radiogroup" aria-label="Phạm vi sản phẩm" className="flex flex-col gap-2">
              <ModeOption
                checked={!restricted}
                onSelect={() => setRestricted(false)}
                title="Bán tất cả sản phẩm"
                hint="Mọi sản phẩm ERP đều được đẩy lên shop này (như trước)."
              />
              <ModeOption
                checked={restricted}
                onSelect={() => setRestricted(true)}
                title="Chỉ sản phẩm được chọn"
                hint={`${selected.size} sản phẩm đang chọn.`}
              />
            </div>

            {restricted ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <section className="flex min-w-0 flex-col rounded-md border">
                  <header className="border-b px-3 py-2">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm theo mã, tên sản phẩm…"
                        aria-label="Tìm sản phẩm"
                        className="pl-8"
                      />
                    </div>
                  </header>
                  <div className="h-[55vh] min-h-72 overflow-y-auto">
                    {results.isPending ? (
                      <ListSkeleton rows={6} columns={1} />
                    ) : results.isError ? (
                      <p className="px-3 py-2 text-sm text-destructive">
                        {messageFor(results.error)}
                      </p>
                    ) : results.data.items.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Không có sản phẩm khớp “{debouncedQ}”.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {results.data.items.map((p) => {
                          const item: PancakeShopProduct = {
                            id: p.id,
                            code: p.code,
                            name: p.name,
                            isCombo: p.isCombo,
                            isActive: p.isActive,
                          };
                          return (
                            <li key={p.id}>
                              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                                <Checkbox
                                  checked={selected.has(p.id)}
                                  onCheckedChange={() => toggle(item)}
                                  aria-label={`Chọn ${p.code}`}
                                />
                                <ProductLabel p={item} />
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {results.data && results.data.total > results.data.items.length ? (
                    <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                      Hiện {results.data.items.length}/{results.data.total} — gõ thêm để lọc.
                    </p>
                  ) : null}
                </section>

                <section className="flex min-w-0 flex-col rounded-md border">
                  <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
                    <span className="font-semibold">Đã chọn · {selected.size}</span>
                    {selected.size > 0 ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setSelected(new Map())}
                      >
                        Bỏ chọn tất cả
                      </button>
                    ) : null}
                  </header>
                  <div className="h-[55vh] min-h-72 overflow-y-auto">
                    {sortedSelected.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Chưa chọn sản phẩm nào — shop sẽ không bán sản phẩm nào. Tìm và tick ở cột
                        bên trái.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {sortedSelected.map((p) => (
                          <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                            <ProductLabel p={p} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto"
                              aria-label={`Bỏ ${p.code}`}
                              onClick={() => toggle(p)}
                            >
                              <X aria-hidden />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        )}

        {running ? <PushProgress status={push.data} /> : null}

        <DialogFooter>
          {finished ? (
            <Button onClick={() => onOpenChange(false)}>Đóng</Button>
          ) : running ? (
            <>
              <span className="mr-auto self-center text-xs text-muted-foreground">
                Đóng hộp thoại thì việc đẩy vẫn chạy tiếp.
              </span>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
              <Button loading loadingText="Đang đẩy…">
                Lưu sản phẩm bán
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Hủy bỏ
              </Button>
              <Button
                onClick={onSave}
                disabled={!loaded}
                loading={save.isPending}
                loadingText="Đang lưu…"
              >
                Lưu sản phẩm bán
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={
        checked
          ? 'flex items-start gap-2 rounded-md border border-primary bg-secondary px-3 py-2 text-left'
          : 'flex items-start gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted'
      }
    >
      <span
        aria-hidden
        className={
          checked
            ? 'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-4 border-primary'
            : 'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border'
        }
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/** Dòng tiến độ trên chân hộp thoại khi lượt đẩy đang chờ / đang chạy. */
function PushProgress({ status }: { status: PancakeShopPushStatus | undefined }) {
  const active = status?.state === 'active' && status.total > 0;
  const pct = active ? Math.round((status.done / status.total) * 100) : 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border px-3 py-2"
    >
      <div className="flex items-center gap-2 text-sm">
        <Spinner className="size-3.5 text-primary" />
        <span className="font-medium">
          {active
            ? `Đang đẩy lên Pancake · ${status.done}/${status.total}`
            : 'Đang chờ lượt đẩy trước xong…'}
        </span>
      </div>
      {active ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Tiến độ đẩy lên Pancake"
          aria-valuemin={0}
          aria-valuemax={status.total}
          aria-valuenow={status.done}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Kết quả lượt đẩy còn sản phẩm chờ Pancake / lỗi (hoặc lượt đẩy dừng giữa chừng). */
function PushResultPanel({ status }: { status: PancakeShopPushStatus }) {
  const { pending, failed } = status.counts;
  const ok = Math.max(0, status.done - pending - failed);
  const stopped = status.state === 'failed';
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-warning-line bg-warning-weak px-3 py-2"
    >
      <p className="text-sm font-medium">
        {stopped
          ? `Đã lưu · lượt đẩy dừng ở ${status.done}/${status.total} sản phẩm — lưu lại để đẩy tiếp`
          : `Đã lưu · ${ok}/${status.total} sản phẩm đã lên Pancake`}
      </p>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{ok}</strong> đã lên
        </span>
        <span>
          <strong className="text-foreground">{pending}</strong> chờ Pancake
        </span>
        <span>
          <strong className="text-foreground">{failed}</strong> lỗi
        </span>
      </p>
      {status.items.length > 0 ? (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-md border bg-card">
          {status.items.map((it) => (
            <li key={it.productId} className="flex flex-col gap-0.5 px-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {it.action === 'pending' ? (
                  <StatusBadge tone="warn">Chờ Pancake</StatusBadge>
                ) : (
                  <StatusBadge tone="err">Lỗi</StatusBadge>
                )}
                <span className="shrink-0 font-mono text-xs">{it.productCode}</span>
                <span className="truncate">{it.productName}</span>
              </span>
              {it.reason ? (
                <span className="text-xs text-muted-foreground">{it.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {pending > 0 ? (
        <p className="text-xs text-muted-foreground">
          Sản phẩm chờ Pancake: ERP tự liên kết lại sau 1, 5, 15, 30, 60 phút. Lưu lại lần nữa thì
          ERP đẩy lại mọi sản phẩm đang chọn chưa lên được.
        </p>
      ) : null}
    </div>
  );
}

function ProductLabel({ p }: { p: PancakeShopProduct }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-mono text-xs">{p.code}</span>
      <span className="truncate">{p.name}</span>
      {p.isCombo ? <StatusBadge tone="brand">Combo</StatusBadge> : null}
      {!p.isActive ? <StatusBadge tone="neutral">Ngừng bán</StatusBadge> : null}
    </span>
  );
}
