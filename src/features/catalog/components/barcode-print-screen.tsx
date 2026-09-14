'use client';

import { Printer, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PrintSheet } from '@/components/data/print-sheet';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LABEL_SIZES, usePrint } from '@/lib/print';
import { useProductDetails, useProducts, type ProductDetail } from '../api/use-products';
import {
  DEFAULT_LABEL_OPTIONS,
  SkuLabel,
  type SkuLabelData,
  type SkuLabelOptions,
} from './sku-label';

/**
 * In tem SKU (PLAN-barcode-pick-pack hạng mục A2) — nối thật GET /products/{id}.
 *
 * Trạng thái trên URL (luật 8): `?productId=a,b` = các sản phẩm đưa vào danh sách,
 * `?skuIds=x,y` = chỉ chọn sẵn những SKU này (mặc định chọn mọi SKU đang bán).
 * Mỗi dòng = một SKU: chọn mã in (mặc định mã của ĐVT cơ sở), số tem. Tem 50×30 mm,
 * 2 cột trên cuộn (quyết định 3); ký hiệu theo `Barcode.type`, EAN13 chỉ khi check digit
 * đúng (`symbologyFor`). In qua trình duyệt (`PrintSheet`) — không có agent máy in,
 * không nhật ký in (phần đó của bản mock cũ không có backend, đã bỏ).
 */
const SIZE = LABEL_SIZES.SKU_50x30;

interface RowState {
  selected: boolean;
  barcodeId: string | null;
  copies: number;
}

interface LabelRow {
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  isActive: boolean;
  baseUomId: string;
  barcodes: ProductDetail['skus'][number]['barcodes'];
  price: string | null;
}

function rowsOf(products: ProductDetail[]): LabelRow[] {
  return products.flatMap((p) =>
    p.skus.map((s) => ({
      skuId: s.id,
      skuCode: s.code,
      skuName: p.hasVariants ? `${p.name} — ${s.name}` : s.name,
      productId: p.id,
      productName: p.name,
      isActive: s.isActive,
      baseUomId: s.baseUomId,
      barcodes: s.barcodes,
      price: s.salePrice,
    })),
  );
}

/** Mã mặc định = mã gắn ĐVT cơ sở (tem lẻ), không có thì mã đầu tiên. */
function defaultBarcodeId(row: LabelRow): string | null {
  return row.barcodes.find((b) => b.uomId === row.baseUomId)?.id ?? row.barcodes[0]?.id ?? null;
}

function labelOf(row: LabelRow, state: RowState): SkuLabelData | null {
  const bc = row.barcodes.find((b) => b.id === state.barcodeId);
  if (!bc) return null;
  return {
    skuCode: row.skuCode,
    name: row.skuName,
    barcode: bc.code,
    barcodeType: bc.type,
    uomCode: bc.uom.code,
    price: row.price,
  };
}

function splitIds(v: string | null): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function AddProductSearch({ onPick }: { onPick: (productId: string) => void }) {
  const [q, setQ] = useState('');
  const enabled = q.trim().length >= 2;
  // Chỉ gọi API khi đã gõ ≥ 2 ký tự — ô trống không tải danh sách sản phẩm.
  const query = useProducts({ q: q.trim(), take: 8, skip: 0 }, { enabled });
  const items = enabled ? (query.data?.items ?? []) : [];
  return (
    <div className="relative flex-1">
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Thêm sản phẩm"
          placeholder="Thêm sản phẩm: gõ mã / tên / barcode…"
          className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {enabled && items.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Kết quả sản phẩm"
          className="absolute left-0 right-0 top-9 z-10 max-h-64 overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(p.id);
                  setQ('');
                }}
              >
                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BarcodePrintScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const productIds = useMemo(() => splitIds(search.get('productId')), [search]);
  const preselect = useMemo(() => new Set(splitIds(search.get('skuIds'))), [search]);

  const setProductIds = (ids: string[]) => {
    const params = new URLSearchParams(search);
    if (ids.length) params.set('productId', ids.join(','));
    else params.delete('productId');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { pending, failed, products } = useProductDetails(productIds);
  const rows = useMemo(() => rowsOf(products), [products]);

  const [overrides, setOverrides] = useState<Record<string, Partial<RowState>>>({});
  const [options, setOptions] = useState<SkuLabelOptions>(DEFAULT_LABEL_OPTIONS);
  const stateOf = (row: LabelRow): RowState => ({
    selected:
      overrides[row.skuId]?.selected ??
      (preselect.size > 0 ? preselect.has(row.skuId) : row.isActive && row.barcodes.length > 0),
    barcodeId: overrides[row.skuId]?.barcodeId ?? defaultBarcodeId(row),
    copies: overrides[row.skuId]?.copies ?? 1,
  });
  const patch = (skuId: string, p: Partial<RowState>) =>
    setOverrides((o) => ({ ...o, [skuId]: { ...o[skuId], ...p } }));

  const selected = rows
    .map((row) => ({ row, state: stateOf(row) }))
    .filter(({ state }) => state.selected && state.barcodeId && state.copies > 0);
  const labels = selected.flatMap(({ row, state }) => {
    const l = labelOf(row, state);
    return l ? Array.from({ length: state.copies }, () => l) : [];
  });
  const preview = labels[0] ?? null;
  const pages: SkuLabelData[][] = [];
  for (let i = 0; i < labels.length; i += SIZE.columns)
    pages.push(labels.slice(i, i + SIZE.columns));

  const printer = usePrint();
  const canPrint = labels.length > 0;

  return (
    <>
      <PageHeader
        title="In tem SKU"
        description={
          productIds.length === 0
            ? 'Chọn sản phẩm để in tem'
            : `${rows.length} SKU · ${labels.length} tem · ${SIZE.label}`
        }
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'In tem barcode' }]}
        actions={
          <Button size="sm" disabled={!canPrint} onClick={printer.print}>
            <Printer aria-hidden />
            In {labels.length > 0 ? `${labels.length} tem` : 'tem'}
          </Button>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <AddProductSearch onPick={(id) => setProductIds([...new Set([...productIds, id])])} />
          </div>

          {productIds.length === 0 ? (
            <EmptyState
              title="Chưa chọn sản phẩm"
              description="Gõ mã, tên hoặc barcode ở ô trên để thêm sản phẩm, hoặc bấm In tem từ màn chi tiết sản phẩm."
            />
          ) : failed ? (
            <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />
          ) : pending ? (
            <ListSkeleton rows={4} columns={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Sản phẩm chưa có SKU"
              description="Thêm biến thể ở màn Sửa sản phẩm rồi quay lại in tem."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-8 px-2.5">
                      <Checkbox
                        aria-label="Chọn tất cả"
                        checked={
                          selected.length === 0
                            ? false
                            : selected.length === rows.length
                              ? true
                              : 'indeterminate'
                        }
                        onCheckedChange={(v) =>
                          setOverrides(
                            Object.fromEntries(
                              rows.map((r) => [
                                r.skuId,
                                { ...overrides[r.skuId], selected: v === true },
                              ]),
                            ),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">SKU</TableHead>
                    <TableHead className="px-2.5 text-xs">Tên</TableHead>
                    <TableHead className="w-48 px-2.5 text-xs">Mã in</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Số tem</TableHead>
                    <TableHead className="w-10 px-2.5">
                      <span className="sr-only">Bỏ sản phẩm</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const state = stateOf(row);
                    return (
                      <TableRow
                        key={row.skuId}
                        data-state={state.selected ? 'selected' : undefined}
                      >
                        <TableCell className="px-2.5 py-1.5">
                          <Checkbox
                            aria-label={`Chọn ${row.skuCode}`}
                            checked={state.selected}
                            disabled={row.barcodes.length === 0}
                            onCheckedChange={(v) => patch(row.skuId, { selected: v === true })}
                          />
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          <Link
                            href={`/catalog/products/${row.productId}`}
                            className="text-primary hover:underline"
                          >
                            {row.skuCode}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-64 truncate px-2.5 py-1.5" title={row.skuName}>
                          {row.skuName}
                          {!row.isActive ? (
                            <span className="ml-1 text-xs text-muted-foreground">(ngừng bán)</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {row.barcodes.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Chưa có barcode</span>
                          ) : (
                            <Select
                              value={state.barcodeId ?? undefined}
                              onValueChange={(v) => patch(row.skuId, { barcodeId: v })}
                            >
                              <SelectTrigger
                                className="h-7 text-xs"
                                aria-label={`Mã in ${row.skuCode}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {row.barcodes.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    <span className="font-mono">{b.code}</span>
                                    <span className="ml-1 text-muted-foreground">
                                      · {b.uom.code}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={999}
                            aria-label={`Số tem ${row.skuCode}`}
                            className="h-7 w-20 text-right tabular-nums"
                            value={state.copies}
                            onChange={(e) =>
                              patch(row.skuId, {
                                copies: Math.max(0, Math.min(999, Number(e.target.value) || 0)),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Bỏ ${row.productName}`}
                            onClick={() =>
                              setProductIds(productIds.filter((id) => id !== row.productId))
                            }
                          >
                            <X aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.length > 0 ? (
            <div className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
              {selected.length} SKU chọn · <b className="text-foreground">{labels.length} tem</b> ·{' '}
              {pages.length} hàng × {SIZE.columns} tem
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Mẫu tem</span>
              <span className="text-xs text-muted-foreground">{SIZE.label}</span>
            </div>
            <div className="flex justify-center bg-muted p-5" data-testid="label-preview">
              {preview ? (
                <SkuLabel data={preview} options={options} className="border shadow-sm" />
              ) : (
                <p className="text-sm text-muted-foreground">Chọn ít nhất một SKU có barcode</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t p-3 text-sm">
              {(
                [
                  ['showName', 'Tên sản phẩm'],
                  ['showPrice', 'Giá bán'],
                  ['showSku', 'Mã SKU'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <Checkbox
                    aria-label={`In ${label.toLowerCase()}`}
                    checked={options[key]}
                    onCheckedChange={(v) => setOptions((o) => ({ ...o, [key]: v === true }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            In qua hộp thoại của trình duyệt: chọn máy in tem, khổ giấy {SIZE.label.toLowerCase()},
            tắt lề và tỉ lệ 100%. EAN-13 chỉ in khi mã có 13 số đúng check digit, còn lại in
            CODE128.
          </p>
        </div>
      </div>

      <PrintSheet open={printer.open} onDone={printer.done} size="SKU_50x30">
        {pages.map((page, i) => (
          <div key={i} data-print-page className="flex" style={{ gap: '4mm', padding: '1mm 2mm' }}>
            {page.map((l, j) => (
              <SkuLabel key={j} data={l} options={options} />
            ))}
          </div>
        ))}
      </PrintSheet>
    </>
  );
}
