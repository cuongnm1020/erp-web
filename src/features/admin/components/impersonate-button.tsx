'use client';

import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { useImpersonate } from '../api/use-impersonate';

/**
 * Nút "Đăng nhập với tư cách" (2026-10-19) — dùng chung cho Sơ đồ nhân sự, màn Nhân viên, Nhân viên
 * của team. Superadmin (manage all) thấy ở mọi người; từ 2026-10-30 người có vai trò "Đăng nhập thay
 * nhân viên" (`user.impersonate`) thấy ở dòng mình quản lý (`canManage` do server tính) — người quản
 * trị (thêm `role.update`) thấy ở mọi người. Server kiểm
 * lại (kể cả nhân viên có quyền vượt mình → lỗi). Ẩn với tài khoản khoá / superadmin.
 * `compact` = nút biểu tượng trên dòng danh sách; mặc định = nút có chữ ở đầu trang.
 */
export function ImpersonateButton({
  user,
  compact = false,
}: {
  user: {
    id: string;
    fullName: string;
    isActive: boolean;
    isSuperAdmin?: boolean;
    canManage?: boolean;
  };
  compact?: boolean;
}) {
  const ability = useAbility();
  // Người quản trị (sửa được vai trò & quyền) có vai trò này: mọi tài khoản — như server.
  const canImpersonate =
    ability.can('manage', 'all') ||
    (ability.can('impersonate', 'User') && (!!user.canManage || ability.can('update', 'Role')));
  const impersonate = useImpersonate();
  if (!canImpersonate || !user.isActive || user.isSuperAdmin) return null;

  const run = () => impersonate.mutate(user.id, { onError: (err) => toast.error(messageFor(err)) });

  return compact ? (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      aria-label={`Đăng nhập với tư cách ${user.fullName}`}
      title="Đăng nhập với tư cách người này"
      disabled={impersonate.isPending}
      onClick={(e) => {
        e.stopPropagation();
        run();
      }}
    >
      <LogIn className="h-3.5 w-3.5" aria-hidden />
    </Button>
  ) : (
    <Button variant="outline" disabled={impersonate.isPending} onClick={run}>
      <LogIn aria-hidden />
      {impersonate.isPending ? 'Đang chuyển…' : 'Đăng nhập với tư cách'}
    </Button>
  );
}
