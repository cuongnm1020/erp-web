'use client';

import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useInvalidateOn } from '@/lib/realtime';
import { customerKeys, useCustomers, type Customer } from '../api/use-customers';

const DEFAULTS = { size: 50 };

const columns: ColumnDef<Customer, unknown>[] = [
  { id: 'code', accessorKey: 'code', header: 'Mã', meta: { width: 110 } },
  { id: 'name', accessorKey: 'name', header: 'Tên khách hàng', meta: { width: 260 } },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: 'Điện thoại',
    cell: ({ getValue }) => formatPhone(getValue() as string | null),
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  {
    id: 'creditLimit',
    accessorKey: 'creditLimit',
    header: 'Hạn mức công nợ',
    meta: { align: 'right' },
    cell: ({ getValue }) => formatMoney(getValue() as string | null),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
];

/**
 * Gate FE-0 (FRONTEND-PLAN.md): màn danh sách "throwaway" dựng trên GET /customers chỉ bằng
 * kernel — DataTable, FilterBar, QueryState, format, url-state, Can, useInvalidateOn.
 * Không phải B-01 thật (chưa có spec). Xóa/thay khi FE-1-01 bắt đầu.
 */
export function CustomerListGate() {
  const { state, set, skipTake } = useListState(DEFAULTS);
  const params = useMemo(() => ({ q: state.q, ...skipTake }), [state.q, skipTake]);
  const query = useCustomers(params);
  useInvalidateOn(['customer.created', 'customer.updated'], [customerKeys.lists()]);

  return (
    <>
      <PageHeader
        title="Khách hàng (gate FE-0)"
        description="Màn thử nghiệm kernel — không phải B-01"
        breadcrumb={[{ label: 'Dev' }, { label: 'Khách hàng' }]}
        actions={
          <Can I="create" a="Customer">
            <Button>
              <Plus aria-hidden /> Tạo khách hàng
            </Button>
          </Can>
        }
      />
      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={() => undefined}
        searchPlaceholder="Tìm theo tên, mã, SĐT…"
      />
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={10} columns={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={state.q ? 'Không có khách hàng khớp' : 'Chưa có khách hàng nào'}
            description={
              state.q ? 'Thử từ khóa khác hoặc xóa lọc.' : 'Tạo khách hàng đầu tiên để bắt đầu.'
            }
            action={
              state.q ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Customer">
                  <Button>
                    <Plus aria-hidden /> Tạo khách hàng
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
