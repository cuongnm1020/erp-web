'use client';

import { ScanBarcode } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export interface ScanInputHandle {
  focus: () => void;
}

export interface ScanInputProps {
  /** Mã vừa quét (đã trim). Máy quét gõ chuỗi rồi Enter — người cũng gõ tay được. */
  onScan: (code: string) => void;
  /** Tạm ngừng giành lại focus (đang mở dialog, người dùng đang gõ ô khác). */
  paused?: boolean;
  disabled?: boolean;
  placeholder?: string;
  label: string;
  className?: string;
  /** Cỡ chữ to cho màn cầm tay. */
  size?: 'default' | 'lg';
}

/**
 * Ô quét cho máy quét kiểu bàn phím (USB / DataWedge keystroke): luôn giữ focus để mọi
 * chuỗi máy quét gõ vào đúng chỗ, Enter = một lần quét, xoá sau khi gửi. Mất focus (bấm
 * ra ngoài, dialog đóng) thì tự lấy lại — trừ khi `paused` hoặc người dùng đang ở một ô
 * nhập khác (không giành focus của ô số lượng). Không biết gì về nghiệp vụ (luật 12).
 */
export const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(function ScanInput(
  { onScan, paused = false, disabled = false, placeholder, label, className, size = 'default' },
  ref,
) {
  const input = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');
  const focus = useCallback(() => input.current?.focus(), []);
  useImperativeHandle(ref, () => ({ focus }), [focus]);

  useEffect(() => {
    if (!paused && !disabled) focus();
  }, [paused, disabled, focus]);

  const onBlur = () => {
    if (paused || disabled) return;
    // Nhường focus cho ô nhập khác (số lượng, tìm kiếm); còn lại thì lấy lại ngay.
    window.setTimeout(() => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.closest('[role="dialog"]') !== null;
      if (!typing && !paused) focus();
    }, 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = value.trim();
    setValue('');
    if (code) onScan(code);
  };

  return (
    <div className={cn('relative', className)}>
      <ScanBarcode
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'lg' ? 'h-6 w-6' : 'h-4 w-4',
        )}
      />
      <Input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder ?? 'Quét mã…'}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        className={cn('font-mono', size === 'lg' ? 'h-14 pl-11 text-lg' : 'pl-9')}
        data-scan-input
      />
    </div>
  );
});
