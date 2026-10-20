'use client';

import { Minus, Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export interface QuantityInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  /** Số nguyên theo đơn vị cơ sở, dạng string ("12"); '' khi trống. */
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? 0, n));

/**
 * Số lượng nguyên theo đơn vị cơ sở (luật 10). Nút +/- và phím ↑/↓ để nhập nhanh bằng bàn phím.
 * Đổi đơn vị (thùng ↔ cái) không làm ở đây — ở lớp hiển thị/đơn hàng.
 */
export const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ value, onChange, min = 0, max, step = 1, unit, className, disabled, ...props }, ref) => {
    const n = value === '' ? null : Number.parseInt(value, 10);
    const setN = (next: number) => onChange(String(clamp(next, min, max)));
    return (
      <div className="flex items-stretch">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-r-none"
          aria-label="Giảm"
          tabIndex={-1}
          disabled={disabled || (n !== null && n <= min)}
          onClick={() => setN((n ?? min) - step)}
        >
          <Minus />
        </Button>
        <Input
          ref={ref}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(digits === '' ? '' : String(clamp(Number.parseInt(digits, 10), min, max)));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setN((n ?? min) + step);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setN((n ?? min) - step);
            }
          }}
          onFocus={(e) => e.target.select()}
          className={cn('w-20 rounded-none text-center tabular-nums', className)}
          {...props}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-l-none"
          aria-label="Tăng"
          tabIndex={-1}
          disabled={disabled || (max !== undefined && n !== null && n >= max)}
          onClick={() => setN((n ?? min) + step)}
        >
          <Plus />
        </Button>
        {unit ? (
          <span className="ml-2 self-center text-sm text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    );
  },
);
QuantityInput.displayName = 'QuantityInput';
