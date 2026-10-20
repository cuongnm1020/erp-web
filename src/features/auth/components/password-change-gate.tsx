'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from './session-provider';

export const CHANGE_PASSWORD_PATH = '/change-password';

/**
 * Bắt đổi mật khẩu lần đầu (2026-10-20): /auth/me.mustChangePassword → mọi trang khác chuyển về
 * /change-password và không render nội dung (API cũng đang trả 403 AUTH_PASSWORD_CHANGE_REQUIRED,
 * đây chỉ là UX — luật 7). Đổi xong, màn đó làm mới /auth/me → cờ tắt → gate mở.
 */
export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useSession();
  const forced = me?.mustChangePassword === true && pathname !== CHANGE_PASSWORD_PATH;

  useEffect(() => {
    if (forced) router.replace(CHANGE_PASSWORD_PATH);
  }, [forced, router]);

  if (!forced) return <>{children}</>;
  return (
    <p role="status" className="m-6 text-sm text-muted-foreground">
      Bạn cần đổi mật khẩu trước khi tiếp tục.{' '}
      <Link href={CHANGE_PASSWORD_PATH} className="underline">
        Đổi mật khẩu
      </Link>
    </p>
  );
}
