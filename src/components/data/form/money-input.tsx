'use client';

import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatMoney, parseMoneyInput } from '@/lib/format';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  /** String decimal chuẩn ("1234567.5") hoặc '' khi trống. Không bao giờ number. */
  value: string;
  onChange: (value: string) => void;
  /** Số lẻ hiển thị khi blur (VND 0, ngoại tệ 2). */
  dp?: number;
  unit?: string;
}

/**
 * Ô nhập tiền (luật 10): nhận/trả string decimal; khi đang gõ giữ nguyên chuỗi người dùng,
 * khi blur chuẩn hóa + hiển thị nhóm nghìn VN. Không parseFloat ở bất kỳ đâu.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, dp = 0, unit = '₫', className, onBlur, onFocus, ...props }, ref) => {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    const justFocused = React.useRef(false);

    React.useEffect(() => {
      if (!editing) setDraft(value);
    }, [value, editing]);

    const display = editing ? draft : value ? formatMoney(value, { dp, unit: '' }) : '';

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onFocus={(e) => {
            setEditing(true);
            setDraft(value);
            onFocus?.(e);
            // chọn hết để gõ đè nhanh; mouseup ngay sau focus sẽ bỏ chọn → chặn một lần
            e.target.select();
            justFocused.current = true;
          }}
          onMouseUp={(e) => {
            if (justFocused.current) {
              e.preventDefault();
              justFocused.current = false;
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const parsed = parseMoneyInput(raw);
            if (raw.trim() === '') onChange('');
            else if (parsed !== null) onChange(parsed);
          }}
          onBlur={(e) => {
            setEditing(false);
            const parsed = parseMoneyInput(draft);
            onChange(draft.trim() === '' ? '' : (parsed ?? value));
            onBlur?.(e);
          }}
          className={cn('pr-8 text-right tabular-nums', className)}
          {...props}
        />
        {unit ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-2 text-sm text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
