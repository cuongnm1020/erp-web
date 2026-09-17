'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef, type FilterDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useCombos, useDeleteCombo, type ComboListItem } from '../api/use-combos';

/**
 * Combo sản phẩm — GET /combos. Combo = một mã bán gộp nhiều SKU thành phần: KHÔNG có tồn
 * riêng, cột "Còn bán được" tính từ tồn khả dụng của thành phần (min floor(khả dụng / định
 * mức)). Khi lên đơn chọn combo như SKU thường — server bung thành dòng thành phần và giữ
 * tồn trên từng thành phần.
 */
const DEFAULTS = { size: 50, filterKeys: ['status'] as const };
type ComboFilter = (typeof DEFAULTS.filterKeys)[number];
const SORTABLE = new Set(['code', 'name', 'createdAt']);

const columns: ColumnDef<ComboListItem, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã combo',
    meta: { width: 130, sortable: true },
    cell: ({ row }) => (
      <Link
        href={`/catalog/combos/${row.original.id}/edit`}
        className="font-mono text-xs font-semibold text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tên combo',
    meta: { sortable: true },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: 'components',
    header: 'Thành phần',
    meta: { width: 110, align: 'right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.componentCount} SKU</span>,
  },
  {
    id: 'salePrice',
    header: 'Giá bán',
    meta: { width: 130, align: 'right' },
    cell: ({ row }) =>
      row.original.salePrice === null ? (
        <span className="text-xs text-muted-foreground">Chưa đặt giá</span>
      ) : (
        <span className="tabular-nums">{formatMoney(row.original.salePrice)}</span>
      ),
  },
  {
    id: 'available',
    header: 'Còn bán được',
    meta: { width: 120, align: 'right' },
    // Tính từ tồn thành phần — combo không có tồn riêng (bất biến 2). 0 = có thành phần hết hàng.
    cell: ({ row }) => (
      <span
        className={cn(
          'tabular-nums',
          row.original.available === '0' ? 'font-semibold text-destructive' : '',
        )}
        title="min(khả dụng thành phần ÷ định mức) — tồn nằm ở thành phần"
      >
        {formatQuantity(row.original.available)} {row.original.baseUomCode}
      </span>
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
    cell: ({ row }) => <ComboRowActions combo={row.original} />,
  },
];

function ComboRowActions({ combo }: { combo: ComboListItem }) {
  const ability = useAbility();
  const del = useDeleteCombo();
  const canUpdate = ability.can('update', 'Product');
  const canDelete = ability.can('delete', 'Product');
  if (!canUpdate && !canDelete) return null;
  return (
    <RowActions
      editHref={canUpdate ? `/catalog/combos/${combo.id}/edit` : undefined}
      itemName={`combo ${combo.code}`}
      deleteDescription="Xóa mềm: ẩn khỏi danh sách và ô tìm sản phẩm khi lên đơn. Đơn đã tạo giữ nguyên dòng thành phần."
      onDelete={
        canDelete
          ? async () => {
              try {
                await del.mutateAsync(combo.id);
                toast.success(`Đã xóa combo ${combo.code}`);
              } catch (err) {
                toast.error(messageFor(err));
              }
            }
          : undefined
      }
    />
  );
}

export function ComboListScreen() {
  const { state, set, skipTake } = useListState<ComboFilter>(DEFAULTS);
  const status = state.filters.status;
  const sort = state.sort && SORTABLE.has(state.sort.id) ? state.sort : null;
  const params = useMemo(
    () => ({
      q: state.q,
      isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
      sortBy: sort ? (sort.id as 'code' | 'name' | 'createdAt') : undefined,
      sortDir: sort ? (sort.desc ? ('desc' as const) : ('asc' as const)) : undefined,
      ...skipTake,
    }),
    [state.q, status, sort, skipTake],
  );
  const query = useCombos(params);
  const hasFilter = state.q !== '' || (status !== undefined && status !== '');

  const filterDefs: FilterDef<ComboFilter>[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'active', label: 'Đang bán' },
        { value: 'inactive', label: 'Ngừng bán' },
      ],
    },
  ];

  return (
    <>
      <PageHeader
        title="Combo sản phẩm"
        description="Một mã bán gộp nhiều SKU — tồn và pick / đóng gói vẫn tính trên từng thành phần"
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Combo sản phẩm' }]}
        actions={
          <Can I="create" a="Product">
            <Button size="sm" asChild>
              <Link href="/catalog/combos/new">
                <Plus aria-hidden />
                Tạo combo
              </Link>
            </Button>
          </Can>
        }
      />

      <FilterBar<ComboFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filterDefs}
        values={{ status: state.filters.status }}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm theo mã, tên combo hoặc mã / tên SKU thành phần…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có combo khớp' : 'Chưa có combo nào'}
            description={
              hasFilter
                ? 'Thử từ khóa khác — tìm được cả theo mã / tên SKU thành phần.'
                : 'Tạo combo đầu tiên: chọn các SKU thành phần, định mức mỗi combo và giá bán.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Product">
                  <Button asChild>
                    <Link href="/catalog/combos/new">
                      <Plus aria-hidden />
                      Tạo combo
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
              Còn bán được = ít nhất trong các thành phần của (khả dụng ÷ định mức), gộp mọi kho ·
              giá bán là giá combo trong bảng giá mặc định
            </p>
          </>
        )}
      </QueryState>
    </>
  );
}
