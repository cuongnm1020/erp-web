'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useDeleteProduct, useProducts, type ProductListItem } from '../api/use-products';
import { ProductFormDialog } from './product-form-dialog';

/** GET /products không nhận sortBy/sortDir → không cột nào sortable, mặc định không sort. */
const DEFAULTS = { size: 50, sort: null };

/**
 * C-01 Danh sách sản phẩm — GET /products (đã nối API, thay mockup).
 * Phân trang / tìm nhanh nằm trên URL (luật 8); q được backend khớp cả mã SKU và barcode.
 * API chưa có lọc theo danh mục / thương hiệu / trạng thái nên chưa dựng các bộ lọc đó.
 */
const columns: ColumnDef<ProductListItem, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã SP',
    meta: { width: 130 },
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
    meta: { width: 300 },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="truncate font-semibold" title={row.original.name}>
          {row.original.name}
        </span>
        {row.original.isActive ? null : <StatusBadge tone="neutral">Ngừng bán</StatusBadge>}
      </span>
    ),
  },
  {
    id: 'category',
    header: 'Danh mục',
    meta: { width: 170 },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.category?.name ?? '—'}</span>
    ),
  },
  {
    id: 'brand',
    header: 'Thương hiệu',
    meta: { width: 140 },
    cell: ({ row }) => row.original.brand?.name ?? '—',
  },
  {
    id: 'skuCount',
    header: 'SKU',
    meta: { align: 'right', width: 70 },
    cell: ({ row }) => row.original.skus.length,
  },
  {
    id: 'trackingMode',
    header: 'Theo dõi',
    meta: { width: 130 },
    cell: ({ row }) =>
      row.original.trackingMode === 'NONE' ? (
        '—'
      ) : (
        <StatusBadge tone="draft">
          {row.original.trackingMode === 'LOT' ? 'Theo lô' : 'Theo serial'}
        </StatusBadge>
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { title: 'Thao tác', width: 90, align: 'right' },
    cell: ({ row }) => <ProductRowActions product={row.original} />,
  },
];

/**
 * Sửa mở dialog tại chỗ; Xóa = soft delete phía API (sản phẩm + SKU chuyển Ngừng bán,
 * tồn kho và chứng từ cũ giữ nguyên) — không optimistic (luật 5).
 */
function ProductRowActions({ product }: { product: ProductListItem }) {
  const ability = useAbility();
  const del = useDeleteProduct();
  const [editOpen, setEditOpen] = useState(false);
  const canUpdate = ability.can('update', 'Product');
  const canDelete = ability.can('delete', 'Product');
  if (!canUpdate && !canDelete) return null;
  return (
    <>
      <RowActions
        onEdit={canUpdate ? () => setEditOpen(true) : undefined}
        onDelete={
          canDelete
            ? () =>
                del.mutateAsync(product.id).then(
                  () => toast.success(`Đã xóa sản phẩm ${product.code}`),
                  (err) => toast.error(messageFor(err)),
                )
            : undefined
        }
        itemName={`sản phẩm ${product.code}`}
        deleteDescription="Sản phẩm và toàn bộ SKU chuyển Ngừng bán — tồn kho và chứng từ cũ giữ nguyên."
      />
      {canUpdate ? (
        <ProductFormDialog
          mode="edit"
          product={product}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </>
  );
}

export function ProductListScreen() {
  const { state, set, skipTake } = useListState(DEFAULTS);
  const [createOpen, setCreateOpen] = useState(false);
  const params = useMemo(() => ({ q: state.q, ...skipTake }), [state.q, skipTake]);
  const query = useProducts(params);

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description={query.data ? `${query.data.total} sản phẩm` : 'Đang đếm…'}
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Danh sách' }]}
        actions={
          <Can I="create" a="Product">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Thêm sản phẩm
            </Button>
          </Can>
        }
      />

      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={() => undefined}
        searchPlaceholder="Tìm theo tên, mã SP, mã SKU, barcode…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={7} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={state.q ? 'Không có sản phẩm khớp' : 'Chưa có sản phẩm nào'}
            description={
              state.q
                ? 'Thử từ khóa khác — tìm được cả theo mã SKU và barcode.'
                : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý danh mục hàng.'
            }
            action={
              state.q ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Product">
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    Thêm sản phẩm
                  </Button>
                </Can>
              )
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={state.page}
            size={state.size}
            sort={state.sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(sort) => set({ sort })}
          />
        )}
      </QueryState>

      <Can I="create" a="Product">
        <ProductFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
      </Can>
    </>
  );
}
