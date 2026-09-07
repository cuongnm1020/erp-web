import type { ReactNode } from 'react';
import { AuthenticatedShell } from '@/features/auth';

/**
 * Mọi màn trong shell là Client Component + TanStack Query đọc URL (useSearchParams) — không có
 * gì để prerender tĩnh, và `next build` sẽ fail "missing Suspense with CSR bailout" nếu cố.
 * Render động cho cả segment (luật 14: dữ liệu chỉ từ client).
 */
export const dynamic = 'force-dynamic';

/** Mọi route đã đăng nhập. Middleware đã chặn khi thiếu cookie. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
