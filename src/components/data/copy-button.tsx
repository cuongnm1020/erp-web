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
 * SĐT, mã vận đơn. Phản hồi tại chỗ "Đã sao chép" 1,5 giây, không toast (toast che bảng). Chặn
 * click lan lên dòng bảng. Clipboard bị chặn (http) → bôi chọn sẵn giá trị đứng trước để Ctrl C.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = useRef<HTMLButtonElement>(null);
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
    <>
      <button
        ref={ref}
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
          'ml-0.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded-md align-middle text-subtle-foreground hover:bg-muted hover:text-primary',
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
        <span role="status" className="ml-0.5 text-xs font-semibold text-success">
          Đã sao chép
        </span>
      ) : null}
    </>
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
