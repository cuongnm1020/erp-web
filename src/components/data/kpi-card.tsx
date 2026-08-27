import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Ô chỉ số cho dashboard / dải chỉ số đầu trang hồ sơ.
 * Số dùng tabular-nums, không thu gọn tiền tệ (DESIGN-BRIEF §1).
 */
export function KpiCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold leading-7 tabular-nums">{value}</span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}
