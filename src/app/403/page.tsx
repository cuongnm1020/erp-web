import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Không có quyền' };

/** Luật 6: 403 → màn riêng, KHÔNG đá về đăng nhập. */
export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Bạn không có quyền xem mục này</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Tài khoản của bạn chưa được cấp quyền cho trang này. Liên hệ quản trị viên nếu bạn cần truy
        cập.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Về trang chính</Link>
      </Button>
    </main>
  );
}
