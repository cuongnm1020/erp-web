'use client';

import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import { useImpersonate } from '../api/use-impersonate';

/**
 * Nút "Đăng nhập với tư cách" (2026-10-19) — dùng chung cho Sơ đồ nhân sự + màn Nhân viên.
 * Chỉ superadmin (manage all) thấy; ẩn với tài khoản khoá / superadmin (server cũng chặn).
 * `compact` = nút biểu tượng trên dòng danh sách; mặc định = nút có chữ ở đầu trang.
 */
export function ImpersonateButton({
  user,
  compact = false,
}: {
  user: { id: string; fullName: string; isActive: boolean; isSuperAdmin?: boolean };
  compact?: boolean;
}) {
  const canImpersonate = useAbility().can('manage', 'all');
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
