'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useLogout } from '../api/use-logout';
import { SessionProvider, useSession } from './session-provider';

function ShellWithSession({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const logout = useLogout();
  return (
    <AppShell
      user={me ? { code: me.code, roles: me.roles } : undefined}
      onLogout={() => logout.mutate()}
    >
      {children}
    </AppShell>
  );
}

/** Bọc mọi route trong app/(app): tải /auth/me → ability → shell. */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellWithSession>{children}</ShellWithSession>
    </SessionProvider>
  );
}
