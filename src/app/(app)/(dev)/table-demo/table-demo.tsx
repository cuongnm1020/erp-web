'use client';

import { useMemo, useState } from 'react';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type FilterDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/format';
import { useListState } from '@/lib/url-state';

interface Row {
  id: string;
  name: string;
  owner: string;
  status: 'ACTIVE' | 'INACTIVE';
  revenue: string;
  lastOrderAt: string;
}

const OWNERS = ['sale.hn.1', 'sale.hn.2', 'sale.hcm.1'];
const ALL: Row[] = Array.from({ length: 5000 }, (_, i) => ({
  id: `c${i}`,
  name: `Khách hàng ${i.toString().padStart(4, '0')}`,
  owner: OWNERS[i % 3]!,
  status: i % 7 === 0 ? 'INACTIVE' : 'ACTIVE',
  revenue: String((i * 73_000) % 950_000_000),
  lastOrderAt: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000 * 5).toISOString(),
}));

type F = 'owner' | 'status';
const FILTERS: FilterDef<F>[] = [
  {
    key: 'owner',
    label: 'Nhân viên phụ trách',
    type: 'select',
    options: OWNERS.map((o) => ({ value: o, label: o })),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: [
      { value: 'ACTIVE', label: 'Đang hoạt động' },
      { value: 'INACTIVE', label: 'Ngừng' },
    ],
  },
];
const DEFAULTS = {
  size: 50,
  sort: { id: 'name', desc: false },
  filterKeys: ['owner', 'status'] as const,
};

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'name', accessorKey: 'name', header: 'Tên', meta: { sortable: true, width: 220 } },
  { id: 'owner', accessorKey: 'owner', header: 'Nhân viên phụ trách', meta: { sortable: true } },
  { id: 'status', accessorKey: 'status', header: 'Trạng thái' },
  {
    id: 'revenue',
    accessorKey: 'revenue',
    header: 'Doanh số',
    meta: { sortable: true, align: 'right' },
    cell: ({ getValue }) => formatMoney(getValue() as string),
  },
  {
    id: 'lastOrderAt',
    accessorKey: 'lastOrderAt',
    header: 'Đơn gần nhất',
    meta: { sortable: true },
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
];

/** Giả lập server: lọc/sort/phân trang trên mảng — CHỈ cho demo, màn thật gọi API. */
function fakeServer(state: ReturnType<typeof useListState<F>>['state'], big: boolean) {
  let rows = ALL;
  if (state.q) rows = rows.filter((r) => r.name.toLowerCase().includes(state.q.toLowerCase()));
  if (state.filters.owner) rows = rows.filter((r) => r.owner === state.filters.owner);
  if (state.filters.status) rows = rows.filter((r) => r.status === state.filters.status);
  if (state.sort) {
    const { id, desc } = state.sort;
    rows = [...rows].sort((a, b) => {
      const x = a[id as keyof Row];
      const y = b[id as keyof Row];
      const c = id === 'revenue' ? Number(x) - Number(y) : String(x).localeCompare(String(y));
      return desc ? -c : c;
    });
  }
  const total = rows.length;
  const size = big ? 5000 : state.size;
  const start = big ? 0 : (state.page - 1) * state.size;
  return { items: rows.slice(start, start + size), total };
}

export function TableDemo() {
  const { state, set } = useListState<F>(DEFAULTS);
  const [big, setBig] = useState(false);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const data = useMemo(() => fakeServer(state, big), [state, big]);

  return (
    <>
      <PageHeader
        title="Demo bảng"
        description="5.000 dòng giả lập — đổi sort/filter rồi F5, dán URL sang tab khác"
        breadcrumb={[{ label: 'Dev' }, { label: 'Bảng' }]}
        actions={
          <Button variant="outline" onClick={() => setBig((b) => !b)}>
            {big ? 'Phân trang' : 'Hiện 5.000 dòng (virtualize)'}
          </Button>
        }
      />
      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={FILTERS}
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm theo tên…"
      />
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
        selection={{ selected, onChange: setSelected }}
        bulkActions={(ids) => (
          <>
            <Button size="sm" variant="outline">
              Gán sale
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Bỏ chọn {ids.length}
            </Button>
          </>
        )}
      />
    </>
  );
}
