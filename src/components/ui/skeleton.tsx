import { cn } from '@/lib/cn';

/** Khối giữ chỗ — luôn đặt đúng kích thước nội dung thật để không layout shift. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
