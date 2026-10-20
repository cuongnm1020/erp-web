import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'draft' | 'warn' | 'ok' | 'err' | 'brand' | 'neutral';

const TONE_CLASS: Record<StatusTone, string> = {
  // 3 mức cảnh báo theo DESIGN-BRIEF §1: chặn (đỏ) / cảnh báo (vàng) / thông tin (xám)
  draft: 'bg-info-weak text-info',
  warn: 'bg-warning-weak text-warning',
  ok: 'bg-success-weak text-success',
  err: 'bg-destructive-weak text-destructive',
  brand: 'bg-secondary text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

/**
 * Chip trạng thái chứng từ / SLA (design system 2026-10-20): cao 18px, bo 9px, chấm màu trước chữ.
 * Dùng tone theo ngữ nghĩa, không truyền màu trực tiếp. Trạng thái đơn hàng truyền lớp `flow-*`
 * qua `className` (ví dụ `bg-flow-picking/10 text-flow-picking`) — chấm tự lấy theo màu chữ.
 */
export function StatusBadge({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  /** Tắt chấm khi chip đứng trong không gian rất hẹp (ô ma trận…). */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4.5 items-center gap-1 whitespace-nowrap rounded-chip px-2 text-xs font-semibold',
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
