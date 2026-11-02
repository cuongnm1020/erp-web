'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CopyButtonProps {
  /** Giá trị gốc chép vào clipboard (SĐT dạng liền, mã không kèm tiền tố). */
  value: string;
  /** Tên thứ được chép cho tooltip + trình đọc màn hình: "mã đơn", "số điện thoại", "mã vận đơn". */
  label: string;
  className?: string;
}

/**
 * Nút icon 20×20 đứng ngay sau giá trị cần dán đi nơi khác (design system CopyButton): mã chứng từ,
 * SĐT, mã vận đơn. Phản hồi bằng bong bóng nhỏ "Đã sao chép" nổi phía trên icon 1,5 giây (không
 * chiếm chỗ trong dòng, không toast vì toast che bảng). Chặn click lan lên dòng bảng. Clipboard bị
 * chặn (http) → bôi chọn sẵn giá trị đứng trước để Ctrl C.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const selectPrevious = () => {
    const prev = ref.current?.previousElementSibling;
    if (!prev) return;
    const range = document.createRange();
    range.selectNodeContents(prev);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1500);
    } catch {
      selectPrevious();
    }
  };

  return (
    <span ref={ref} className="relative ml-0.5 inline-grid shrink-0 align-middle">
      <button
        type="button"
        title={`Sao chép ${label}`}
        aria-label={`Sao chép ${label} ${value}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          void copy();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          'inline-grid h-5 w-5 place-items-center rounded-md text-subtle-foreground hover:bg-muted hover:text-primary',
          done && 'bg-muted text-primary',
          className,
        )}
      >
        {done ? (
          <Check aria-hidden className="h-3 w-3" />
        ) : (
          <Copy aria-hidden className="h-3 w-3" />
        )}
      </button>
      {done ? (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-md"
        >
          Đã sao chép
        </span>
      ) : null}
    </span>
  );
}

/**
 * Giá trị + CopyButton không ngắt dòng. `children` là phần hiển thị (link mã, SĐT có dấu cách…);
 * `value` là chuỗi chép.
 */
export function Copyable({
  value,
  label,
  children,
  className,
}: CopyButtonProps & { children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap', className)}>
      <span className="select-all">{children ?? value}</span>
      <CopyButton value={value} label={label} />
    </span>
  );
}
