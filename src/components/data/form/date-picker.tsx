'use client';

import { CalendarIcon, X } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

/**
 * Giá trị là ngày dạng 'yyyy-mm-dd' (không giờ, không múi giờ) — cho field ngày nghiệp vụ
 * (ngày chứng từ, hạn thanh toán). Chuỗi datetime ISO đi qua formatDateTime ở lớp hiển thị.
 */
export type DateKey = string;

function keyToDate(k: DateKey | ''): Date | undefined {
  if (!k) return undefined;
  const [y, m, d] = k.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToKey(d: Date): DateKey {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hiển thị dd/mm/yyyy từ key, không qua múi giờ. */
function keyLabel(k: DateKey): string {
  const d = keyToDate(k);
  return d ? formatDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))) : k;
}

export interface DatePickerProps {
  value: DateKey | '';
  onChange: (value: DateKey | '') => void;
  placeholder?: string;
  disabled?: boolean;
  /** Giới hạn chọn (ví dụ không cho ngày quá khứ). */
  fromDate?: Date;
  toDate?: Date;
  clearable?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Chọn ngày',
      disabled,
      fromDate,
      toDate,
      clearable = true,
      className,
      ...aria
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = keyToDate(value);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn('relative', className)}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-full justify-start font-normal',
                !value && 'text-muted-foreground',
                clearable && value && 'pr-8',
              )}
              {...aria}
            >
              <CalendarIcon aria-hidden />
              {value ? keyLabel(value) : placeholder}
            </Button>
          </PopoverTrigger>
          {clearable && value && !disabled ? (
            <button
              type="button"
              aria-label="Xóa ngày"
              onClick={() => onChange('')}
              className="absolute right-2 top-2.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            startMonth={fromDate}
            endMonth={toDate}
            disabled={[
              ...(fromDate ? [{ before: fromDate }] : []),
              ...(toDate ? [{ after: toDate }] : []),
            ]}
            onSelect={(d) => {
              onChange(d ? dateToKey(d) : '');
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = 'DatePicker';

export interface DateRangeValue {
  from: DateKey | '';
  to: DateKey | '';
}

/** Khoảng ngày cho FilterBar (custom) / báo cáo. Giá trị 'yyyy-mm-dd'. */
export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Khoảng ngày',
  className,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const range: DateRange | undefined = value.from
    ? { from: keyToDate(value.from), to: keyToDate(value.to) }
    : undefined;
  const label = value.from
    ? `${keyLabel(value.from)}${value.to ? ` – ${keyLabel(value.to)}` : ''}`
    : placeholder;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-9 justify-start font-normal',
              !value.from && 'text-muted-foreground',
              value.from && 'pr-8',
            )}
          >
            <CalendarIcon aria-hidden />
            {label}
          </Button>
        </PopoverTrigger>
        {value.from ? (
          <button
            type="button"
            aria-label="Xóa khoảng ngày"
            onClick={() => onChange({ from: '', to: '' })}
            className="absolute right-2 top-2.5 rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          defaultMonth={range?.from}
          onSelect={(r) => {
            onChange({ from: r?.from ? dateToKey(r.from) : '', to: r?.to ? dateToKey(r.to) : '' });
            if (r?.from && r?.to) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { dateToKey, keyToDate };
