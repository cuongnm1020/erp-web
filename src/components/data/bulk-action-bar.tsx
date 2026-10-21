'use client';

import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { groupVi } from '@/lib/format';

export interface BulkActionBarProps {
  /** Số dòng đang chọn; 0 thì không render (màn gọi hiện lại thanh lọc). */
  count: number;
  /** Danh từ của màn: "đơn", "sản phẩm", "khách hàng". */
  noun: string;
  onClear: () => void;
  /** Nút hành động: phụ trước (`outline` cỡ `sm`, tối đa 3), MỘT nút chính cuối, "⋯" nếu cần. */
  children?: ReactNode;
  /** Hủy / xóa hàng loạt — `danger-ghost`, tách ra mép phải. */
  danger?: ReactNode;
  /** Dòng ghi chú nhỏ: "2 đơn sẽ bị bỏ qua vì đã gửi". */
  note?: ReactNode;
  /** "Chọn tất cả 1.284 đơn khớp lọc" khi đã chọn hết trang và API hỗ trợ chọn theo lọc. */
  selectAll?: ReactNode;
  className?: string;
}

/**
 * Thanh thao tác hàng loạt (design system BulkActionBar): thay chỗ thanh lọc của bảng khi có ≥1
 * dòng được chọn, nền secondary, cao bằng đầu thẻ 44px để bảng không nhảy. Esc bỏ chọn.
 */
export function BulkActionBar({
  count,
  noun,
  onClear,
  children,
  danger,
  note,
  selectAll,
  className,
}: BulkActionBarProps) {
  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc trong hộp thoại / menu đã được Radix xử lý — chỉ bỏ chọn khi focus ở trang.
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"],[role="menu"]')) return;
      onClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClear]);

  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label={`Thao tác cho ${count} ${noun} đã chọn`}
      className={cn(
        'flex min-h-card-header flex-wrap items-center gap-2 border-b bg-secondary px-3.5 py-1.5',
        className,
      )}
    >
      <span className="mr-1 inline-flex items-center gap-2 border-r border-input pr-2 text-sm font-semibold text-primary">
        {groupVi(String(count))} {noun} đã chọn
        <Button variant="link" size="sm" onClick={onClear} className="font-normal">
          Bỏ chọn
        </Button>
      </span>
      {selectAll}
      {children}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      {danger ? <span className="ml-auto">{danger}</span> : null}
    </div>
  );
}
