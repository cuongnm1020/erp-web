'use client';

import { AlertTriangle, Copy, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { isApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { useCreateRole, useDeleteRole, useUpdateRole, type Role } from '../api/use-roles';

const CODE_RE = /^[A-Z0-9_]{2,50}$/;
const NO_PERMS = '__none__';

const usersOfRole = (code: string) => `/admin/users?role=${encodeURIComponent(code)}`;

/**
 * Thêm vai trò (mockup Hộp thoại vai trò): tên, mã (IN HOA, không đổi được), "Bắt đầu với quyền
 * của" một vai trò có sẵn (POST /roles kèm `permissions`), mô tả. `from` = mở từ "Nhân bản".
 */
export function CreateRoleDialog({
  open,
  onOpenChange,
  roles,
  from,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roles: Role[];
  from?: Role | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <CreateRoleForm
          key={from?.code ?? 'new'}
          roles={roles}
          from={from ?? null}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function CreateRoleForm({
  roles,
  from,
  onDone,
}: {
  roles: Role[];
  from: Role | null;
  onDone: () => void;
}) {
  const create = useCreateRole();
  // Sao chép quyền = cấp quyền → chỉ superadmin (API 403 ROLE_PERMISSIONS_SUPERADMIN_ONLY).
  const canCopyPermissions = useAbility().can('edit_permissions', 'Role');
  const [name, setName] = useState(from ? `${from.name} (bản sao)` : '');
  const [code, setCode] = useState('');
  const [source, setSource] = useState(from?.code ?? NO_PERMS);
  const [description, setDescription] = useState(from?.description ?? '');
  const [serverCodeError, setServerCodeError] = useState<string | null>(null);

  const taken = roles.some((r) => r.code === code);
  const codeError = taken ? 'Mã này đã có — chọn mã khác.' : serverCodeError;
  const sourceRole = canCopyPermissions ? (roles.find((r) => r.code === source) ?? null) : null;
  const canSubmit = !create.isPending && name.trim() !== '' && CODE_RE.test(code) && !codeError;

  const submit = () =>
    create.mutate(
      {
        code,
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: sourceRole ? sourceRole.permissions : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Đã tạo vai trò', { description: `${code} · ${name.trim()}` });
          onDone();
        },
        onError: (err) => {
          if (isApiError(err) && err.code === 'UNIQUE_VIOLATION') {
            setServerCodeError('Mã này đã có — chọn mã khác.');
          } else {
            toast.error(messageFor(err));
          }
        },
      },
    );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{from ? `Nhân bản vai trò ${from.name}` : 'Thêm vai trò'}</DialogTitle>
        <DialogDescription>
          Tạo xong, vai trò hiện thành cột mới trong bảng để chỉnh tiếp.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="role-name">Tên hiển thị</Label>
          <Input
            id="role-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="vd: Nhân viên CSKH"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-code">Mã vai trò</Label>
          <Input
            id="role-code"
            value={code}
            className="font-mono"
            aria-invalid={codeError ? true : undefined}
            aria-describedby="role-code-hint"
            onChange={(e) => {
              setServerCodeError(null);
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
            }}
            placeholder="vd: CSKH"
          />
          {codeError ? <p className="text-xs font-semibold text-destructive">{codeError}</p> : null}
          <p id="role-code-hint" className="text-xs text-muted-foreground">
            2–50 ký tự: chữ IN HOA, số, dấu gạch dưới. Không đổi được sau khi tạo.
          </p>
        </div>
        {canCopyPermissions ? (
          <div className="space-y-1">
            <Label htmlFor="role-source">Bắt đầu với quyền của</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="role-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PERMS}>Không có quyền nào</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sao chép quyền để đỡ tick lại từ đầu; sửa được ngay sau đó.
            </p>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="role-desc">
            Mô tả <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          </Label>
          <Textarea
            id="role-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone} disabled={create.isPending}>
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            loading={create.isPending}
            loadingText="Đang tạo…"
          >
            Tạo vai trò
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa vai trò {role.name}</DialogTitle>
          <DialogDescription>
            Mã <span className="font-mono">{role.code}</span> không đổi được. Quyền sửa trên bảng.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-role-name">Tên hiển thị</Label>
            <Input
              id="edit-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-role-desc">
              Mô tả <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
            </Label>
            <Textarea
              id="edit-role-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={update.isPending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={!name.trim()}
            loading={update.isPending}
            loadingText="Đang lưu…"
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

/** Vai trò còn người giữ: không gọi DELETE (sẽ 409 ROLE_IN_USE) — nói rõ phải gỡ khỏi ai trước. */
function DeleteBlockedDialog({
  role,
  onOpenChange,
}: {
  role: Role;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning-weak text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <DialogHeader>
            <DialogTitle>Chưa xóa được vai trò {role.name}</DialogTitle>
            <DialogDescription>
              Vai trò còn nhân viên đang giữ. Gỡ vai trò này khỏi họ (hoặc đổi sang vai trò khác)
              rồi quay lại xóa.
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button asChild>
            <Link href={usersOfRole(role.code)}>Xem nhân viên</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nút "⋯" cạnh tên cột vai trò: sửa tên & mô tả, nhân bản thành vai trò mới, xem nhân viên đang
 * giữ, xóa (cuối, sau vạch chia). Còn người giữ → hộp chặn thay vì xác nhận.
 */
export function RoleMenu({ role, onClone }: { role: Role; onClone: (r: Role) => void }) {
  const remove = useDeleteRole();
  const canClone = useAbility().can('edit_permissions', 'Role');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Mục mở hộp thoại: không trả focus về nút "⋯" khi menu đóng, để hộp thoại giữ focus ô đầu.
  const toDialog = useRef(false);
  const openDialog = (fn: () => void) => () => {
    toDialog.current = true;
    fn();
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
            aria-label={`Thao tác vai trò ${role.name}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-64"
          onCloseAutoFocus={(e) => {
            if (toDialog.current) e.preventDefault();
            toDialog.current = false;
          }}
        >
          <DropdownMenuItem onSelect={openDialog(() => setEditing(true))}>
            <Pencil aria-hidden />
            Sửa tên & mô tả
          </DropdownMenuItem>
          {canClone ? (
            <DropdownMenuItem onSelect={openDialog(() => onClone(role))}>
              <Copy aria-hidden />
              Nhân bản thành vai trò mới
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={usersOfRole(role.code)}>
              <Users aria-hidden />
              Xem nhân viên đang giữ
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={openDialog(() => setDeleting(true))}>
            <Trash2 aria-hidden />
            Xóa vai trò…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? <EditRoleDialog role={role} onOpenChange={setEditing} /> : null}
      {deleting && role.memberCount > 0 ? (
        <DeleteBlockedDialog role={role} onOpenChange={setDeleting} />
      ) : (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`Xóa vai trò ${role.name}?`}
          description="Chưa ai giữ vai trò này. Xóa rồi không hoàn tác được."
          confirmLabel="Xóa vai trò"
          onConfirm={() =>
            remove.mutateAsync(role.code).then(
              () => toast.success('Đã xóa vai trò', { description: role.code }),
              (err: unknown) => toast.error(messageFor(err)),
            )
          }
        />
      )}
    </>
  );
}

/** Một vai trò bị đổi trong bản nháp ma trận — nhãn quyền thêm / bớt và số quyền sau khi lưu. */
export interface RoleChange {
  role: Role;
  added: string[];
  removed: string[];
  after: number;
}

/** Một vai trò thêm / bớt từ chừng này quyền trở lên là thay đổi lớn. */
const BIG_CHANGE = 10;
/** Đổi cùng lúc nhiều hơn chừng này vai trò là thay đổi lớn. */
const MANY_ROLES = 3;
const CONFIRM_WORD = 'XAC NHAN';
const PREVIEW = 6;

const preview = (labels: string[]) =>
  labels.length > PREVIEW
    ? `${labels.slice(0, PREVIEW).join(', ')} và ${labels.length - PREVIEW} quyền khác`
    : labels.join(', ');

/** Cảnh báo của một vai trò: mất hết quyền / có toàn bộ quyền / đổi nhiều quyền. */
function riskOf(c: RoleChange, total: number): string | null {
  if (c.after === 0) return 'Mất hết quyền';
  if (c.after === total) return 'Có toàn bộ quyền';
  if (c.added.length + c.removed.length >= BIG_CHANGE) return 'Đổi nhiều quyền';
  return null;
}

/**
 * Xác nhận trước khi lưu ma trận quyền (sau sự cố 2026-10-31: tick đủ quyền cho mọi vai trò rồi
 * lưu, một giờ sau bỏ hết về 0). Liệt kê từng vai trò thêm / bớt gì; thay đổi lớn (vai trò về 0
 * quyền, có toàn bộ quyền, đổi ≥ 10 quyền, hoặc > 3 vai trò cùng lúc) phải gõ chữ xác nhận.
 */
export function SavePermissionsDialog({
  open,
  onOpenChange,
  changes,
  total,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  changes: RoleChange[];
  total: number;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SavePermissionsForm
          changes={changes}
          total={total}
          onConfirm={onConfirm}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function SavePermissionsForm({
  changes,
  total,
  onConfirm,
  onDone,
}: {
  changes: RoleChange[];
  total: number;
  onConfirm: () => Promise<void>;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const risky = changes.length > MANY_ROLES || changes.some((c) => riskOf(c, total) !== null);
  const canSubmit = !pending && (!risky || typed.trim().toUpperCase() === CONFIRM_WORD);

  const submit = async () => {
    setPending(true);
    try {
      await onConfirm();
      onDone();
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogContent wide onInteractOutside={(e) => pending && e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Lưu quyền của {changes.length} vai trò?</DialogTitle>
        <DialogDescription>
          Nhân viên mang các vai trò này nhận quyền mới ngay ở thao tác kế tiếp.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
      >
        <ul className="divide-y rounded-md border">
          {changes.map((c) => {
            const risk = riskOf(c, total);
            return (
              <li key={c.role.code} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.role.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.role.code}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    còn {c.after}/{total} quyền
                  </span>
                  {risk ? (
                    <StatusBadge tone={c.after === 0 ? 'err' : 'warn'}>{risk}</StatusBadge>
                  ) : null}
                </div>
                {c.added.length > 0 ? (
                  <p className="text-xs">
                    <span className="font-semibold text-success">+{c.added.length} </span>
                    {preview(c.added)}
                  </p>
                ) : null}
                {c.removed.length > 0 ? (
                  <p className="text-xs">
                    <span className="font-semibold text-destructive">−{c.removed.length} </span>
                    {preview(c.removed)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {risky ? (
          <div className="space-y-1">
            <Label htmlFor="confirm-perms">
              Thay đổi lớn — gõ <span className="font-mono">{CONFIRM_WORD}</span> để lưu
            </Label>
            <Input
              id="confirm-perms"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onDone} disabled={pending}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant={risky ? 'destructive' : 'default'}
            disabled={!canSubmit}
            loading={pending}
            loadingText="Đang lưu…"
          >
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
