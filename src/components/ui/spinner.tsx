import { cn } from '@/lib/cn';

/**
 * Vòng xoay nhỏ (14–16px) — CHỈ đặt trong nút, ô tìm kiếm, dòng trạng thái. Không dùng giữa màn
 * (luật 13: màn đang tải dùng skeleton). Màu theo `currentColor`.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 motion-reduce:animate-none',
        className,
      )}
    />
  );
}
