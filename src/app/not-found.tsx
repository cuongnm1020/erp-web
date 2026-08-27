import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Đường dẫn không tồn tại hoặc đã bị chuyển. Kiểm tra lại liên kết.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Về trang chính</Link>
      </Button>
    </main>
  );
}
