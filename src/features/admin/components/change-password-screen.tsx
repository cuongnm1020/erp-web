'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { meKeys } from '@/lib/auth/me-keys';
import { PasswordForm } from './password-form';

/**
 * Đổi mật khẩu lần đầu (2026-10-20): tài khoản do quản trị tạo / đặt lại mật khẩu phải đổi trước
 * khi dùng hệ thống — mọi API khác đang trả 403 AUTH_PASSWORD_CHANGE_REQUIRED, PasswordChangeGate
 * (features/auth) đưa người dùng về đây. Đổi xong → tải lại /auth/me (cờ về false) → về Tổng quan.
 */
export function ChangePasswordScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const onChanged = () => {
    void qc.invalidateQueries({ queryKey: meKeys.me }).then(() => router.replace('/'));
  };
  return (
    <div className="mx-auto max-w-md py-6">
      <section className="rounded-md border bg-card">
        <div className="space-y-1 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">Đổi mật khẩu trước khi bắt đầu</h1>
          <p className="text-xs text-muted-foreground">
            Mật khẩu hiện tại do quản trị cấp. Đặt mật khẩu riêng của bạn để tiếp tục vào hệ thống.
          </p>
        </div>
        <div className="p-3">
          <PasswordForm onChanged={onChanged} />
        </div>
      </section>
    </div>
  );
}
