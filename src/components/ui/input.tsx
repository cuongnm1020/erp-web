import * as React from 'react';
import { cn } from '@/lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // Ô nhập theo design system Input: cao control-height, viền control-border (3:1), nền card,
        // placeholder subtle-foreground, lỗi → viền destructive (câu lỗi do FormMessage).
        'flex h-control w-full rounded-md border border-control-border bg-card px-2.5 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-subtle-foreground focus-visible:border-control-border-focus disabled:cursor-not-allowed disabled:bg-control-bg-disabled disabled:opacity-60 aria-[invalid=true]:border-destructive',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
