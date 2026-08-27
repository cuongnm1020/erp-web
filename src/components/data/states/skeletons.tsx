import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

/**
 * Skeleton theo hình dạng nội dung (luật 13): bảng ra bảng, form ra form.
 * Không spinner giữa màn.
 */
export function ListSkeleton({
  rows = 10,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-label="Đang tải danh sách" className={cn('space-y-2', className)}>
      <div className="flex h-9 gap-2">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-9 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-10 items-center gap-2">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-48')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ fields = 6, className }: { fields?: number; className?: string }) {
  return (
    <div role="status" aria-label="Đang tải chi tiết" className={cn('space-y-4', className)}>
      <Skeleton className="h-7 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 5, className }: { fields?: number; className?: string }) {
  return (
    <div role="status" aria-label="Đang tải biểu mẫu" className={cn('space-y-4', className)}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-32" />
    </div>
  );
}
