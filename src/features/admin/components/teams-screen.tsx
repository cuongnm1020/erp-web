'use client';

import { Folder, Info, Pencil, Plus, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import {
  useAdminTeams,
  useAssignUserToDepartment,
  useDepartments,
  useRemoveUserFromDepartment,
  type Department,
  type Team,
} from '../api/use-departments';
import { toUserSort, useUsers, type UserListItem } from '../api/use-users';
import { DepartmentDialog } from './department-dialog';

/**
 * I-05 Phòng ban & team — nối API phòng ban (`/departments`, `/users?departmentId`).
 *
 * Phòng ban = cơ cấu tổ chức (cây `parentId`), mỗi nhân viên thuộc tối đa một phòng ban.
 * Cây bên trái chọn phòng ban (URL `?dept=`); giữa là thông tin + danh sách nhân viên
 * (GET /users?departmentId, phân trang/sort server); phải là panel thêm nhân viên
 * (PUT /departments/{id}/users/{userId}). Gỡ = PATCH /users/{id} departmentId null.
 *
 * TEAM chỉ đọc (GET /teams): backend chưa có API tạo/sửa team hay gán thành viên / leader —
 * phần "Thêm thành viên vào team", "Leader toggle", "Chuyển team" của artboard chờ API đó.
 * Không hiện số bịa (luật 2): "Khách hàng đã phân" theo team xem ở màn Phân công.
 */
const DEFAULTS = {
  size: 50,
  sort: { id: 'code', desc: false },
  filterKeys: ['dept'] as const,
};

interface TreeRow {
  dept: Department;
  depth: number;
}

/** DFS theo parentId: con đứng ngay dưới cha; node mồ côi (cha không tải được) xuống cuối. */
function buildTree(list: Department[]): TreeRow[] {
  const byParent = new Map<string | null, Department[]>();
  for (const d of list) byParent.set(d.parentId, [...(byParent.get(d.parentId) ?? []), d]);
  const out: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const d of byParent.get(parentId) ?? []) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push({ dept: d, depth });
      walk(d.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const d of list) if (!seen.has(d.id)) out.push({ dept: d, depth: 0 });
  return out;
}

export function TeamsScreen() {
  const departments = useDepartments();
  const teams = useAdminTeams();
  // Danh bạ nhân viên cho select Trưởng phòng + tra tên (10–200 người, cache theo userKeys).
  const directory = useUsers({ take: 200, skip: 0, sortBy: 'fullName', sortDir: 'asc' });
  const [creating, setCreating] = useState(false);
  const users = directory.data?.items ?? [];

  return (
    <>
      <QueryState
        query={departments}
        skeleton={<ListSkeleton rows={8} columns={4} />}
        isEmpty={(d) => d.length === 0}
        empty={
          <>
            <PageHeader
              title="Phòng ban & team"
              description="Chưa có phòng ban nào"
              breadcrumb={[{ label: 'Quản trị' }, { label: 'Phòng ban & team' }]}
            />
            <EmptyState
              title="Chưa có phòng ban"
              description="Tạo phòng ban đầu tiên rồi chuyển nhân viên vào — cơ cấu tổ chức hiện ở màn nhân viên và hồ sơ."
              action={
                <Can I="update" a="User">
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus aria-hidden />
                    Thêm phòng ban
                  </Button>
                </Can>
              }
            />
          </>
        }
      >
        {(list) => (
          <DepartmentsBody
            departments={list}
            teams={teams.data ?? []}
            users={users}
            onCreate={() => setCreating(true)}
          />
        )}
      </QueryState>
      {creating ? (
        <DepartmentDialog
          open={creating}
          onOpenChange={setCreating}
          departments={departments.data ?? []}
          users={users}
        />
      ) : null}
    </>
  );
}

function DepartmentsBody({
  departments,
  teams,
  users,
  onCreate,
}: {
  departments: Department[];
  teams: Team[];
  users: UserListItem[];
  onCreate: () => void;
}) {
  const { state, set, skipTake } = useListState<'dept'>(DEFAULTS);
  const tree = useMemo(() => buildTree(departments), [departments]);
  const selected =
    departments.find((d) => d.id === state.filters.dept) ?? tree[0]?.dept ?? departments[0]!;
  const totalMembers = departments.reduce((n, d) => n + d._count.members, 0);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.fullName])), [users]);

  return (
    <>
      <PageHeader
        title="Phòng ban & team"
        description={`${departments.length} phòng ban · ${teams.length} team · ${totalMembers} nhân viên có phòng ban`}
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Phòng ban & team' }]}
        actions={
          <Can I="update" a="User">
            <Button size="sm" onClick={onCreate}>
              <Plus aria-hidden />
              Thêm phòng ban
            </Button>
          </Can>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-[260px_1fr_360px]">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Cơ cấu</h2>
          <nav className="py-1" aria-label="Phòng ban">
            {tree.map(({ dept, depth }) => (
              <button
                key={dept.id}
                type="button"
                aria-current={dept.id === selected.id ? 'true' : undefined}
                onClick={() => set({ filters: { dept: dept.id }, q: '' })}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted',
                  dept.id === selected.id && 'bg-secondary font-semibold text-primary',
                  !dept.isActive && 'text-muted-foreground',
                )}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{dept.name}</span>
                {!dept.isActive ? <StatusBadge tone="neutral">Ngừng</StatusBadge> : null}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {dept._count.members}
                </span>
              </button>
            ))}
          </nav>
          <h2 className="border-y px-3 py-2 text-sm font-semibold">
            Team{' '}
            <span className="font-normal text-muted-foreground">· {teams.length} · chỉ đọc</span>
          </h2>
          <ul className="py-1">
            {teams.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm"
                style={{ paddingLeft: t.parentId ? '28px' : undefined }}
              >
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{t.code}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Tạo/sửa team và gán thành viên / leader chưa có API — phân quyền khách hàng theo team
            xem ở màn Phân công.
          </p>
        </section>

        <DepartmentDetail
          department={selected}
          departments={departments}
          managerName={selected.managerId ? userName.get(selected.managerId) : undefined}
          listState={{ state, set, skipTake }}
          onEdit={() => setEditing(true)}
          onAddMembers={() => setAdding(true)}
        />

        {adding ? (
          <AddMembersPanel department={selected} onClose={() => setAdding(false)} />
        ) : (
          <aside className="rounded-md border border-dashed bg-card p-4 text-sm text-muted-foreground">
            Chọn <span className="font-medium text-foreground">Thêm thành viên</span> để chuyển nhân
            viên vào {selected.name}. Mỗi nhân viên thuộc đúng một phòng ban — chuyển vào đây là rời
            phòng ban cũ.
          </aside>
        )}
      </div>

      {editing ? (
        <DepartmentDialog
          open={editing}
          onOpenChange={setEditing}
          departments={departments}
          users={users}
          department={selected}
        />
      ) : null}
    </>
  );
}

function DepartmentDetail({
  department,
  departments,
  managerName,
  listState,
  onEdit,
  onAddMembers,
}: {
  department: Department;
  departments: Department[];
  managerName: string | undefined;
  listState: ReturnType<typeof useListState<'dept'>>;
  onEdit: () => void;
  onAddMembers: () => void;
}) {
  const { state, set, skipTake } = listState;
  const ability = useAbility();
  const canUpdate = ability.can('update', 'User');
  const remove = useRemoveUserFromDepartment();
  const parent = departments.find((d) => d.id === department.parentId);

  const params = useMemo(
    () => ({ q: state.q, departmentId: department.id, ...toUserSort(state.sort), ...skipTake }),
    [state.q, state.sort, department.id, skipTake],
  );
  const members = useUsers(params);

  const columns = useMemo<ColumnDef<UserListItem, unknown>[]>(
    () => [
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Mã NV',
        meta: { width: 130, sortable: true },
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
        meta: { width: 200, sortable: true },
        cell: ({ row }) => (
          <span className="font-semibold">
            {row.original.fullName}
            {row.original.id === department.managerId ? (
              <StatusBadge tone="brand" className="ml-1.5">
                Trưởng phòng
              </StatusBadge>
            ) : null}
          </span>
        ),
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        meta: { width: 200, sortable: true },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        id: 'roleCodes',
        header: 'Vai trò',
        meta: { width: 180 },
        cell: ({ row }) =>
          row.original.roleCodes.length === 0 ? (
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
            <StatusBadge tone="neutral">Khóa</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: '',
        meta: { title: 'Thao tác', width: 70, align: 'right' },
        cell: ({ row }) =>
          canUpdate ? (
            <RowActions
              onDelete={() =>
                remove.mutateAsync(row.original.id).then(
                  () => toast.success(`Đã gỡ ${row.original.fullName} khỏi phòng ban`),
                  (err) => toast.error(messageFor(err)),
                )
              }
              deleteLabel="Gỡ khỏi phòng ban"
              itemName={`nhân viên ${row.original.fullName}`}
              deleteDescription="Nhân viên vẫn còn tài khoản và team, chỉ không còn thuộc phòng ban này."
            />
          ) : null,
      },
    ],
    [canUpdate, department.managerId, remove],
  );

  return (
    <div className="space-y-3">
      <section className="rounded-md border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {department.name}{' '}
            {department.isActive ? null : <StatusBadge tone="neutral">Ngừng hoạt động</StatusBadge>}
          </h2>
          <Can I="update" a="User">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil aria-hidden />
              Sửa
            </Button>
          </Can>
        </div>
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Mã</dt>
            <dd className="font-mono">{department.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Thuộc phòng ban</dt>
            <dd>{parent?.name ?? '— Cấp cao nhất —'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Trưởng phòng</dt>
            <dd>{managerName ?? (department.managerId ? '…' : 'Chưa có')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nhân viên</dt>
            <dd className="tabular-nums">{department._count.members}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">
            Nhân viên{' '}
            <span className="font-normal text-muted-foreground">
              · {members.data?.total ?? department._count.members}
            </span>
          </h2>
          <Can I="update" a="User">
            <Button size="sm" onClick={onAddMembers}>
              <Plus aria-hidden />
              Thêm thành viên
            </Button>
          </Can>
        </div>
        <div className="space-y-2 p-3">
          <FilterBar
            q={state.q}
            onQChange={(q) => set({ q })}
            values={{}}
            onFilterChange={() => undefined}
            searchPlaceholder="Tìm theo mã, tên, email…"
          />
          <QueryState
            query={members}
            skeleton={<ListSkeleton rows={6} columns={6} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                className="min-h-40"
                title={state.q ? 'Không có nhân viên khớp' : 'Chưa có nhân viên trong phòng ban'}
                description={
                  state.q
                    ? 'Thử từ khóa khác.'
                    : 'Chuyển nhân viên vào đây từ panel Thêm thành viên.'
                }
                action={
                  state.q ? undefined : (
                    <Can I="update" a="User">
                      <Button variant="outline" size="sm" onClick={onAddMembers}>
                        Thêm thành viên
                      </Button>
                    </Can>
                  )
                }
              />
            }
          >
            {(d) => (
              <DataTable
                columns={columns}
                rows={d.items}
                getRowId={(r) => r.id}
                total={d.total}
                page={state.page}
                size={state.size}
                sort={state.sort}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={(sort) => set({ sort })}
              />
            )}
          </QueryState>
        </div>
      </section>
    </div>
  );
}

/** Tìm nhân viên ngoài phòng ban này rồi chuyển vào — PUT từng người, báo kết quả gộp. */
function AddMembersPanel({ department, onClose }: { department: Department; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const assign = useAssignUserToDepartment();
  const search = useUsers({
    q,
    take: 20,
    skip: 0,
    isActive: true,
    sortBy: 'fullName',
    sortDir: 'asc',
  });
  const candidates = (search.data?.items ?? []).filter((u) => u.departmentId !== department.id);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = async () => {
    const ids = [...picked];
    let ok = 0;
    for (const userId of ids) {
      try {
        await assign.mutateAsync({ departmentId: department.id, userId });
        ok += 1;
      } catch (err) {
        toast.error(messageFor(err));
      }
    }
    if (ok > 0) toast.success(`Đã thêm ${ok} thành viên vào ${department.name}`);
    if (ok === ids.length) onClose();
    else setPicked(new Set(ids.filter((id) => !picked.has(id))));
  };

  const moving = candidates.filter((u) => picked.has(u.id) && u.departmentId);

  return (
    <aside
      className="rounded-md border bg-card"
      aria-label={`Thêm thành viên vào ${department.name}`}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Thêm thành viên vào {department.name}</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Đóng" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="space-y-3 p-3">
        <div className="space-y-1">
          <label htmlFor="dept-member-search" className="text-xs text-muted-foreground">
            Tìm nhân viên
          </label>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="dept-member-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-8"
              placeholder="mã, tên, email…"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Chỉ hiện nhân viên đang hoạt động, chưa thuộc phòng ban này
          </p>
        </div>
        <div className="max-h-80 overflow-auto rounded-md border">
          {search.isPending ? (
            <ListSkeleton rows={4} columns={2} className="p-2" />
          ) : search.error ? (
            <p className="p-3 text-sm text-destructive">{messageFor(search.error)}</p>
          ) : candidates.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Không có nhân viên nào phù hợp.</p>
          ) : (
            <ul className="divide-y">
              {candidates.map((u) => (
                <li key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                  <Checkbox
                    checked={picked.has(u.id)}
                    onCheckedChange={(v) => toggle(u.id, v === true)}
                    aria-label={`Chọn ${u.fullName}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.fullName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{u.code}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{u.departmentName ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {moving.length > 0 ? (
          <p className="rounded-md border bg-warning/10 px-3 py-2 text-xs text-warning">
            {moving.length === 1
              ? `${moving[0]!.fullName} đang ở ${moving[0]!.departmentName} — chuyển vào đây là rời phòng ban cũ.`
              : `${moving.length} người đang thuộc phòng ban khác — chuyển vào đây là rời phòng ban cũ.`}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={assign.isPending}>
          Hủy bỏ
        </Button>
        <Button
          size="sm"
          disabled={picked.size === 0 || assign.isPending}
          onClick={() => void submit()}
        >
          Thêm {picked.size} thành viên
        </Button>
      </div>
    </aside>
  );
}
