'use client';

import { Download, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type FilterDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatQuantity } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import {
  useBrands,
  useCategories,
  useDeleteProduct,
  useProducts,
  useSkus,
  useUpdateSku,
  type ProductListItem,
  type SkuListRow,
  type TrackingMode,
} from '../api/use-products';

/**
 * C-01 Danh sách sản phẩm — hai góc nhìn trên cùng URL state (?view):
 *
 * - "Sản phẩm" (mặc định): GET /products — mỗi dòng một sản phẩm cha kèm số SKU,
 *   filter server-side theo danh mục (gộp CẢ danh mục con), thương hiệu, theo dõi
 *   lô, còn tồn; sort theo mã / tên / ngày tạo; q ăn cả tên dân dã (searchAliases),
 *   mã/tên SKU và barcode. Xóa mềm từng dòng (server chặn 409 khi còn tồn/đang giữ).
 * - "Theo SKU": GET /skus — mỗi dòng một SKU kèm tồn thực / đang giữ / khả dụng gộp
 *   mọi kho (đúng design/Products/ProductList@2x.png). API này chỉ nhận q + status,
 *   sắp cố định theo mã SKU — không cột sortable, không hứa hão.
 *
 * Khác design vì API chưa có: ngưỡng đặt lại ("7 dưới ngưỡng"), bộ lọc đã lưu,
 * chọn cột, giá niêm yết trong bảng, bulk cập nhật giá / in tem.
 */
const DEFAULTS = {
  size: 50,
  filterKeys: ['view', 'status', 'categoryId', 'brandId', 'trackingMode', 'stock'] as const,
};

type ProductFilter = (typeof DEFAULTS.filterKeys)[number];
type SkuStatus = 'active' | 'inactive';

function parseStatus(v: string | undefined): SkuStatus | undefined {
  return v === 'active' || v === 'inactive' ? v : undefined;
}

function parseTracking(v: string | undefined): TrackingMode | undefined {
  return v === 'NONE' || v === 'LOT' || v === 'SERIAL' ? v : undefined;
}

const TRACKING_LABELS: Record<TrackingMode, string> = {
  NONE: '—',
  LOT: 'Lô / HSD',
  SERIAL: 'Serial',
};

/** Cột được sort phía server trên GET /products — id cột = sortBy gửi lên API. */
const PRODUCT_SORTABLE = new Set(['code', 'name', 'createdAt']);

const productColumns: ColumnDef<ProductListItem, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã',
    meta: { width: 120, sortable: true },
    cell: ({ row }) => (
      <Link
        href={`/catalog/products/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tên sản phẩm',
    meta: { width: 300, sortable: true },
    cell: ({ row }) => (
      <span className="block max-w-[300px]">
        <span className="block truncate font-semibold" title={row.original.name}>
          {row.original.name}
        </span>
        {row.original.searchAliases.length > 0 ? (
          <span
            className="block truncate text-xs text-muted-foreground"
            title={row.original.searchAliases.join(', ')}
          >
            {row.original.searchAliases.join(', ')}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'category',
    header: 'Danh mục',
    meta: { width: 150 },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.category?.name ?? '—'}</span>
    ),
  },
  {
    id: 'brand',
    header: 'Thương hiệu',
    meta: { width: 130 },
    cell: ({ row }) => row.original.brand?.name ?? '—',
  },
  {
    id: 'skus',
    header: 'Biến thể',
    meta: { width: 220 },
    // skuCount đếm cả SKU ngừng bán; chips chỉ liệt kê SKU đang bán (skus của DTO).
    cell: ({ row }) => (
      <span className="block max-w-[220px]">
        <span className="block text-sm">{row.original.skuCount} SKU</span>
        <span
          className="block truncate font-mono text-xs text-muted-foreground"
          title={row.original.skus.map((s) => s.code).join(', ')}
        >
          {row.original.skus.map((s) => s.code).join(', ')}
        </span>
      </span>
    ),
  },
  {
    id: 'trackingMode',
    header: 'Theo dõi',
    meta: { width: 90 },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{TRACKING_LABELS[row.original.trackingMode]}</span>
    ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    meta: { width: 110, sortable: true },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    meta: { width: 110 },
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge tone="ok">Đang bán</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Ngừng bán</StatusBadge>
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { title: 'Thao tác', width: 80, align: 'right' },
    cell: ({ row }) => <ProductRowActions product={row.original} />,
  },
];

/** Sửa (route riêng) + Xóa mềm — server chặn 409 khi SKU còn tồn hoặc đang giữ hàng. */
function ProductRowActions({ product }: { product: ProductListItem }) {
  const ability = useAbility();
  const del = useDeleteProduct();
  const canUpdate = ability.can('update', 'Product');
  const canDelete = ability.can('delete', 'Product');
  if (!canUpdate && !canDelete) return null;
  return (
    <RowActions
      editHref={canUpdate ? `/catalog/products/${product.id}/edit` : undefined}
      itemName={`sản phẩm ${product.code}`}
      deleteDescription="Xóa mềm: ẩn khỏi danh sách và tìm kiếm, toàn bộ SKU chuyển Ngừng bán. Tồn kho và chứng từ cũ giữ nguyên."
      onDelete={
        canDelete
          ? async () => {
              try {
                await del.mutateAsync(product.id);
                toast.success(`Đã xóa sản phẩm ${product.code}`);
              } catch (err) {
                toast.error(messageFor(err));
              }
            }
          : undefined
      }
    />
  );
}

const skuColumns: ColumnDef<SkuListRow, unknown>[] = [
  // Ô vuông ảnh cạnh SKU như design — thumbnailUrl là presigned S3 (ảnh SKU, rơi về ảnh cha)
  {
    id: 'thumbnail',
    header: '',
    meta: { title: 'Ảnh', width: 44 },
    cell: ({ row }) =>
      row.original.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL S3, không qua next/image
        <img
          src={row.original.thumbnailUrl}
          alt=""
          className="h-7 w-7 rounded border object-cover"
        />
      ) : (
        <span aria-hidden className="block h-7 w-7 rounded border border-dashed bg-muted/40" />
      ),
  },
  {
    id: 'code',
    accessorKey: 'code',
    header: 'SKU',
    meta: { width: 140 },
    cell: ({ row }) => (
      <Link
        href={`/catalog/products/${row.original.productId}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tên sản phẩm',
    meta: { width: 300 },
    // Design: tên dài cắt bằng … ở 300px, hover (title) hiện đủ — không xuống dòng.
    cell: ({ row }) => (
      <span className="block max-w-[300px]">
        <span className="block truncate font-semibold" title={row.original.name}>
          {row.original.name}
        </span>
        {row.original.productName !== row.original.name ? (
          <span className="block truncate text-xs text-muted-foreground">
            {row.original.productName}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'category',
    header: 'Danh mục',
    meta: { width: 150 },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.categoryName ?? '—'}</span>
    ),
  },
  {
    id: 'brand',
    header: 'Thương hiệu',
    meta: { width: 130 },
    cell: ({ row }) => row.original.brandName ?? '—',
  },
  {
    id: 'uom',
    header: 'ĐVT',
    meta: { width: 70 },
    cell: ({ row }) => row.original.baseUomCode,
  },
  {
    id: 'onHand',
    header: 'Tồn thực',
    meta: { align: 'right', width: 100 },
    cell: ({ row }) => formatQuantity(row.original.onHand),
  },
  {
    id: 'reserved',
    header: 'Đang giữ',
    meta: { align: 'right', width: 100 },
    cell: ({ row }) => formatQuantity(row.original.reserved),
  },
  {
    id: 'available',
    header: 'Khả dụng',
    meta: { align: 'right', width: 100 },
    // Khả dụng ÂM = đã giữ cho đơn nhiều hơn tồn thực → chữ đỏ (theo design).
    cell: ({ row }) => (
      <span
        className={cn(row.original.available.startsWith('-') && 'font-semibold text-destructive')}
      >
        {formatQuantity(row.original.available)}
      </span>
    ),
  },
  {
    id: 'barcodeCount',
    header: 'Barcode',
    meta: { align: 'right', width: 80 },
    cell: ({ row }) => row.original.barcodeCount,
  },
  {
    id: 'status',
    header: 'Trạng thái',
    meta: { width: 110 },
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge tone="ok">Đang bán</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Ngừng bán</StatusBadge>
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { title: 'Thao tác', width: 60, align: 'right' },
    // Sửa dẫn tới trang form sản phẩm; không có xóa từng dòng — dùng bulk "Ngừng bán".
    cell: ({ row }) => (
      <Can I="update" a="Product">
        <RowActions editHref={`/catalog/products/${row.original.productId}/edit`} />
      </Can>
    ),
  },
];

function StatusTabs({
  value,
  onChange,
  right,
}: {
  value: SkuStatus | undefined;
  onChange: (v: SkuStatus | undefined) => void;
  right?: React.ReactNode;
}) {
  const tabs: Array<{ key: SkuStatus | undefined; label: string }> = [
    { key: undefined, label: 'Tất cả' },
    { key: 'active', label: 'Đang bán' },
    { key: 'inactive', label: 'Ngừng bán' },
  ];
  return (
    <div className="mb-3 flex items-center border-b">
      <div className="flex" role="tablist" aria-label="Trạng thái bán">
        {tabs.map((t) => (
          <button
            key={t.key ?? '__all__'}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              '-mb-px flex h-9 items-center border-b-2 px-3 text-sm',
              value === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {right ? <div className="ml-auto pb-1">{right}</div> : null}
    </div>
  );
}

/** Nút chuyển góc nhìn Sản phẩm ↔ Theo SKU — nằm trên URL (?view) để dán link giữ nguyên. */
function ViewToggle({
  view,
  onChange,
}: {
  view: 'product' | 'sku';
  onChange: (v: 'product' | 'sku') => void;
}) {
  const options = [
    { key: 'product' as const, label: 'Sản phẩm' },
    { key: 'sku' as const, label: 'Theo SKU' },
  ];
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label="Góc nhìn danh sách">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={view === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded px-2.5 py-1 text-xs',
            view === o.key
              ? 'bg-primary font-semibold text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Bulk "Ngừng bán": xác nhận rồi PATCH /skus/{id} từng SKU đã chọn — kèm `version`
 * từ dòng danh sách (optimistic locking; lệch = người khác vừa sửa → 409, báo lỗi).
 * Không optimistic UI (luật 5: đụng tồn/bán hàng) — chờ server xong mới báo và bỏ chọn.
 */
function BulkStopSelling({ rows, onDone }: { rows: SkuListRow[]; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateSku();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Ngừng bán
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Ngừng bán ${rows.length} SKU?`}
        description="SKU chuyển Ngừng bán — tồn kho và chứng từ giữ nguyên."
        confirmLabel="Ngừng bán"
        onConfirm={async () => {
          try {
            await Promise.all(
              rows.map((r) =>
                update.mutateAsync({
                  skuId: r.skuId,
                  body: { version: r.version, isActive: false },
                }),
              ),
            );
            toast.success(`Đã ngừng bán ${rows.length} SKU`);
            onDone();
          } catch (err) {
            toast.error(messageFor(err));
          }
        }}
      />
    </>
  );
}

export function ProductListScreen() {
  const { state, set, skipTake } = useListState<ProductFilter>(DEFAULTS);
  const view: 'product' | 'sku' = state.filters.view === 'sku' ? 'sku' : 'product';
  const status = parseStatus(state.filters.status);

  const setFilter = (patch: Partial<Record<ProductFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  // Hai query đếm tí hon (take 1) cho dòng mô tả "X SKU đang bán · Y ngừng bán".
  const activeCount = useSkus({ status: 'active', take: 1, skip: 0 });
  const inactiveCount = useSkus({ status: 'inactive', take: 1, skip: 0 });

  const hasFilter =
    state.q !== '' ||
    (Object.entries(state.filters) as Array<[ProductFilter, string]>).some(
      ([k, v]) => k !== 'view' && v !== undefined && v !== '',
    );

  const clearFilters = () => set({ q: '', filters: { view: state.filters.view } });

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description={
          activeCount.data && inactiveCount.data
            ? `${activeCount.data.total} SKU đang bán · ${inactiveCount.data.total} ngừng bán`
            : 'Đang đếm…'
        }
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Danh sách' }]}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/import">
                <Upload aria-hidden />
                Import từ file
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              {/* Endpoint tải file, không phải page: anchor thật để cookie httpOnly
                  đi kèm và trình duyệt tự tải — <Link> sẽ client-navigate, hỏng download. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/exports/skus?format=csv">
                <Download aria-hidden />
                Xuất CSV
              </a>
            </Button>
            <Can I="create" a="Product">
              <Button size="sm" asChild>
                <Link href="/catalog/products/new">
                  <Plus aria-hidden />
                  Thêm sản phẩm
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <StatusTabs
        value={status}
        onChange={(v) => setFilter({ status: v })}
        right={
          <ViewToggle
            view={view}
            onChange={(v) => setFilter({ view: v === 'sku' ? 'sku' : undefined })}
          />
        }
      />

      {view === 'product' ? (
        <ProductView
          state={state}
          set={set}
          setFilter={setFilter}
          skipTake={skipTake}
          status={status}
          hasFilter={hasFilter}
          onClearFilters={clearFilters}
        />
      ) : (
        <SkuView
          state={state}
          set={set}
          setFilter={setFilter}
          skipTake={skipTake}
          status={status}
          hasFilter={hasFilter}
          onClearFilters={clearFilters}
        />
      )}
    </>
  );
}

interface ViewProps {
  state: ReturnType<typeof useListState<ProductFilter>>['state'];
  set: ReturnType<typeof useListState<ProductFilter>>['set'];
  setFilter: (patch: Partial<Record<ProductFilter, string | undefined>>) => void;
  skipTake: { skip: number; take: number };
  status: SkuStatus | undefined;
  hasFilter: boolean;
  onClearFilters: () => void;
}

/** Góc nhìn sản phẩm cha — GET /products với filter/sort server-side. */
function ProductView({
  state,
  set,
  setFilter,
  skipTake,
  status,
  hasFilter,
  onClearFilters,
}: ViewProps) {
  const categories = useCategories();
  const brands = useBrands();
  // Chỉ cột nằm trong whitelist sort của API mới gửi lên — cột khác bấm không có tác dụng.
  const sort = state.sort && PRODUCT_SORTABLE.has(state.sort.id) ? state.sort : null;
  const params = useMemo(
    () => ({
      q: state.q,
      categoryId: state.filters.categoryId,
      brandId: state.filters.brandId,
      isActive: status === undefined ? undefined : status === 'active',
      trackingMode: parseTracking(state.filters.trackingMode),
      hasStock: state.filters.stock === 'in' ? true : undefined,
      sortBy: sort ? (sort.id as 'createdAt' | 'name' | 'code') : undefined,
      sortDir: sort ? (sort.desc ? ('desc' as const) : ('asc' as const)) : undefined,
      ...skipTake,
    }),
    [state.q, state.filters, status, sort, skipTake],
  );
  const query = useProducts(params);

  const filterDefs: FilterDef<ProductFilter>[] = [
    {
      key: 'categoryId',
      label: 'Danh mục',
      type: 'select',
      options: (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'brandId',
      label: 'Thương hiệu',
      type: 'select',
      options: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    },
    {
      key: 'trackingMode',
      label: 'Theo dõi',
      type: 'select',
      options: [
        { value: 'NONE', label: 'Không theo dõi' },
        { value: 'LOT', label: 'Theo lô / HSD' },
        { value: 'SERIAL', label: 'Theo serial' },
      ],
    },
    {
      key: 'stock',
      label: 'Tồn kho',
      type: 'select',
      options: [{ value: 'in', label: 'Còn hàng' }],
    },
  ];

  return (
    <>
      <FilterBar<ProductFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filterDefs}
        values={{
          status: state.filters.status,
          categoryId: state.filters.categoryId,
          brandId: state.filters.brandId,
          trackingMode: state.filters.trackingMode,
          stock: state.filters.stock,
        }}
        onFilterChange={setFilter}
        searchPlaceholder="Tìm theo tên, mã, tên dân dã, SKU, barcode…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có sản phẩm khớp' : 'Chưa có sản phẩm nào'}
            description={
              hasFilter
                ? 'Thử từ khóa khác — tìm được cả theo tên dân dã, mã SKU và barcode. Lọc danh mục đã gộp cả danh mục con.'
                : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý danh mục hàng.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={onClearFilters}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Product">
                  <Button asChild>
                    <Link href="/catalog/products/new">
                      <Plus aria-hidden />
                      Thêm sản phẩm
                    </Link>
                  </Button>
                </Can>
              )
            }
          />
        }
      >
        {(data) => (
          <>
            <DataTable
              columns={productColumns}
              rows={data.items}
              getRowId={(r) => r.id}
              total={data.total}
              page={state.page}
              size={state.size}
              sort={sort}
              onPageChange={(page) => set({ page })}
              onSizeChange={(size) => set({ size })}
              onSortChange={(s) => set({ sort: s })}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Lọc danh mục gộp cả danh mục con · &quot;Còn hàng&quot; = có ít nhất một SKU còn tồn ·
              tồn chi tiết xem ở góc nhìn Theo SKU
            </p>
          </>
        )}
      </QueryState>
    </>
  );
}

/** Góc nhìn SKU phẳng kèm tồn — GET /skus (đúng design ProductList, chỉ q + trạng thái). */
function SkuView({
  state,
  set,
  setFilter,
  skipTake,
  status,
  hasFilter,
  onClearFilters,
}: ViewProps) {
  const [selected, setSelected] = useState<RowSelectionState>({});
  const params = useMemo(() => ({ q: state.q, status, ...skipTake }), [state.q, status, skipTake]);
  const query = useSkus(params);

  return (
    <>
      <FilterBar<ProductFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{ status: state.filters.status }}
        onFilterChange={setFilter}
        searchPlaceholder="Tìm theo SKU, tên, barcode…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={11} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có SKU khớp' : 'Chưa có sản phẩm nào'}
            description={
              hasFilter
                ? 'Thử từ khóa khác — tìm được cả theo mã SKU và barcode.'
                : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý danh mục hàng.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={onClearFilters}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Product">
                  <Button asChild>
                    <Link href="/catalog/products/new">
                      <Plus aria-hidden />
                      Thêm sản phẩm
                    </Link>
                  </Button>
                </Can>
              )
            }
          />
        }
      >
        {(data) => (
          <>
            <DataTable
              columns={skuColumns}
              rows={data.items}
              getRowId={(r) => r.skuId}
              total={data.total}
              page={state.page}
              size={state.size}
              sort={state.sort}
              onPageChange={(page) => set({ page })}
              onSizeChange={(size) => set({ size })}
              onSortChange={(sort) => set({ sort })}
              selection={{ selected, onChange: setSelected }}
              bulkActions={(ids) => (
                <Can I="update" a="Product">
                  <BulkStopSelling
                    rows={data.items.filter((r) => ids.includes(r.skuId))}
                    onDone={() => setSelected({})}
                  />
                </Can>
              )}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Khả dụng = Tồn thực − Đang giữ, gộp mọi kho
            </p>
          </>
        )}
      </QueryState>
    </>
  );
}
