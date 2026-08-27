import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'draft' | 'warn' | 'ok' | 'err' | 'brand' | 'neutral';

const TONE_CLASS: Record<StatusTone, string> = {
  // 3 mức cảnh báo theo DESIGN-BRIEF §1: chặn (đỏ) / cảnh báo (vàng) / thông tin (xám)
  draft: 'bg-info/10 text-info',
  warn: 'bg-warning/10 text-warning',
  ok: 'bg-success/10 text-success',
  err: 'bg-destructive/10 text-destructive',
  brand: 'bg-secondary text-primary',
  neutral: 'bg-muted text-muted-foreground font-normal',
};

/**
 * Chip trạng thái chứng từ / SLA. Dùng tone theo ngữ nghĩa, không truyền màu trực tiếp.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-xs font-semibold',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
