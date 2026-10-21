import * as React from 'react';
import { cn } from '@/lib/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-16 w-full rounded-md border border-control-border bg-card px-2.5 py-1.5 text-sm placeholder:text-subtle-foreground focus-visible:border-control-border-focus disabled:cursor-not-allowed disabled:bg-control-bg-disabled disabled:opacity-60 aria-[invalid=true]:border-destructive',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
