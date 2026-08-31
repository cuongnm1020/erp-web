'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ForbiddenState } from '@/components/data/states';
import { requiredAbilityFor } from '@/lib/navigation';
import { useAbility } from '@/lib/permission';
import { useSession } from './session-provider';

/**
 * Gate mở trang theo ability của nav: gõ URL trực tiếp vào route mình không có quyền
 * → màn "Bạn không có quyền" tại chỗ, không đá về đăng nhập (luật 6).
 * Đây là UX (luật 7) — API vẫn là ranh giới bảo mật thật sự.
 */
export function RouteAbilityGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading, error } = useSession();
  const ability = useAbility();

  const required = requiredAbilityFor(pathname);
  if (!required) return <>{children}</>;
  // Đang tải /auth/me: ability còn rỗng — chưa render trang, cũng không nháy màn 403
  if (isLoading) return null;
  // /auth/me lỗi (không phải 401): để màn hình tự hiện lỗi của nó, không kết luận sai về quyền
  if (error) return <>{children}</>;
  if (!ability.can(required.action, required.subject)) return <ForbiddenState className="m-6" />;
  return <>{children}</>;
}
