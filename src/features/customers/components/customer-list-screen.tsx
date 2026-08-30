'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import {
  customerKeys,
  toCustomerSort,
  useCustomers,
  useDeleteCustomer,
  type Customer,
} from '../api/use-customers';
import { customerTypeLabel, customerTypeTone } from '../labels';

/** Mặc định khớp mặc định của API: sắp theo tên tăng dần. */
const DEFAULTS = { size: 50, sort: { id: 'name', desc: false } };

/**
 * B-01 Danh sách khách hàng — GET /customers.
 * Danh sách đã được API scope (bất biến 8): sale chỉ nhận về khách của mình / của team mình
 * làm leader. Frontend KHÔNG lọc lại theo quyền (luật 7); thấy bản ghi lạ là bug backend.
 *
 * Phân trang / tìm nhanh / sắp xếp nằm trên URL (luật 8) — F5 và dán link cho đồng nghiệp ra
 * đúng kết quả. Sắp xếp chạy PHÍA SERVER qua `sortBy`/`sortDir`; chỉ những cột API nhận mới
 * được đánh `sortable` (name, code, type, creditLimit, createdAt) để không hứa hão.
 * `GET /customers` vẫn chưa có lọc theo cấp độ, tag, công nợ nên chưa dựng các bộ lọc đó.
 */
const columns: ColumnDef<Customer, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã KH',
    meta: { width: 120, sortable: true },
    cell: ({ row }) => (
      <Link
        href={`/crm/customers/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tên khách hàng',
    meta: { width: 280, sortable: true },
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: 'Điện thoại',
    meta: { width: 130 },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{formatPhone(getValue() as string | null)}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Loại khách',
    meta: { width: 150, sortable: true },
    cell: ({ row }) => (
      <StatusBadge tone={customerTypeTone(row.original.type)}>
        {customerTypeLabel(row.original.type)}
      </StatusBadge>
    ),
  },
  {
    id: 'creditLimit',
    accessorKey: 'creditLimit',
    header: 'Hạn mức công nợ',
    meta: { align: 'right', width: 150, sortable: true },
    cell: ({ getValue }) => formatMoney(getValue() as string | null, { unit: '' }),
  },
  {
    id: 'paymentTerm',
    accessorKey: 'paymentTerm',
    header: 'Hạn thanh toán',
    meta: { align: 'right', width: 130 },
    cell: ({ getValue }) => {
      const d = getValue() as number | null;
      return d === null ? '—' : `${d} ngày`;
    },
  },
  {
    id: 'isActive',
    accessorKey: 'isActive',
    header: 'Trạng thái',
    meta: { width: 120 },
    cell: ({ getValue }) =>
      (getValue() as boolean) ? (
        <StatusBadge tone="ok">Hoạt động</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Ngừng</StatusBadge>
      ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Khách từ',
    meta: { width: 120, sortable: true },
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
  {
    id: 'actions',
    header: '',
    meta: { title: 'Thao tác', width: 90, align: 'right' },
    cell: ({ row }) => <CustomerRowActions customer={row.original} />,
  },
];

/** Xóa = soft delete phía API (KH chuyển Ngừng hợp tác, giữ lịch sử) — không optimistic (luật 5). */
function CustomerRowActions({ customer }: { customer: Customer }) {
  const ability = useAbility();
  const del = useDeleteCustomer();
  const canUpdate = ability.can('update', 'Customer');
  const canDelete = ability.can('delete', 'Customer');
  if (!canUpdate && !canDelete) return null;
  return (
    <RowActions
      editHref={canUpdate ? `/crm/customers/${customer.id}/edit` : undefined}
      onDelete={
        canDelete
          ? () =>
              del.mutateAsync(customer.id).then(
                () => toast.success(`Đã xóa khách hàng ${customer.code}`),
                (err) => toast.error(messageFor(err)),
              )
          : undefined
      }
      itemName={`khách hàng ${customer.code}`}
      deleteDescription="Khách chuyển sang Ngừng hợp tác — dữ liệu và lịch sử đơn / công nợ giữ nguyên."
    />
  );
}

export function CustomerListScreen() {
  const { state, set, skipTake } = useListState(DEFAULTS);
  const params = useMemo(
    () => ({ q: state.q, ...toCustomerSort(state.sort), ...skipTake }),
    [state.q, state.sort, skipTake],
  );
  const query = useCustomers(params);
  useInvalidateOn(['customer.created', 'customer.updated'], [customerKeys.lists()]);

  return (
    <>
      <PageHeader
        title="Khách hàng của tôi"
        description={
          query.data ? `${query.data.total} khách được phân cho tôi` : 'Đang đếm số khách…'
        }
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Danh sách' }]}
        actions={
          <Can I="create" a="Customer">
            <Button size="sm" asChild>
              <Link href="/crm/customers/new">
                <Plus aria-hidden />
                Tạo khách hàng
              </Link>
            </Button>
          </Can>
        }
      />

      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={() => undefined}
        searchPlaceholder="Tìm theo tên, mã KH, SĐT…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={state.q ? 'Không có khách hàng khớp' : 'Chưa có khách hàng nào được phân'}
            description={
              state.q
                ? 'Thử từ khóa khác — hoặc khách này đang do người khác phụ trách.'
                : 'Tạo khách hàng đầu tiên để bắt đầu bán.'
            }
            action={
              state.q ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Customer">
                  <Button asChild>
                    <Link href="/crm/customers/new">
                      <Plus aria-hidden />
                      Tạo khách hàng
                    </Link>
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
    </>
  );
}
