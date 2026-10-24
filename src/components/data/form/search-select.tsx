'use client';

import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

/** Bỏ dấu + chữ thường để so khớp tiếng Việt ("hue" khớp "Huế", "dung" khớp "Dũng"). */
export function foldVi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/** Khớp khi mọi từ gõ vào đều có trong chuỗi (không phân biệt hoa thường / dấu). */
export function matchesVi(haystack: string, query: string): boolean {
  const hay = foldVi(haystack);
  return foldVi(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Chữ phụ bên phải (mã nhân viên, vai trò, số việc…) — cũng được tìm theo. */
  hint?: string;
  disabled?: boolean;
}

export interface SearchSelectProps {
  /** '' = chưa chọn. */
  value: string;
  onChange: (value: string, option?: SearchSelectOption) => void;
  options: SearchSelectOption[];
  /** Chữ trên ô khi chưa chọn. */
  placeholder?: string;
  /** Có thì thêm dòng đầu chọn lại '' (vd "— Chưa có —", "Tất cả"). */
  noneLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Lớp cho ô (độ rộng / cao) — giống SelectTrigger. */
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

const NONE = '__none__';

/**
 * Ô chọn một giá trị có ô tìm (Popover + Command) cho danh sách đã tải sẵn — trông như Select,
 * thêm ô gõ tìm theo nhãn và chữ phụ, không phân biệt dấu. Đi hết bằng bàn phím: Enter / Space mở,
 * gõ để lọc, ↑↓ chọn, Enter chốt, Esc đóng. Danh sách tìm phía server dùng EntityPicker.
 */
export const SearchSelect = React.forwardRef<HTMLButtonElement, SearchSelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Chọn…',
      noneLabel,
      searchPlaceholder = 'Gõ để tìm…',
      emptyText = 'Không có mục nào khớp',
      disabled,
      className,
      ...aria
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const listId = React.useId();
    const current = value ? options.find((o) => o.value === value) : undefined;
    const pick = (v: string, o?: SearchSelectOption) => {
      onChange(v, o);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            className={cn(
              'flex h-control w-full items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-control-border bg-card px-2.5 py-1 text-left text-sm focus-visible:border-control-border-focus disabled:cursor-not-allowed disabled:bg-control-bg-disabled disabled:opacity-60',
              className,
            )}
            {...aria}
          >
            {current ? (
              <span className="flex min-w-0 items-baseline gap-1.5" title={current.label}>
                <span className="truncate">{current.label}</span>
                {current.hint ? (
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="sr-only"> · </span>
                    {current.hint}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className={cn('truncate', !noneLabel && 'text-subtle-foreground')}>
                {noneLabel && !value ? noneLabel : placeholder}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          id={listId}
          className="w-[--radix-popover-trigger-width] min-w-72 p-0"
          align="start"
        >
          <Command
            filter={(itemValue, search, keywords) =>
              itemValue === NONE || matchesVi((keywords ?? []).join(' '), search) ? 1 : 0
            }
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {noneLabel ? (
                  <CommandItem value={NONE} onSelect={() => pick('')}>
                    <Check
                      className={cn('h-4 w-4 shrink-0', value ? 'opacity-0' : 'opacity-100')}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{noneLabel}</span>
                  </CommandItem>
                ) : null}
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    // value = khóa duy nhất; lọc theo keywords (nhãn + chữ phụ), không theo id.
                    value={o.value}
                    keywords={o.hint ? [o.label, o.hint] : [o.label]}
                    disabled={o.disabled}
                    onSelect={() => pick(o.value, o)}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-primary',
                        o.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate" title={o.label}>
                      {o.label}
                    </span>
                    {o.hint ? (
                      <span className="shrink-0 pl-3 text-xs text-muted-foreground">
                        <span className="sr-only"> · </span>
                        {o.hint}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
SearchSelect.displayName = 'SearchSelect';
