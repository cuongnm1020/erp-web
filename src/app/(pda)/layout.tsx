import type { ReactNode } from 'react';
import { SessionProvider } from '@/features/auth';

export const dynamic = 'force-dynamic';

/**
 * Route group cho trình duyệt trên máy PDA (PLAN-barcode-pick-pack D2): cùng phiên / ability
 * như (app) nhưng KHÔNG có sidebar, header, palette — màn hình nhỏ, một tay. Middleware đã
 * chặn khi thiếu cookie; quyền kiểm ngay trong màn (task.execute).
 */
export default function PdaLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
