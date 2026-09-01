'use client';

import { Download, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
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
import { formatQuantity } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useSkus, useUpdateSku, type SkuListRow } from '../api/use-products';

/**
 * C-01 Danh sách sản phẩm — GET /skus, theo design/Products/ProductList@2x.png:
 * mỗi dòng một SKU kèm tồn thực / đang giữ / khả dụng gộp mọi kho.
 *
 * Sắp cố định theo mã SKU — API không nhận sort nên không cột nào sortable (không hứa hão).
 * Kích thước trang 50 theo quy ước chung của app (design vẽ 40).
 *
 * Khác design vì API chưa có (bổ sung sau khi backend sẵn sàng):
 * - "7 dưới ngưỡng" trên tiêu đề + chip lọc "Dưới ngưỡng": chưa có API ngưỡng đặt lại (reorder point).
 * - Chip lọc tồn "Còn hàng / Hết hàng": GET /skus chưa nhận filter theo tồn.
 * - Bộ lọc đã lưu ("Đã lưu: …") và chọn cột ("Cột"): chưa có API saved view.
 * - Cột "Giá niêm yết": SkuListRowDto chưa có giá.
 * - Bulk "Cập nhật giá" / "In tem": chưa có API — chỉ còn bulk "Ngừng bán".
 */
const DEFAULTS = { size: 50, filterKeys: ['status'] as const };

type ProductFilter = (typeof DEFAULTS.filterKeys)[number];
type SkuStatus = 'active' | 'inactive';

function parseStatus(v: string | undefined): SkuStatus | undefined {
  return v === 'active' || v === 'inactive' ? v : undefined;
}

const columns: ColumnDef<SkuListRow, unknown>[] = [
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
}: {
  value: SkuStatus | undefined;
  onChange: (v: SkuStatus | undefined) => void;
}) {
  const tabs: Array<{ key: SkuStatus | undefined; label: string }> = [
    { key: undefined, label: 'Tất cả' },
    { key: 'active', label: 'Đang bán' },
    { key: 'inactive', label: 'Ngừng bán' },
  ];
  return (
    <div className="mb-3 flex border-b" role="tablist" aria-label="Trạng thái SKU">
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
  );
}

/**
 * Bulk "Ngừng bán": xác nhận rồi PATCH /skus/{id} từng SKU đã chọn.
 * Không optimistic (luật 5: đụng tồn/bán hàng) — chờ server xong mới báo và bỏ chọn.
 */
function BulkStopSelling({ ids, onDone }: { ids: string[]; onDone: () => void }) {
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
        title={`Ngừng bán ${ids.length} SKU?`}
        description="SKU chuyển Ngừng bán — tồn kho và chứng từ giữ nguyên."
        confirmLabel="Ngừng bán"
        onConfirm={async () => {
          try {
            await Promise.all(
              ids.map((skuId) => update.mutateAsync({ skuId, body: { isActive: false } })),
            );
            toast.success(`Đã ngừng bán ${ids.length} SKU`);
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
  const [selected, setSelected] = useState<RowSelectionState>({});
  const status = parseStatus(state.filters.status);
  const params = useMemo(() => ({ q: state.q, status, ...skipTake }), [state.q, status, skipTake]);
  const query = useSkus(params);
  // Hai query đếm tí hon (take 1) cho dòng mô tả "X SKU đang bán · Y ngừng bán".
  const activeCount = useSkus({ status: 'active', take: 1, skip: 0 });
  const inactiveCount = useSkus({ status: 'inactive', take: 1, skip: 0 });

  const setFilter = (patch: Partial<Record<ProductFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter = state.q !== '' || status !== undefined;

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

      <StatusTabs value={status} onChange={(v) => setFilter({ status: v })} />

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
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
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
              columns={columns}
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
                  <BulkStopSelling ids={ids} onDone={() => setSelected({})} />
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
