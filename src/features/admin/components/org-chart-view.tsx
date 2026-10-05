'use client';

import { FolderPlus, Pencil, Trash2, UserPlus, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { EmptyState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useDeleteDepartment, useDepartments } from '../api/use-departments';
import type { OrgDepartmentNode, OrgEmployee, OrgTree } from '../api/use-org-tree';
import { useUpdateUser, useUsers } from '../api/use-users';
import { DepartmentDialog } from './department-dialog';
import { OrgChart, pathTo } from './org-chart';
import { OrgStaffDialog } from './org-staff-dialog';
import { UserCreateDialog } from './user-create-dialog';

/**
 * Sơ đồ nhân sự — mỗi ô một phòng ban (số người cộng dồn, trưởng phòng), bấm ô để xem / quản lý
 * nhân sự của phòng ban đó ở cột phải.
 *
 * Ai làm được gì do server quyết (StaffAccessService), web chỉ ẩn nút theo cờ server trả:
 * - "Thêm nhân sự": `canAddMembers` (có user.create hoặc là trưởng phòng / phòng cha).
 * - "Sửa" / "Xóa" nhân sự: `canManage` (chỉ tài khoản do mình tạo; superadmin mọi người).
 *   Xóa = khóa tài khoản + ẩn khỏi sơ đồ — lịch sử thao tác vẫn giữ tên người đó.
 * - Thêm / sửa / xóa phòng ban: quyền user.update (CASL `update` `User`).
 */
export function OrgChartView({
  data,
  selectedId,
  onSelect,
}: {
  data: OrgTree;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const path = selectedId ? pathTo(data.departments, selectedId) : [];
  const selected = path.at(-1) ?? null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        aria-label="Sơ đồ nhân sự"
        className="max-h-[calc(100vh-12rem)] overflow-auto rounded-md border bg-card"
      >
        {data.departments.length === 0 ? (
          <EmptyState
            title="Chưa có phòng ban nào"
            description="Tạo phòng ban gốc (tên công ty) rồi thêm các khối, bộ phận bên dưới."
            action={
              <Can I="update" a="User">
                <NewDepartmentButton />
              </Can>
            }
          />
        ) : (
          <OrgChart
            roots={data.departments}
            selectedId={selectedId}
            onSelect={(n) => onSelect(n.id === selectedId ? null : n.id)}
            collapsed={collapsed}
            onToggle={toggle}
          />
        )}
      </section>
      <aside className="rounded-md border bg-card p-3 xl:max-h-[calc(100vh-12rem)] xl:overflow-auto">
        {selected ? (
          <DepartmentPanel
            key={selected.id}
            node={selected}
            path={path.slice(0, -1)}
            tree={data}
            onDeleted={() => onSelect(path.at(-2)?.id ?? null)}
          />
        ) : (
          <SummaryPanel data={data} />
        )}
      </aside>
    </div>
  );
}

function NewDepartmentButton({ parentId }: { parentId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={parentId ? 'outline' : 'default'} onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden />
        {parentId ? 'Thêm phòng ban con' : 'Thêm phòng ban'}
      </Button>
      {open ? <AdminDepartmentDialog parentId={parentId} onOpenChange={setOpen} /> : null}
    </>
  );
}

/**
 * DepartmentDialog cần danh sách phòng ban + nhân viên (chọn cha / trưởng phòng) — chỉ tải khi
 * người có user.update mở dialog (trưởng phòng thường không có user.read).
 */
function AdminDepartmentDialog({
  departmentId,
  parentId,
  onOpenChange,
}: {
  departmentId?: string;
  parentId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const departments = useDepartments();
  const users = useUsers({
    isActive: true,
    sortBy: 'fullName',
    sortDir: 'asc',
    take: 200,
    skip: 0,
  });
  if (!departments.data || !users.data) return null;
  const department = departmentId ? departments.data.find((d) => d.id === departmentId) : undefined;
  return (
    <DepartmentDialog
      open
      onOpenChange={onOpenChange}
      departments={departments.data}
      users={users.data.items}
      department={department}
      defaultParentId={parentId}
    />
  );
}

function DepartmentPanel({
  node,
  path,
  tree,
  onDeleted,
}: {
  node: OrgDepartmentNode;
  path: OrgDepartmentNode[];
  tree: OrgTree;
  onDeleted: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingDept, setEditingDept] = useState(false);
  const [deletingDept, setDeletingDept] = useState(false);
  const remove = useDeleteDepartment();

  return (
    <div className="space-y-3">
      <div>
        {path.length ? (
          <p className="text-xs text-muted-foreground">{path.map((p) => p.name).join(' › ')}</p>
        ) : null}
        <h2 className="text-lg font-semibold">
          {node.name}
          {node.isActive ? null : (
            <StatusBadge tone="neutral" className="ml-2 align-middle">
              Ngừng hoạt động
            </StatusBadge>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{node.code}</span> · {node.memberCount} người
          {node.children.length ? ` (gồm ${node.children.length} phòng ban con)` : ''}
        </p>
        <p className="text-sm">
          Trưởng phòng: {node.managerName ?? <span className="text-muted-foreground">Chưa có</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {node.canAddMembers ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden />
            Thêm nhân sự
          </Button>
        ) : null}
        <Can I="update" a="User">
          <Button size="sm" variant="outline" onClick={() => setEditingDept(true)}>
            <Pencil aria-hidden />
            Sửa phòng ban
          </Button>
          <NewDepartmentButton parentId={node.id} />
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => setDeletingDept(true)}
          >
            <Trash2 aria-hidden />
            Xóa phòng ban
          </Button>
        </Can>
      </div>

      <MemberList members={node.members} managerId={node.managerId} tree={tree} />

      {adding ? (
        <UserCreateDialog
          open
          onOpenChange={setAdding}
          fixedDepartment={{ id: node.id, name: node.name }}
        />
      ) : null}
      {editingDept ? (
        <AdminDepartmentDialog departmentId={node.id} onOpenChange={setEditingDept} />
      ) : null}
      <ConfirmDialog
        open={deletingDept}
        onOpenChange={setDeletingDept}
        title={`Xóa phòng ban ${node.name}?`}
        description={
          node.children.length || node.members.length
            ? `Phòng ban còn ${node.children.length} phòng ban con và ${node.members.length} nhân sự — chuyển họ đi trước, nếu không sẽ không xóa được.`
            : 'Phòng ban sẽ bị xóa khỏi sơ đồ. Không hoàn tác được.'
        }
        confirmLabel="Xóa phòng ban"
        onConfirm={() =>
          remove.mutateAsync(node.id).then(
            () => {
              toast.success('Đã xóa phòng ban', { description: node.name });
              onDeleted();
            },
            (err: unknown) => toast.error(messageFor(err)),
          )
        }
      />
    </div>
  );
}

function SummaryPanel({ data }: { data: OrgTree }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Toàn công ty</h2>
        <p className="text-sm text-muted-foreground">
          {data.totals.employees} nhân sự · {data.totals.departments} phòng ban. Bấm vào một ô trên
          sơ đồ để xem và thêm nhân sự.
        </p>
      </div>
      {data.unassigned.length ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold">
            Chưa có phòng ban ({data.unassigned.length})
          </h3>
          <MemberList members={data.unassigned} managerId={null} tree={data} />
        </div>
      ) : null}
    </div>
  );
}

function MemberList({
  members,
  managerId,
  tree,
}: {
  members: OrgEmployee[];
  managerId: string | null;
  tree: OrgTree;
}) {
  const ability = useAbility();
  const [editing, setEditing] = useState<OrgEmployee | null>(null);
  const [deleting, setDeleting] = useState<OrgEmployee | null>(null);

  // Phòng ban chuyển tới được = ô có canAddMembers (server tính theo người xem).
  const targets = useMemo(() => {
    const out: { id: string; name: string; path: string }[] = [];
    const walk = (nodes: OrgDepartmentNode[], prefix: string[]) => {
      for (const n of nodes) {
        if (n.canAddMembers && n.isActive)
          out.push({ id: n.id, name: n.name, path: prefix.join(' › ') });
        walk(n.children, [...prefix, n.name]);
      }
    };
    walk(tree.departments, []);
    return out;
  }, [tree.departments]);

  if (members.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có nhân sự trực tiếp trong phòng ban này.
      </p>
    );

  return (
    <>
      <ul className="divide-y rounded-md border" aria-label="Nhân sự">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.fullName}
                {m.id === managerId ? (
                  <StatusBadge tone="brand" className="ml-1.5 align-middle">
                    Trưởng phòng
                  </StatusBadge>
                ) : null}
                {m.isActive ? null : (
                  <StatusBadge tone="neutral" className="ml-1.5 align-middle">
                    Đã khóa
                  </StatusBadge>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{m.code}</span> · {m.email}
              </p>
            </div>
            {m.canManage ? (
              <div className="flex shrink-0 gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`Sửa ${m.fullName}`}
                  onClick={() => setEditing(m)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Button>
                {m.isActive ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    aria-label={`Xóa ${m.fullName}`}
                    onClick={() => setDeleting(m)}
                  >
                    <UserX className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <OrgStaffDialog
          employee={editing}
          departments={targets}
          allowUnassign={ability.can('update', 'User')}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
      {deleting ? <DeleteStaffDialog employee={deleting} onDone={() => setDeleting(null)} /> : null}
    </>
  );
}

/** "Xóa" nhân sự = khóa tài khoản (PATCH isActive=false): user còn trong lịch sử chứng từ / audit. */
function DeleteStaffDialog({ employee, onDone }: { employee: OrgEmployee; onDone: () => void }) {
  const update = useUpdateUser(employee.id);
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onDone()}
      title={`Xóa nhân sự ${employee.fullName}?`}
      description="Tài khoản bị khóa, không đăng nhập được và ẩn khỏi sơ đồ. Lịch sử thao tác của người này vẫn giữ. Mở lại được ở màn Nhân viên."
      confirmLabel="Xóa nhân sự"
      onConfirm={() =>
        update.mutateAsync({ isActive: false }).then(
          () => {
            toast.success('Đã xóa nhân sự', {
              description: `${employee.code} · ${employee.fullName}`,
            });
            onDone();
          },
          (err: unknown) => toast.error(messageFor(err)),
        )
      }
    />
  );
}
