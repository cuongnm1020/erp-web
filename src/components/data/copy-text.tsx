'use client';

import type { ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';

export interface CopyTextProps {
  /** Chuỗi chép vào clipboard. */
  value: string;
  /** Tên thứ được chép, cho toast + screen reader: "số điện thoại", "mã vận đơn"… */
  what: string;
  /** Nội dung hiển thị; mặc định chính `value`. */
  children?: ReactNode;
  className?: string;
}

/**
 * Chữ bấm vào là sao chép (SĐT, mã vận đơn…) — dùng trong ô bảng: chặn click lan lên dòng để
 * không mở xem nhanh. Clipboard bị chặn (http, quyền) → toast lỗi, người dùng vẫn đọc được chữ.
 */
export function CopyText({ value, what, children, className }: CopyTextProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${what} ${value}`);
    } catch {
      toast.error(`Trình duyệt chặn sao chép — chọn chữ rồi Ctrl+C để chép ${what}.`);
    }
  };
  return (
    <button
      type="button"
      title={`Bấm để sao chép ${what}`}
      aria-label={`Sao chép ${what} ${value}`}
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        'cursor-copy rounded-sm text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children ?? value}
    </button>
  );
}
