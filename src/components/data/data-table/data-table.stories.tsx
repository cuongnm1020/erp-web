import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import type { SortState } from '@/lib/url-state';
import { makeCustomers } from '@/test/msw/handlers';
import { EmptyState } from '../states/empty-state';
import { ErrorState } from '../states/error-state';
import { ListSkeleton } from '../states/skeletons';
import { DataTable } from './data-table';
import { FilterBar } from './filter-bar';

type Row = ReturnType<typeof makeCustomers>[number];

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'code', accessorKey: 'code', header: 'Mã', meta: { width: 110, sortable: true } },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tên khách hàng',
    meta: { width: 240, sortable: true },
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: 'Điện thoại',
    cell: ({ getValue }) => formatPhone(getValue() as string),
  },
  {
    id: 'creditLimit',
    accessorKey: 'creditLimit',
    header: 'Hạn mức',
    meta: { align: 'right', sortable: true },
    cell: ({ getValue }) => formatMoney(getValue() as string),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
];

function Demo({ rows, total }: { rows: Row[]; total: number }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [sort, setSort] = useState<SortState | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Partial<Record<'status', string>>>({});
  const [selected, setSelected] = useState<RowSelectionState>({});
  return (
    <>
      <FilterBar
        q={q}
        onQChange={setQ}
        values={filters}
        onFilterChange={(p) => setFilters((f) => ({ ...f, ...p }))}
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            type: 'select',
            options: [
              { value: 'ACTIVE', label: 'Đang hoạt động' },
              { value: 'INACTIVE', label: 'Ngừng' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        total={total}
        page={page}
        size={size}
        sort={sort}
        onPageChange={setPage}
        onSizeChange={setSize}
        onSortChange={setSort}
        selection={{ selected, onChange: setSelected }}
        bulkActions={(ids) => (
          <Button size="sm" variant="outline">
            Gán sale ({ids.length})
          </Button>
        )}
      />
    </>
  );
}

const meta: Meta<typeof Demo> = { title: 'Data/DataTable', component: Demo };
export default meta;

export const Success: StoryObj<typeof Demo> = { args: { rows: makeCustomers(50), total: 237 } };
export const Virtualized5000: StoryObj<typeof Demo> = {
  name: 'Success (5.000 dòng virtualize)',
  args: { rows: makeCustomers(5000), total: 5000 },
};
export const Loading: StoryObj = { render: () => <ListSkeleton rows={10} columns={6} /> };
export const Empty: StoryObj = {
  render: () => (
    <EmptyState title="Chưa có khách hàng nào" action={<Button>Tạo khách hàng</Button>} />
  ),
};
export const Error: StoryObj = {
  render: () => (
    <ErrorState
      error={new ApiError(500, 'DB_ERROR', 'x', undefined, 'trace-xyz')}
      onRetry={() => undefined}
    />
  ),
};
