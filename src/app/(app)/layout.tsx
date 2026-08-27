import type { ReactNode } from 'react';
import { AuthenticatedShell } from '@/features/auth';

/** Mọi route đã đăng nhập. Middleware đã chặn khi thiếu cookie. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
