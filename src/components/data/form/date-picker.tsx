'use client';

import { CalendarIcon, X } from 'lucide-react';
import * as React from 'react';
import { DateRangeFilter, MonthGrid } from '../date-range-filter';
import { Button } from '@/components/ui/button';
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
  'aria-label'?: string;
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
        <PopoverContent className="w-auto p-3" align="start">
          <SingleMonth
            value={value}
            minKey={fromDate ? dateToKey(fromDate) : ''}
            maxKey={toDate ? dateToKey(toDate) : ''}
            onPick={(k) => {
              onChange(k);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = 'DatePicker';

const monthStart = (key: DateKey) => `${key.slice(0, 8)}01`;
const plusMonths = (month: DateKey, n: number): DateKey => {
  const d = keyToDate(month)!;
  return dateToKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/**
 * Lịch một tháng của ô chọn ngày (2026-11-03): dùng chung lưới "Tháng 11 / 2026", T2…CN với bộ lọc
 * khoảng ngày — không còn lịch react-day-picker khác giao diện. Ngày ngoài [minKey, maxKey] không bấm.
 */
function SingleMonth({
  value,
  minKey,
  maxKey,
  onPick,
}: {
  value: DateKey | '';
  minKey: DateKey | '';
  maxKey: DateKey | '';
  onPick: (key: DateKey) => void;
}) {
  const today = dateToKey(new Date());
  const [month, setMonth] = React.useState(() => monthStart(value || today));
  const canPrev = !minKey || plusMonths(month, -1) >= monthStart(minKey);
  const canNext = !maxKey || plusMonths(month, 1) <= monthStart(maxKey);
  return (
    <MonthGrid
      month={month}
      from={value}
      to={value}
      today={today}
      onPick={onPick}
      onPrev={canPrev ? () => setMonth((m) => plusMonths(m, -1)) : undefined}
      onNext={canNext ? () => setMonth((m) => plusMonths(m, 1)) : undefined}
      isDisabled={(k) => (!!minKey && k < minKey) || (!!maxKey && k > maxKey)}
    />
  );
}

export interface DateRangeValue {
  from: DateKey | '';
  to: DateKey | '';
}

/**
 * Khoảng ngày không bắt buộc (trống = mọi lúc). Giá trị 'yyyy-mm-dd'. Từ 2026-10-22 hiện bằng bộ
 * lọc khoảng ngày dùng chung; `placeholder` là tên trường ngày trên nút.
 */
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
  return (
    <DateRangeFilter
      label={placeholder}
      className={className}
      value={{ from: value.from || undefined, to: value.to || undefined }}
      onChange={(r) => onChange({ from: r.from ?? '', to: r.to ?? r.from ?? '' })}
    />
  );
}

export { dateToKey, keyToDate };
