import { cn } from '@/lib/cn';

/**
 * Thanh tải 2px màu primary, đặt `absolute` trong khung `relative` (đầu thẻ bảng, dưới thanh trên).
 * - `indeterminate`: khối chạy lặp — đang tìm / lọc / chuyển trang bảng.
 * - `route`: đầy dần tới 88% rồi đứng — chuyển giữa các màn.
 * Giảm chuyển động: thanh đứng yên, phủ hết bề rộng, mờ.
 */
export function LoadingBar({
  variant = 'indeterminate',
  className,
}: {
  variant?: 'indeterminate' | 'route';
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden',
        className,
      )}
    >
      {variant === 'route' ? (
        <div className="h-full origin-left animate-route-progress bg-primary motion-reduce:animate-none motion-reduce:opacity-60" />
      ) : (
        <div className="h-full w-1/3 animate-indeterminate rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
      )}
    </div>
  );
}
