import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Màn trống là lời mời hành động (luật 13): tiêu đề + mô tả + ĐÚNG MỘT hành động.
 * `action` truyền một <Button>; không truyền hai.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
