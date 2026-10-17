'use client';

import Decimal from 'decimal.js';
import { Loader2, ScanBarcode, Search } from 'lucide-react';
import { forwardRef, useEffect, useId, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { formatQuantity } from '@/lib/format';
import { useSkuQuickSearch, type SkuQuickRow } from '../../api/use-order-create';

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** Khả dụng của SKU ở kho đang chọn; chưa chọn kho = tổng mọi kho. */
function availableIn(row: SkuQuickRow, warehouseId: string): string {
  if (!warehouseId) return row.available;
  return row.byWarehouse.find((w) => w.warehouseId === warehouseId)?.available ?? '0';
}

/**
 * Ô tìm sản phẩm của giỏ: gõ tên / mã / barcode → chọn là thêm vào giỏ (đã có thì +1). Máy quét
 * (gõ mã + Enter) thêm thẳng khi mã khớp đúng một dòng. Tab Sản phẩm / Combo, lọc "Còn hàng" theo
 * kho đang chọn. F9 focus ô này (màn cha giữ ref).
 */
export const ProductSearch = forwardRef<
  HTMLInputElement,
  { warehouseId: string; onPick: (row: SkuQuickRow) => void }
>(function ProductSearch({ warehouseId, onPick }, ref) {
  const listId = useId();
  const [isCombo, setIsCombo] = useState(false);
  const [q, setQ] = useState('');
  const [inStock, setInStock] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pendingEnter, setPendingEnter] = useState<string | null>(null);
  const debounced = useDebounced(q.trim(), 200);
  const search = useSkuQuickSearch(debounced, isCombo);

  const rows = useMemo(() => {
    const items = search.data?.items ?? [];
    return inStock
      ? items.filter((r) => new Decimal(availableIn(r, warehouseId)).greaterThan(0))
      : items;
  }, [search.data, inStock, warehouseId]);

  useEffect(() => setActive(0), [debounced, isCombo, inStock]);

  const pick = (row: SkuQuickRow) => {
    onPick(row);
    setQ('');
    setOpen(false);
    setPendingEnter(null);
  };

  // Enter khi kết quả của chuỗi vừa gõ chưa về (máy quét gõ rất nhanh): chờ rồi xử lý.
  useEffect(() => {
    if (pendingEnter === null || search.isFetching || debounced !== pendingEnter) return;
    const items = search.data?.items ?? [];
    const exact = items.filter((r) => r.code.toLowerCase() === pendingEnter.toLowerCase());
    const hit = exact.length === 1 ? exact[0] : items.length === 1 ? items[0] : undefined;
    setPendingEnter(null);
    if (hit) pick(hit);
    else setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy lại khi kết quả về
  }, [pendingEnter, search.isFetching, search.data, debounced]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const typed = q.trim();
      if (typed === '') return;
      if (open && rows[active] && debounced === typed && !search.isFetching) {
        pick(rows[active]);
      } else {
        setPendingEnter(typed);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && q.trim() !== '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Loại hàng" className="inline-flex rounded-md bg-muted p-0.5">
        {[
          { v: false, label: 'Sản phẩm' },
          { v: true, label: 'Combo' },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={isCombo === t.v}
            onClick={() => setIsCombo(t.v)}
            className={cn(
              'h-8 rounded px-3 text-sm',
              isCombo === t.v
                ? 'bg-card font-semibold text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 basis-72">
        <div className="flex h-9 items-center gap-2 rounded-md border border-primary bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={ref}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label="Tìm sản phẩm"
            placeholder={isCombo ? 'Tìm combo theo tên, mã…' : 'Tìm tên, mã SKU, barcode…'}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {search.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
          <label className="flex shrink-0 cursor-pointer items-center gap-2 border-l pl-3 text-sm">
            <Checkbox
              checked={inStock}
              onCheckedChange={(c) => setInStock(c === true)}
              aria-label="Chỉ hiện hàng còn tồn"
            />
            Còn hàng
          </label>
        </div>

        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Kết quả tìm sản phẩm"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
          >
            {search.isPending && debounced !== '' ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Đang tìm…</li>
            ) : rows.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {inStock ? 'Không có hàng còn tồn khớp từ khóa' : 'Không tìm thấy sản phẩm'}
              </li>
            ) : (
              rows.map((r, i) => {
                const avail = availableIn(r, warehouseId);
                const out = !new Decimal(avail).greaterThan(0);
                return (
                  <li
                    key={r.skuId}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm',
                      i === active && 'bg-accent',
                    )}
                  >
                    {r.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL S3 ký sẵn, không qua next/image
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded bg-muted" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.code} · {r.baseUomCode}
                        {r.isCombo ? ' · Combo' : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-xs tabular-nums',
                        out ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {out ? 'Hết hàng' : `Còn ${formatQuantity(avail)}`}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => (ref && typeof ref !== 'function' ? ref.current?.focus() : undefined)}
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
        aria-label="Quét mã vạch (F9)"
        title="Quét mã vạch: đặt con trỏ vào ô tìm rồi quét"
      >
        <ScanBarcode className="h-4 w-4" aria-hidden />
        (F9)
      </button>
    </div>
  );
});
