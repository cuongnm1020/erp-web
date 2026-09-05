'use client';

import { Printer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DetailSkeleton, EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useProduct, useWarehouses, type ProductDetail } from '../api/use-products';
import {
  useSkuStockByLocation,
  useSkuStockByLot,
  useSkuStockSummary,
  type StockByLocationRow,
} from '../api/use-product-stock';

/**
 * C-03 Chi tiết sản phẩm — nối API thật (GET /products/{id} + /stock*).
 * Layout theo design canvas cũ; các cột chưa có API (giá vốn TB, NCC chính,
 * ngưỡng đặt lại, cờ Bán/Mua/Kho theo ĐVT) đã bỏ — bổ sung khi backend sẵn sàng.
 */
type TabKey = 'info' | 'variants' | 'barcodes' | 'units' | 'stock';

type Sku = ProductDetail['skus'][number];

const TRACKING_LABEL: Record<ProductDetail['trackingMode'], string> = {
  NONE: 'Không theo dõi',
  LOT: 'Theo lô + hạn dùng (FEFO)',
  SERIAL: 'Theo serial',
};

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';
const HEAD = 'px-2.5 text-xs';

export function ProductDetailScreen({ productId }: { productId: string }) {
  const query = useProduct(productId);
  return (
    <QueryState query={query} skeleton={<DetailSkeleton fields={8} />}>
      {(p) =>
        p ? (
          <DetailBody product={p} />
        ) : (
          <EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã bị xóa." />
        )
      }
    </QueryState>
  );
}

function DetailBody({ product }: { product: ProductDetail }) {
  const skus = product.skus;
  const [tab, setTab] = useState<TabKey>('info');
  // Tồn kho xem theo TỪNG SKU (API bóc tồn theo skuId) — mặc định biến thể đang bán đầu tiên.
  const [skuId, setSkuId] = useState(() => (skus.find((s) => s.isActive) ?? skus[0])?.id ?? '');
  const selectedSku = skus.find((s) => s.id === skuId);

  const warehouses = useWarehouses();
  const warehouseName = (id: string | null) =>
    (warehouses.data ?? []).find((w) => w.id === id)?.name;

  const barcodeCount = skus.reduce((n, s) => n + s.barcodes.length, 0);
  const unitCount = skus.reduce((n, s) => n + 1 + s.uomConversions.length, 0);

  const tabs: Array<{ key: TabKey; label: string; count?: string }> = [
    { key: 'info', label: 'Thông tin' },
    { key: 'variants', label: 'Biến thể', count: String(skus.length) },
    { key: 'barcodes', label: 'Barcode', count: String(barcodeCount) },
    { key: 'units', label: 'Đơn vị & quy đổi', count: String(unitCount) },
    { key: 'stock', label: 'Tồn theo kho' },
  ];

  return (
    <>
      <PageHeader
        title={product.name}
        description={`Mã ${product.code} · ${skus.length} biến thể · Cập nhật ${formatDateTime(product.updatedAt)}`}
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Danh sách', href: '/catalog/products' },
          { label: product.code },
        ]}
        actions={
          <>
            <StatusBadge tone={product.isActive ? 'ok' : 'neutral'}>
              {product.isActive ? 'Đang bán' : 'Ngừng bán'}
            </StatusBadge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/catalog/barcode-print">
                <Printer /> In tem
              </Link>
            </Button>
            <Can I="update" a="Product">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/catalog/products/${product.id}/edit`}>Sửa</Link>
              </Button>
            </Can>
          </>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card p-3">
            <Gallery images={product.images} />
            <dl className="mt-3 space-y-1.5 text-sm">
              <InfoRow label="Danh mục">{product.category?.name ?? '—'}</InfoRow>
              <InfoRow label="Thương hiệu">{product.brand?.name ?? '—'}</InfoRow>
              <InfoRow label="ĐVT cơ bản">{skus[0]?.baseUom.code ?? '—'}</InfoRow>
              <InfoRow label="Theo dõi lô">
                {TRACKING_LABEL[product.trackingMode]}
                {product.shelfLifeDays != null ? ` · HSD ${product.shelfLifeDays} ngày` : ''}
              </InfoRow>
              <InfoRow label="Kho mặc định">
                {warehouseName(product.defaultWarehouseId) ??
                  (product.defaultWarehouseId ? '…' : 'Chưa chọn')}
              </InfoRow>
              <InfoRow label="Tồn âm">
                {product.allowNegativeStock ? 'Cho phép bán âm' : 'Không cho bán âm'}
              </InfoRow>
              <InfoRow label="Thuế">
                <span className="text-muted-foreground">chưa cấu hình</span>
              </InfoRow>
            </dl>
          </div>
          {selectedSku ? <StockSummaryCard sku={selectedSku} /> : null}
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex border-b px-2" role="tablist" aria-label="Chi tiết sản phẩm">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
                  tab === t.key
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            {tab === 'info' ? <InfoTab product={product} /> : null}
            {tab === 'variants' ? <VariantsTab skus={skus} /> : null}
            {tab === 'barcodes' ? <BarcodesTab skus={skus} /> : null}
            {tab === 'units' ? <UnitsTab skus={skus} /> : null}
            {tab === 'stock' ? (
              <StockTab
                skus={skus}
                skuId={skuId}
                onSelectSku={setSkuId}
                trackingMode={product.trackingMode}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Gallery({ images }: { images: ProductDetail['images'] }) {
  const [primary, ...rest] = images;
  return (
    <div className="flex items-start gap-3">
      {primary ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL ngắn hạn
        <img
          src={primary.url}
          alt={primary.fileName}
          className="h-28 w-28 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
          Chưa có ảnh
        </div>
      )}
      {rest.length > 0 ? (
        <div className="flex flex-col gap-1">
          {rest.slice(0, 3).map((img) => (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL ngắn hạn
            <img
              key={img.id}
              src={img.url}
              alt={img.fileName}
              className="h-9 w-9 rounded-md border object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Tồn gộp mọi kho của SKU đang chọn — GET /stock trả 3 số tách sẵn, không tự cộng trừ. */
function StockSummaryCard({ sku }: { sku: Sku }) {
  const query = useSkuStockSummary(sku.code);
  const row = query.data?.items.find((r) => r.skuId === sku.id);
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-3 py-2 text-sm font-semibold">
        Tồn tổng hợp <span className="font-mono text-xs font-normal">· {sku.code}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-right">
        {query.isPending ? (
          <>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </>
        ) : query.error ? (
          <p className="col-span-3 text-left text-sm text-muted-foreground">
            Không tải được tồn kho.
          </p>
        ) : (
          <>
            <div>
              <div className="text-xs text-muted-foreground">Tồn thực</div>
              <div className="font-semibold tabular-nums">{formatQuantity(row?.onHand ?? '0')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Đang giữ</div>
              <div className="font-semibold tabular-nums">
                {formatQuantity(row?.reserved ?? '0')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Khả dụng</div>
              <div
                className={cn(
                  'font-semibold tabular-nums',
                  row && row.available.startsWith('-') ? 'text-destructive' : 'text-success',
                )}
              >
                {formatQuantity(row?.available ?? '0')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoTab({ product }: { product: ProductDetail }) {
  return (
    <div className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2">
      <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Mã sản phẩm</span>
        <span className="font-mono">{product.code}</span>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Trạng thái</span>
        <span>{product.isActive ? 'Đang bán' : 'Ngừng bán'}</span>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Ngày tạo</span>
        <span>{formatDateTime(product.createdAt)}</span>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Sửa lần cuối</span>
        <span>{formatDateTime(product.updatedAt)}</span>
      </div>
      <div className="col-span-full grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Tên gọi khác</span>
        {product.searchAliases.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {product.searchAliases.map((a) => (
              <StatusBadge key={a} tone="neutral">
                {a}
              </StatusBadge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="col-span-full grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Mô tả</span>
        <span
          className={cn('whitespace-pre-wrap', !product.description && 'text-muted-foreground')}
        >
          {product.description || '—'}
        </span>
      </div>
      <div className="col-span-full grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Ghi chú nội bộ</span>
        <span
          className={cn('whitespace-pre-wrap', !product.internalNote && 'text-muted-foreground')}
        >
          {product.internalNote || '—'}
        </span>
      </div>
    </div>
  );
}

function VariantsTab({ skus }: { skus: Sku[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className={cn(HEAD, 'w-40')}>Mã SKU</TableHead>
          <TableHead className={HEAD}>Tên biến thể</TableHead>
          <TableHead className={cn(HEAD, 'w-20')}>ĐVT bán</TableHead>
          <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá nhập</TableHead>
          <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá bán</TableHead>
          <TableHead className={cn(HEAD, 'w-28')}>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skus.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">{s.code}</TableCell>
            <TableCell className="px-2.5 py-1.5">{s.name}</TableCell>
            <TableCell className="px-2.5 py-1.5">{(s.salesUom ?? s.baseUom).code}</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney(s.purchasePrice)}</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney(s.salePrice)}</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone={s.isActive ? 'ok' : 'neutral'}>
                {s.isActive ? 'Đang bán' : 'Ngừng bán'}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BarcodesTab({ skus }: { skus: Sku[] }) {
  const rows = skus.flatMap((s) => s.barcodes.map((b) => ({ sku: s, b })));
  if (rows.length === 0) {
    return (
      <EmptyState
        className="m-3"
        title="Chưa có barcode"
        description="Thêm barcode cho từng biến thể ở màn Sửa sản phẩm — máy quét PDA và ô tìm sản phẩm ăn theo các mã này."
      />
    );
  }
  return (
    <>
      <div className="border-b px-3 py-2 text-sm text-muted-foreground">
        {rows.length} barcode. Ô tìm sản phẩm ở màn tạo đơn và máy quét PDA nhận mọi mã bên dưới.
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-48')}>Barcode</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Loại</TableHead>
            <TableHead className={cn(HEAD, 'w-32')}>ĐVT gắn</TableHead>
            <TableHead className={HEAD}>SKU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ sku, b }) => (
            <TableRow key={b.id}>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold">
                {b.code}
              </TableCell>
              <TableCell className="px-2.5 py-1.5">
                <StatusBadge tone="neutral">{b.type}</StatusBadge>
              </TableCell>
              <TableCell className="px-2.5 py-1.5">{b.uom.code}</TableCell>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs">{sku.code}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Mã duy nhất toàn hệ thống. Thêm / gỡ barcode ở màn Sửa sản phẩm.
      </div>
    </>
  );
}

function UnitsTab({ skus }: { skus: Sku[] }) {
  const barcodeFor = (s: Sku, uomId: string) => s.barcodes.find((b) => b.uomId === uomId)?.code;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-36')}>Đơn vị</TableHead>
            <TableHead className={cn(HEAD, 'w-24 text-right')}>Hệ số</TableHead>
            <TableHead className={cn(HEAD, 'w-52')}>= đơn vị cơ bản</TableHead>
            <TableHead className={cn(HEAD, 'w-44')}>Barcode</TableHead>
            <TableHead className={HEAD}>ĐVT bán mặc định</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skus.map((s) => (
            <UnitRows key={s.id} sku={s} showSkuHeader={skus.length > 1} barcodeFor={barcodeFor} />
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Mọi số tồn và giá vốn lưu theo đơn vị cơ bản — quy đổi chỉ dùng ở lớp hiển thị / nhập liệu.
        Khai thêm quy đổi ở màn Sửa sản phẩm.
      </div>
    </>
  );
}

function UnitRows({
  sku,
  showSkuHeader,
  barcodeFor,
}: {
  sku: Sku;
  showSkuHeader: boolean;
  barcodeFor: (s: Sku, uomId: string) => string | undefined;
}) {
  const noBarcode = <span className="font-sans text-muted-foreground">chưa có</span>;
  return (
    <>
      {showSkuHeader ? (
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={5} className="px-2.5 py-1 font-mono text-xs font-semibold">
            {sku.code} — {sku.name}
          </TableCell>
        </TableRow>
      ) : null}
      <TableRow>
        <TableCell className="px-2.5 py-1.5 font-semibold">
          {sku.baseUom.code}{' '}
          <StatusBadge tone="brand" className="ml-1">
            cơ bản
          </StatusBadge>
        </TableCell>
        <TableCell className={NUM_CELL}>1</TableCell>
        <TableCell className="px-2.5 py-1.5">1 {sku.baseUom.code}</TableCell>
        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
          {barcodeFor(sku, sku.baseUomId) ?? noBarcode}
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          {sku.salesUomId === null ? <StatusBadge tone="ok">bán mặc định</StatusBadge> : null}
        </TableCell>
      </TableRow>
      {sku.uomConversions.map((c) => (
        <TableRow key={c.id}>
          <TableCell className="px-2.5 py-1.5 font-semibold">{c.uom.code}</TableCell>
          <TableCell className={NUM_CELL}>{formatQuantity(c.factor)}</TableCell>
          <TableCell className="px-2.5 py-1.5">
            1 {c.uom.code} = {formatQuantity(c.factor)} {sku.baseUom.code}
          </TableCell>
          <TableCell className="px-2.5 py-1.5 font-mono text-xs">
            {barcodeFor(sku, c.uomId) ?? noBarcode}
          </TableCell>
          <TableCell className="px-2.5 py-1.5">
            {sku.salesUomId === c.uomId ? <StatusBadge tone="ok">bán mặc định</StatusBadge> : null}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Gom dòng by-location theo kho — chỉ nhóm hiển thị, không cộng số (số tổng xem thẻ Tồn tổng hợp). */
function groupByWarehouse(rows: StockByLocationRow[]) {
  const groups: Array<{ id: string; code: string; rows: StockByLocationRow[] }> = [];
  for (const r of rows) {
    const g = groups.find((x) => x.id === r.warehouseId);
    if (g) g.rows.push(r);
    else groups.push({ id: r.warehouseId, code: r.warehouseCode, rows: [r] });
  }
  return groups;
}

function StockTab({
  skus,
  skuId,
  onSelectSku,
  trackingMode,
}: {
  skus: Sku[];
  skuId: string;
  onSelectSku: (id: string) => void;
  trackingMode: ProductDetail['trackingMode'];
}) {
  const byLocation = useSkuStockByLocation(skuId);
  const byLot = useSkuStockByLot(skuId);
  const warehouses = useWarehouses();
  const warehouseName = (id: string) => (warehouses.data ?? []).find((w) => w.id === id)?.name;
  const sku = skus.find((s) => s.id === skuId);

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <span className="text-muted-foreground">Biến thể</span>
        <Select value={skuId} onValueChange={onSelectSku}>
          <SelectTrigger className="h-8 w-64" aria-label="Chọn biến thể xem tồn">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {skus.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.code} — {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sku ? (
          <span className="text-xs text-muted-foreground">
            tính theo {sku.baseUom.code} (ĐVT lưu kho)
          </span>
        ) : null}
      </div>

      <QueryState
        query={byLocation}
        skeleton={<ListSkeleton rows={4} columns={6} className="p-3" />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            className="m-3"
            title="Chưa có tồn ở kho nào"
            description="Nhập hàng qua chứng từ nhận hàng — tồn sẽ hiện theo từng vị trí ở đây."
          />
        }
      >
        {(d) => (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className={HEAD}>Kho / Vị trí</TableHead>
                <TableHead className={cn(HEAD, 'w-24')}>Loại</TableHead>
                <TableHead className={cn(HEAD, 'w-28 text-right')}>Tồn thực</TableHead>
                <TableHead className={cn(HEAD, 'w-28 text-right')}>Đang giữ</TableHead>
                <TableHead className={cn(HEAD, 'w-28 text-right')}>Khả dụng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByWarehouse(d.items).map((g) => (
                <WarehouseGroup key={g.id} name={warehouseName(g.id) ?? g.code} rows={g.rows} />
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>

      {trackingMode !== 'NONE' ? (
        <div className="border-t">
          <div className="px-3 py-2 text-sm font-semibold">Tồn theo lô (FEFO)</div>
          <QueryState
            query={byLot}
            skeleton={<ListSkeleton rows={3} columns={5} className="p-3" />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <p className="px-3 pb-3 text-sm text-muted-foreground">
                Chưa có lô nào — lô sinh ra khi nhận hàng kèm số lô / hạn dùng.
              </p>
            }
          >
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className={HEAD}>Số lô</TableHead>
                    <TableHead className={cn(HEAD, 'w-28')}>HSD</TableHead>
                    <TableHead className={cn(HEAD, 'w-28')}>NSX</TableHead>
                    <TableHead className={cn(HEAD, 'w-28 text-right')}>Tồn thực</TableHead>
                    <TableHead className={cn(HEAD, 'w-28 text-right')}>Đang giữ</TableHead>
                    <TableHead className={cn(HEAD, 'w-28 text-right')}>Khả dụng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((r) => (
                    <TableRow key={r.lotId ?? 'no-lot'}>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                        {r.lotNumber ?? <span className="font-sans italic">không theo lô</span>}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {r.expiryDate ? formatDate(r.expiryDate) : '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {r.mfgDate ? formatDate(r.mfgDate) : '—'}
                      </TableCell>
                      <TableCell className={NUM_CELL}>{formatQuantity(r.onHand)}</TableCell>
                      <TableCell className={NUM_CELL}>{formatQuantity(r.reserved)}</TableCell>
                      <TableCell className={NUM_CELL}>{formatQuantity(r.available)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </div>
      ) : null}

      <div className="flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Đang giữ = đã tạo đơn, chưa pick. Khả dụng = Tồn thực − Đang giữ (API tính).</span>
      </div>
    </>
  );
}

function WarehouseGroup({ name, rows }: { name: string; rows: StockByLocationRow[] }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={5} className="px-2.5 py-1 font-semibold">
          {name} <span className="font-normal text-muted-foreground">· {rows.length} vị trí</span>
        </TableCell>
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.locationId}>
          <TableCell className="px-2.5 py-1.5 pl-8">
            <span className="font-mono text-xs">{r.locationCode}</span>{' '}
            {r.isPickable ? <StatusBadge tone="neutral">pick</StatusBadge> : null}
          </TableCell>
          <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.locationType}</TableCell>
          <TableCell className={NUM_CELL}>{formatQuantity(r.onHand)}</TableCell>
          <TableCell className={NUM_CELL}>{formatQuantity(r.reserved)}</TableCell>
          <TableCell className={NUM_CELL}>{formatQuantity(r.available)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
