'use client';

import { ArrowLeft, ArrowRightLeft, MapPin, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { ScanInput, type ScanInputHandle } from '@/components/data/scan-input';
import { ErrorState, ForbiddenState, ListSkeleton } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { beep } from '@/lib/beep';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useLocationContents, useResolveCode } from '../api/use-pda';
import { qtyGt, ZERO } from '../putaway-basket';
import type { LocationContents, LocationItem } from '../relocate-selection';
import { PdaFeedbackBanner, type PdaFeedback } from './pda-feedback';

/**
 * Tra vị trí trên trình duyệt máy PDA (LOC-3 bản web, cùng nội dung P-12 của app): quét tem vị trí
 * → hàng đang nằm ở đó theo SKU / lô (tồn, giữ cho đơn, đã quét lấy, hàng rời, thùng bên trong).
 * Vị trí đang xem nằm trên URL (`?id=`) để F5 / gửi link giữ nguyên (luật 8).
 * Có quyền chuyển kho (`stock.transfer`) → "Chuyển hàng ở đây" mở /pda/relocate?from=….
 */
export function LocationScreen() {
  const ability = useAbility();
  const canRead = ability.can('execute', 'Task');
  const canMove = ability.can('transfer', 'Stock');
  const router = useRouter();
  const id = useSearchParams().get('id');
  const contents = useLocationContents(canRead ? id : null);
  const resolve = useResolveCode();
  const scanRef = useRef<ScanInputHandle>(null);
  const [feedback, setFeedback] = useState<PdaFeedback | null>(null);

  if (!canRead) return <ForbiddenState className="m-4" />;

  const onScan = async (code: string) => {
    setFeedback(null);
    try {
      const r = await resolve.mutateAsync(code);
      if (r.kind === 'location' && r.location) {
        beep('ok');
        router.replace(`/pda/location?id=${encodeURIComponent(r.location.id)}`);
        return;
      }
      beep('error');
      setFeedback({
        kind: 'warn',
        text: `Mã ${code} không phải tem vị trí`,
        detail: 'Quét tem dán ở ô kệ / pallet sàn (LOC-…).',
      });
    } catch (err) {
      beep('error');
      setFeedback({
        kind: 'error',
        text: isApiError(err) && err.status === 404 ? `Không nhận ra mã ${code}` : messageFor(err),
      });
    }
  };

  const data = contents.data;
  const offline = contents.isError && isApiError(contents.error) && contents.error.status === 0;
  const hasMovable = data?.items.some((i) => qtyGt(i.movable, ZERO)) ?? false;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              href="/pda/put-away"
              className="-m-2 flex items-center gap-1 p-2 hover:text-foreground"
              aria-label="Về màn cất hàng"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Cất hàng
            </Link>
            <span aria-hidden>·</span>
            Tra vị trí
          </div>
          <div className="font-mono text-lg font-semibold">
            {data?.location.code ?? 'Quét tem vị trí'}
          </div>
        </div>
      </header>

      {offline ? (
        <p role="status" className="flex items-center gap-2 bg-warning-weak px-4 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden />
          Mất kết nối — tra vị trí cần mạng.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        {feedback ? <PdaFeedbackBanner feedback={feedback} /> : null}

        {!id ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MapPin className="h-12 w-12" aria-hidden />
            <p className="text-lg font-medium text-foreground">Quét tem vị trí</p>
            <p className="text-sm">
              Xem sản phẩm và số lượng đang nằm ở ô kệ / pallet sàn / DEFAULT. Gõ mã vị trí rồi
              Enter cũng được.
            </p>
          </div>
        ) : contents.isPending ? (
          <ListSkeleton rows={4} />
        ) : contents.isError ? (
          <ErrorState error={contents.error} onRetry={() => void contents.refetch()} />
        ) : data ? (
          <LocationContentsView data={data} />
        ) : null}
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-4 pb-4 pt-3">
        <ScanInput
          ref={scanRef}
          size="lg"
          label="Quét vị trí"
          placeholder={id ? 'Quét vị trí khác…' : 'Quét tem vị trí…'}
          onScan={(c) => void onScan(c)}
          disabled={resolve.isPending}
        />
        {data && canMove && hasMovable ? (
          <Button className="h-pda-primary text-lg" asChild>
            <Link href={`/pda/relocate?from=${encodeURIComponent(data.location.id)}`}>
              <ArrowRightLeft aria-hidden />
              Chuyển hàng ở đây
            </Link>
          </Button>
        ) : null}
      </footer>
    </div>
  );
}

function LocationContentsView({ data }: { data: LocationContents }) {
  const loc = data.location;
  return (
    <>
      <section className="rounded-lg border bg-card p-4" aria-label="Vị trí">
        <div className="text-2xl font-bold leading-tight">{loc.label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{loc.code}</span>
          <span>· {loc.warehouseCode}</span>
          {loc.isDefault ? (
            <span className="rounded-sm bg-info-weak px-1.5 py-0.5 text-xs font-medium text-info">
              DEFAULT · lấy hàng trước
            </span>
          ) : null}
          {!loc.isPickable ? (
            <span className="rounded-sm bg-warning-weak px-1.5 py-0.5 text-xs font-medium text-warning">
              Tầng dự trữ · không lấy hàng
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm">
          {data.skuCount} mã hàng · {data.containerCount} thùng
        </p>
      </section>

      {data.items.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-muted-foreground">
          Vị trí trống — chưa có hàng nào được cất vào đây.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Hàng ở vị trí">
          {data.items.map((i) => (
            <LocationItemCard key={`${i.skuId}|${i.lotId ?? ''}`} item={i} />
          ))}
        </ul>
      )}
    </>
  );
}

function LocationItemCard({ item }: { item: LocationItem }) {
  const extra = [
    qtyGt(item.reserved, ZERO) ? `giữ cho đơn ${formatQuantity(item.reserved)}` : null,
    qtyGt(item.inHand, ZERO) ? `đã quét lấy ${formatQuantity(item.inHand)}` : null,
    qtyGt(item.looseQty, ZERO) ? `rời ${formatQuantity(item.looseQty)}` : null,
  ].filter(Boolean);
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{item.skuName}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {item.skuCode}
            {item.lotNumber ? ` · lô ${item.lotNumber}` : ''}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums">{formatQuantity(item.onHand)}</span>{' '}
          <span className="text-sm text-muted-foreground">{item.baseUomCode}</span>
        </div>
      </div>
      {extra.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{extra.join(' · ')}</p>
      ) : null}
      {item.containers.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {item.containers.length} thùng / pallet
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {item.containers.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="font-mono">
                  {c.barcode}
                  {c.parentBarcode ? (
                    <span className="text-muted-foreground"> · trong {c.parentBarcode}</span>
                  ) : null}
                  {c.status === 'PICKED' ? (
                    <span className="text-warning"> · đã quét lấy</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{formatQuantity(c.qty)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
