'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef, type FilterDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { toUserSort, useUsers, type UserListItem } from '../api/use-users';
import { useRoles } from '../api/use-roles';
import { UserCreateDialog } from './user-create-dialog';

const FILTER_KEYS = ['status', 'role'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const DEFAULTS = {
  size: 50,
  sort: { id: 'code', desc: false },
  filterKeys: FILTER_KEYS,
};

/**
 * I-01 Danh sách nhân viên — GET /users. Phân trang/tìm/sắp xếp phía server, state trên URL
 * (luật 8). Cột "Đăng nhập gần nhất" của mockup chưa có cột dữ liệu — không dựng cột giả.
 */
const columns: ColumnDef<UserListItem, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã NV',
    meta: { width: 140, sortable: true },
    cell: ({ row }) => (
      <Link
        href={`/admin/users/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'fullName',
    accessorKey: 'fullName',
    header: 'Họ tên',
    meta: { width: 220, sortable: true },
    cell: ({ getValue }) => <span className="font-semibold">{getValue() as string}</span>,
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: 'Email',
    meta: { width: 220, sortable: true },
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
  },
  {
    id: 'departmentName',
    accessorKey: 'departmentName',
    header: 'Phòng ban',
    meta: { width: 160 },
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  {
    id: 'roleCodes',
    accessorKey: 'roleCodes',
    header: 'Vai trò',
    meta: { width: 220 },
    cell: ({ row }) =>
      row.original.isSuperAdmin ? (
        <StatusBadge tone="brand">Superadmin</StatusBadge>
      ) : row.original.roleCodes.length === 0 ? (
        '—'
      ) : (
        <span className="flex flex-wrap gap-1">
          {row.original.roleCodes.map((r) => (
            <StatusBadge key={r} tone="neutral">
              {r}
            </StatusBadge>
          ))}
        </span>
      ),
  },
  {
    id: 'isActive',
    accessorKey: 'isActive',
    header: 'Trạng thái',
    meta: { width: 110 },
    cell: ({ getValue }) =>
      (getValue() as boolean) ? (
        <StatusBadge tone="ok">Hoạt động</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Đã khóa</StatusBadge>
      ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Tạo lúc',
    meta: { width: 110, sortable: true },
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
];

export function UsersScreen() {
  const { state, set, skipTake } = useListState<FilterKey>(DEFAULTS);
  const [createOpen, setCreateOpen] = useState(false);
  const roles = useRoles();

  const params = useMemo(
    () => ({
      q: state.q,
      roleCode: state.filters.role || undefined,
      isActive:
        state.filters.status === 'active'
          ? true
          : state.filters.status === 'inactive'
            ? false
            : undefined,
      ...toUserSort(state.sort),
      ...skipTake,
    }),
    [state.q, state.filters.role, state.filters.status, state.sort, skipTake],
  );
  const query = useUsers(params);

  const filters: FilterDef<FilterKey>[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'active', label: 'Hoạt động' },
        { value: 'inactive', label: 'Đã khóa' },
      ],
    },
    {
      key: 'role',
      label: 'Vai trò',
      type: 'select',
      options: (roles.data ?? []).map((r) => ({ value: r.code, label: r.name })),
    },
  ];

  return (
    <>
      <PageHeader
        title="Nhân viên"
        description={query.data ? `${query.data.total} tài khoản` : 'Đang đếm…'}
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
        actions={
          <Can I="create" a="User">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Thêm nhân viên
            </Button>
          </Can>
        }
      />

      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filters}
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm mã, tên, email…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={7} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={state.q ? 'Không có nhân viên khớp' : 'Chưa có nhân viên'}
            description={
              state.q ? 'Thử từ khóa khác.' : 'Thêm nhân viên đầu tiên để phân quyền sử dụng.'
            }
            action={
              state.q ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="User">
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    Thêm nhân viên
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

      <UserCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
