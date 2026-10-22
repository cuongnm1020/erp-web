'use client';

import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatMoney, groupMoneyTyping, parseMoneyInput, toDecimal } from '@/lib/format';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  /** String decimal chuẩn ("1234567.5") hoặc '' khi trống. Không bao giờ number. */
  value: string;
  onChange: (value: string) => void;
  /** Số lẻ TỐI ĐA được gõ / hiển thị (VND 0, ngoại tệ 2) — số tròn thì không hiện phần lẻ. */
  dp?: number;
  unit?: string;
}

/** "720000.0000" → "720.000"; "1234.5" (dp 2) → "1.234,5". Không bao giờ hiện số 0 thừa ở đuôi. */
function formatEditable(value: string, dp: number): string {
  const d = toDecimal(value);
  if (!d) return '';
  return formatMoney(value, { dp: Math.min(dp, d.decimalPlaces()), unit: '' });
}

/** Số ký tự "có nghĩa" (chữ số, dấu phẩy thập phân, dấu âm) trước vị trí `pos`. */
const significantBefore = (s: string, pos: number) =>
  s.slice(0, pos).replace(/[^\d,\-−]/g, '').length;

/** Vị trí trong `s` ngay sau ký tự có nghĩa thứ `n` — đặt lại con trỏ sau khi chèn dấu chấm. */
function caretAfter(s: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (/[\d,\-−]/.test(s[i]!)) seen++;
    if (seen === n) return i + 1;
  }
  return s.length;
}

/**
 * Ô nhập tiền (luật 10): nhận/trả string decimal. Đang gõ: tự chèn dấu chấm nhóm nghìn kiểu VN
 * (1.234.567, phẩy là thập phân) và giữ đúng vị trí con trỏ; dán "1,234,567.50" kiểu EN vẫn hiểu.
 * Không parseFloat ở bất kỳ đâu.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, dp = 0, unit = '₫', className, onBlur, onFocus, onPaste, ...props }, ref) => {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(() => formatEditable(value, dp));
    const justFocused = React.useRef(false);
    const inner = React.useRef<HTMLInputElement | null>(null);
    const caret = React.useRef<number | null>(null);
    React.useImperativeHandle(ref, () => inner.current!);

    React.useEffect(() => {
      if (!editing) setDraft(formatEditable(value, dp));
    }, [value, editing, dp]);

    // Đặt lại con trỏ SAU khi React ghi chuỗi đã chèn dấu chấm (không thì con trỏ nhảy về cuối).
    React.useLayoutEffect(() => {
      if (caret.current !== null && inner.current && document.activeElement === inner.current) {
        inner.current.setSelectionRange(caret.current, caret.current);
      }
      caret.current = null;
    }, [draft]);

    const emit = (text: string) => {
      const parsed = parseMoneyInput(text);
      if (text.trim() === '') onChange('');
      else if (parsed !== null) onChange(parsed);
    };

    const display = editing ? draft : formatEditable(value, dp);

    return (
      <div className="relative">
        <Input
          ref={inner}
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onFocus={(e) => {
            setEditing(true);
            setDraft(formatEditable(value, dp));
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
          onPaste={(e) => {
            onPaste?.(e);
            // Dán cả chuỗi (có thể kiểu EN "1,234,567.50") → hiểu theo parseMoneyInput, không nhóm lại
            // từng ký tự như lúc gõ.
            const text = e.clipboardData.getData('text').trim();
            // "1,234,567" (EN, chỉ có phẩy nhóm nghìn) — parseMoneyInput hiểu phẩy là thập phân VN.
            const parsed = parseMoneyInput(
              /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text) ? text.replace(/,/g, '') : text,
            );
            if (parsed === null) return;
            e.preventDefault();
            setDraft(formatEditable(parsed, dp));
            onChange(parsed);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            const next = groupMoneyTyping(raw, dp);
            caret.current = caretAfter(
              next,
              significantBefore(raw, e.target.selectionStart ?? raw.length),
            );
            setDraft(next);
            emit(next);
          }}
          onBlur={(e) => {
            setEditing(false);
            const parsed = parseMoneyInput(draft);
            onChange(draft.trim() === '' ? '' : (parsed ?? value));
            onBlur?.(e);
          }}
          className={cn('pr-8 text-right tabular-nums', !unit && 'pr-2.5', className)}
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
