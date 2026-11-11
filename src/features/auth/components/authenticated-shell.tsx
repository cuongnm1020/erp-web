'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useLogout } from '../api/use-logout';
import { useStopImpersonation } from '../api/use-stop-impersonation';
import { PasswordChangeGate } from './password-change-gate';
import { RouteAbilityGate } from './route-ability-gate';
import { SessionProvider, useSession } from './session-provider';

function ShellWithSession({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const logout = useLogout();
  const stopImpersonation = useStopImpersonation();
  // Không còn tự đăng xuất khi không thao tác (2026-11-12, user chốt) — phiên giữ tới khi bấm
  // Đăng xuất hoặc refresh token hết hạn (7 ngày không mở web).
  return (
    <AppShell
      user={me ? { code: me.code, roles: me.roles } : undefined}
      onLogout={() => logout.mutate()}
      impersonation={
        me?.impersonator
          ? {
              by: me.impersonator.fullName,
              stopping: stopImpersonation.isPending,
              onStop: () => stopImpersonation.mutate(),
            }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}

/**
 * Bọc mọi route trong app/(app): tải /auth/me → ability → shell → bắt đổi mật khẩu lần đầu → gate
 * quyền theo route.
 */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellWithSession>
        <PasswordChangeGate>
          <RouteAbilityGate>{children}</RouteAbilityGate>
        </PasswordChangeGate>
      </ShellWithSession>
    </SessionProvider>
  );
}
