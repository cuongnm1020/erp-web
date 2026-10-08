import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Chip tag khách hàng. Màu tag là DỮ LIỆU người dùng chọn (#rrggbb, API đã validate) nên vẽ
 * bằng inline style cho chấm màu — không phải màu thiết kế; nền/viền chip vẫn theo token.
 */
export function TagChip({
  name,
  color,
  onRemove,
  removeLabel,
  className,
  children,
}: {
  name: string;
  color: string | null;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-input bg-card px-1.5 text-xs',
        className,
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground"
        style={color ? { backgroundColor: color } : undefined}
      />
      <span className="truncate">{name}</span>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Gỡ tag ${name}`}
          className="-mr-0.5 rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
