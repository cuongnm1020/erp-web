'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { cn } from '@/lib/cn';
import { usePermissions, type Permission } from '../api/use-permissions';
import { useCreateRole, useDeleteRole, useUpdateRole, type Role } from '../api/use-roles';
import { actionLabel, moduleLabel } from '../labels';
import { useRoles } from '../api/use-roles';

/** key ô = `${roleCode}:${permissionCode}` */
const cellKey = (role: string, perm: string) => `${role}:${perm}`;

function CreateRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateRole();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Thêm vai trò</DialogTitle>
          <DialogDescription>Tạo xong, tick quyền cho vai trò ngay trên ma trận.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Mã vai trò (IN_HOA_GACH_DUOI)
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="vd: CSKH"
            />
          </label>
          <label className="block text-sm">
            Tên hiển thị
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Chăm sóc khách hàng"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={create.isPending || !/^[A-Z0-9_]{2,50}$/.test(code) || !name.trim()}
            onClick={() =>
              create.mutate(
                { code, name: name.trim() },
                {
                  onSuccess: () => {
                    toast.success('Đã tạo vai trò', { description: code });
                    setCode('');
                    setName('');
                    onOpenChange(false);
                  },
                  onError: (err) => toast.error(messageFor(err)),
                },
              )
            }
          >
            {create.isPending ? 'Đang tạo…' : 'Tạo vai trò'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sửa tên / mô tả vai trò — PUT /roles/:code không kèm `permissions` (giữ nguyên quyền). */
function EditRoleDialog({
  role,
  onOpenChange,
}: {
  role: Role;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateRole();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  return (
    <Dialog open onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sửa vai trò {role.code}</DialogTitle>
          <DialogDescription>Mã vai trò không đổi được. Quyền sửa trên ma trận.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Tên hiển thị
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            Mô tả
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={update.isPending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={update.isPending || !name.trim()}
            onClick={() =>
              update.mutate(
                {
                  code: role.code,
                  name: name.trim(),
                  description: description.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    toast.success('Đã lưu thay đổi', {
                      description: `${role.code} · ${name.trim()}`,
                    });
                    onOpenChange(false);
                  },
                  onError: (err) => toast.error(messageFor(err)),
                },
              )
            }
          >
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Menu trên đầu cột vai trò: sửa tên / mô tả, xóa (409 ROLE_IN_USE nếu còn người giữ). */
function RoleMenu({ role }: { role: Role }) {
  const remove = useDeleteRole();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`Thao tác vai trò ${role.name}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil aria-hidden />
            Sửa vai trò
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            Xóa vai trò
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? <EditRoleDialog role={role} onOpenChange={setEditing} /> : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Xóa vai trò ${role.name}?`}
        description={
          role.memberCount > 0
            ? `Vai trò đang gán cho ${role.memberCount} người — gỡ vai trò khỏi họ ở màn Nhân viên trước, nếu không sẽ không xóa được.`
            : 'Vai trò và các quyền đã tick sẽ bị xóa. Không hoàn tác được.'
        }
        confirmLabel="Xóa vai trò"
        onConfirm={() =>
          remove.mutateAsync(role.code).then(
            () => toast.success('Đã xóa vai trò', { description: role.code }),
            (err: unknown) => toast.error(messageFor(err)),
          )
        }
      />
    </>
  );
}

/**
 * I-03 Ma trận vai trò × quyền — GET /roles + GET /permissions, lưu PUT /roles/:code
 * (thay toàn bộ danh sách permission của từng role có thay đổi). Đầu cột có menu sửa / xóa vai trò.
 */
export function RolesScreen() {
  const roles = useRoles();
  const permissions = usePermissions();
  const update = useUpdateRole();
  const ability = useAbility();
  const canEdit = ability.can('update', 'Role');

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirtyCount = Object.keys(draft).length;

  const checked = (role: Role, perm: Permission): boolean => {
    const d = draft[cellKey(role.code, perm.code)];
    return d !== undefined ? d : role.permissions.includes(perm.code);
  };

  const toggle = (role: Role, perm: Permission) => {
    const key = cellKey(role.code, perm.code);
    const server = role.permissions.includes(perm.code);
    setDraft((d) => {
      const next = { ...d };
      const cur = d[key] !== undefined ? d[key] : server;
      if (!cur === server) delete next[key];
      else next[key] = !cur;
      return next;
    });
  };

  const onSave = async () => {
    const list = roles.data ?? [];
    const changedRoles = list.filter((r) =>
      Object.keys(draft).some((k) => k.startsWith(`${r.code}:`)),
    );
    setSaving(true);
    try {
      for (const r of changedRoles) {
        const perms = (permissions.data ?? []).filter((p) => checked(r, p)).map((p) => p.code);
        await update.mutateAsync({ code: r.code, permissions: perms });
      }
      setDraft({});
      toast.success('Đã lưu thay đổi', {
        description: `${changedRoles.length} vai trò — quyền có hiệu lực ngay.`,
      });
    } catch (err) {
      toast.error(messageFor(err));
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permissions.data ?? []) {
      groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    }
    return [...groups.entries()];
  }, [permissions.data]);

  return (
    <>
      <PageHeader
        title="Vai trò & quyền"
        description="Nhấn ô để bật/tắt quyền của vai trò · Lưu là một lần cho toàn ma trận"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Vai trò & quyền' }]}
        actions={
          <>
            {dirtyCount > 0 ? (
              <StatusBadge tone="warn">{dirtyCount} thay đổi chưa lưu</StatusBadge>
            ) : null}
            <Can I="update" a="Role">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                Thêm vai trò
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={dirtyCount === 0 || saving}
                onClick={() => setDraft({})}
              >
                Hoàn tác
              </Button>
              <Button size="sm" disabled={dirtyCount === 0 || saving} onClick={onSave}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </Can>
          </>
        }
      />

      <QueryState
        query={roles}
        skeleton={<Skeleton className="h-96 w-full" />}
        isEmpty={(d) => d.length === 0}
        empty={<p className="p-4 text-sm text-muted-foreground">Chưa có vai trò nào.</p>}
      >
        {(roleList) => (
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="min-w-64 px-2.5">Quyền</TableHead>
                  {roleList.map((r) => (
                    <TableHead key={r.code} className="px-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="font-semibold">{r.name}</span>
                        <Can I="update" a="Role">
                          <RoleMenu role={r} />
                        </Can>
                      </div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {r.memberCount} người
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([module, perms]) => (
                  <Fragment key={module}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell
                        colSpan={roleList.length + 1}
                        className="px-2.5 py-1 text-xs font-semibold"
                      >
                        {moduleLabel(module)}
                      </TableCell>
                    </TableRow>
                    {perms.map((p) => (
                      <TableRow key={p.code}>
                        <TableCell className="px-2.5 py-1.5">
                          {actionLabel(p.action)}{' '}
                          <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                        </TableCell>
                        {roleList.map((r) => {
                          const key = cellKey(r.code, p.code);
                          const dirty = draft[key] !== undefined;
                          return (
                            <TableCell
                              key={r.code}
                              className={cn('px-2.5 py-1.5 text-center', dirty && 'bg-warning/10')}
                            >
                              <Checkbox
                                checked={checked(r, p)}
                                disabled={!canEdit}
                                onCheckedChange={() => toggle(r, p)}
                                aria-label={`${r.name} · ${actionLabel(p.action)} ${moduleLabel(p.module)}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
