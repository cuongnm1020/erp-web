'use client';

import { useCallback, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { IDLE_LOGOUT_REASON } from '@/lib/auth/idle';
import { useLogout } from '../api/use-logout';
import { useIdleLogout } from '../use-idle-logout';
import { RouteAbilityGate } from './route-ability-gate';
import { SessionProvider, useSession } from './session-provider';

function ShellWithSession({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const logout = useLogout();
  const { mutate } = logout;
  // 30 phút không thao tác → đăng xuất, đăng nhập lại quay về đúng trang.
  useIdleLogout(useCallback(() => mutate({ reason: IDLE_LOGOUT_REASON }), [mutate]));
  return (
    <AppShell
      user={me ? { code: me.code, roles: me.roles } : undefined}
      onLogout={() => logout.mutate()}
    >
      {children}
    </AppShell>
  );
}

/** Bọc mọi route trong app/(app): tải /auth/me → ability → shell → gate quyền theo route. */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellWithSession>
        <RouteAbilityGate>{children}</RouteAbilityGate>
      </ShellWithSession>
    </SessionProvider>
  );
}
