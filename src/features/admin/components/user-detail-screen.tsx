'use client';

import { useEffect, useState } from 'react';
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
import { formatDate, formatDateTime } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useRoles } from '../api/use-roles';
import { useAssignRoles, useUpdateUser, useUser, type UserDetail } from '../api/use-users';
import { UserPermissionMatrix } from './user-permission-matrix';

const TEAM_ROLE: Record<'LEADER' | 'MEMBER', { label: string; tone: 'brand' | 'neutral' }> = {
  LEADER: { label: 'Leader', tone: 'brand' },
  MEMBER: { label: 'Thành viên', tone: 'neutral' },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

/** Khối Vai trò: checkbox theo danh sách role thật, lưu qua PUT /users/:id/roles (thay hết). */
function RolesSection({ user, canEdit }: { user: UserDetail; canEdit: boolean }) {
  const roles = useRoles();
  const assign = useAssignRoles(user.id);
  const serverCodes = user.roles.map((r) => r.code).sort();
  const [selected, setSelected] = useState<string[]>(serverCodes);
  useEffect(() => setSelected(serverCodes), [serverCodes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = selected.slice().sort().join(',') !== serverCodes.join(',');

  return (
    <section className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Vai trò</h2>
        {canEdit && dirty ? (
          <Button
            size="sm"
            disabled={assign.isPending}
            onClick={() =>
              assign.mutate(selected, {
                onSuccess: () => toast.success('Đã lưu vai trò'),
                onError: (err) => toast.error(messageFor(err)),
              })
            }
          >
            {assign.isPending ? 'Đang lưu…' : 'Lưu vai trò'}
          </Button>
        ) : null}
      </div>
      {user.isSuperAdmin ? (
        <p className="text-sm text-muted-foreground">
          <StatusBadge tone="brand">Superadmin</StatusBadge> — toàn quyền, không cần vai trò.
        </p>
      ) : (
        <div className="space-y-1.5">
          {(roles.data ?? []).map((r) => (
            <label key={r.code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(r.code)}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setSelected((s) => (v === true ? [...s, r.code] : s.filter((c) => c !== r.code)))
                }
                aria-label={r.name}
              />
              <span>{r.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
            </label>
          ))}
          {roles.isError ? (
            <p className="text-xs text-muted-foreground">
              Không tải được danh sách vai trò — cần quyền role.read.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Sửa thông tin + đặt lại mật khẩu (PATCH /users/:id). */
function EditDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateUser(user.id);
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  useEffect(() => {
    if (open) {
      setFullName(user.fullName);
      setEmail(user.email);
      setPassword('');
    }
  }, [open, user.fullName, user.email]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sửa thông tin</DialogTitle>
          <DialogDescription>{user.code}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Họ tên
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block text-sm">
            Email
            <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm">
            Mật khẩu mới (bỏ trống nếu không đổi)
            <Input
              value={password}
              type="password"
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={update.isPending || !fullName.trim() || !email.trim()}
            onClick={() =>
              update.mutate(
                {
                  fullName: fullName.trim(),
                  email: email.trim(),
                  ...(password ? { password } : {}),
                },
                {
                  onSuccess: () => {
                    toast.success('Đã lưu thay đổi');
                    onOpenChange(false);
                  },
                  onError: (err) => toast.error(messageFor(err)),
                },
              )
            }
          >
            {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * I-04 Chi tiết nhân viên — GET /users/:id + ma trận quyền (I-05).
 * PDA liên kết / lịch sử đăng nhập của mockup chưa có endpoint — không dựng số liệu giả.
 */
export function UserDetailScreen({ id }: { id: string }) {
  const query = useUser(id);
  const update = useUpdateUser(id);
  const ability = useAbility();
  const [editOpen, setEditOpen] = useState(false);

  const canEditUser = ability.can('update', 'User');
  const canEditPerms = canEditUser && ability.can('update', 'Role');

  return (
    <QueryState
      query={query}
      skeleton={<Skeleton className="h-96 w-full" />}
      isEmpty={() => false}
      empty={null}
    >
      {(user) => (
        <>
          <PageHeader
            title={user.fullName}
            description={`${user.code} · ${user.email} · Tạo ${formatDate(user.createdAt)}`}
            breadcrumb={[
              { label: 'Quản trị' },
              { label: 'Nhân viên', href: '/admin/users' },
              { label: user.code },
            ]}
            actions={
              <Can I="update" a="User">
                {user.isActive ? (
                  <Button
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { isActive: false },
                        {
                          onSuccess: () => toast.success('Đã khóa tài khoản'),
                          onError: (err) => toast.error(messageFor(err)),
                        },
                      )
                    }
                  >
                    Khóa tài khoản
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { isActive: true },
                        {
                          onSuccess: () => toast.success('Đã mở khóa tài khoản'),
                          onError: (err) => toast.error(messageFor(err)),
                        },
                      )
                    }
                  >
                    Mở khóa
                  </Button>
                )}
                <Button onClick={() => setEditOpen(true)}>Sửa thông tin</Button>
              </Can>
            }
          />

          <div className="mb-3 grid gap-3 lg:grid-cols-3">
            <section className="rounded-md border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                Thông tin
                {user.isActive ? (
                  <StatusBadge tone="ok">Hoạt động</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Đã khóa</StatusBadge>
                )}
              </h2>
              <dl>
                <InfoRow label="Mã NV" value={<span className="font-mono">{user.code}</span>} />
                <InfoRow label="Họ tên" value={user.fullName} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Phòng ban" value={user.department?.name ?? '—'} />
                <InfoRow label="Tạo lúc" value={formatDateTime(user.createdAt)} />
                <InfoRow label="Cập nhật" value={formatDateTime(user.updatedAt)} />
              </dl>
            </section>

            <RolesSection user={user} canEdit={canEditPerms} />

            <section className="rounded-md border bg-card p-3">
              <h2 className="mb-2 text-sm font-semibold">Team</h2>
              {user.teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa thuộc team nào. Quản lý team ở màn Phòng ban &amp; team.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2">Team</TableHead>
                      <TableHead className="px-2">Vai trò</TableHead>
                      <TableHead className="px-2">Từ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.teams.map((tm) => {
                      const r = TEAM_ROLE[tm.role];
                      return (
                        <TableRow key={tm.teamId}>
                          <TableCell className="px-2 py-1.5">{tm.teamName}</TableCell>
                          <TableCell className="px-2 py-1.5">
                            <StatusBadge tone={r.tone}>{r.label}</StatusBadge>
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-muted-foreground">
                            {formatDate(tm.joinedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Phân quyền</h2>
            <UserPermissionMatrix userId={user.id} canEdit={canEditPerms} />
          </section>

          <EditDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
        </>
      )}
    </QueryState>
  );
}
