'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
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
import { matchesVi } from './form/search-select';

/**
 * Ô chọn một giá trị có ô tìm (Popover + Command) — cùng kích thước h-8 w-44 như select lọc thường.
 * Khớp khi mọi từ gõ vào đều có trong nhãn (không phân biệt hoa thường / dấu). Mục đầu = bỏ lọc
 * (`allLabel`, mặc định "<label>: tất cả"). Dùng cho danh sách dài: POS Pancake, team CSKH…
 */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  allLabel = `${label}: tất cả`,
  className,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string | undefined) => void;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const pick = (v: string | undefined) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          className={cn(
            'flex h-8 w-44 items-center justify-between whitespace-nowrap rounded-md border border-control-border bg-card px-2.5 py-1 text-sm text-foreground focus-visible:border-control-border-focus',
            className,
          )}
        >
          <span className="truncate">{current ? current.label : allLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-80 p-0" align="start">
        <Command filter={(itemValue, search) => (matchesVi(itemValue, search) ? 1 : 0)}>
          <CommandInput placeholder={`Tìm ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Không có mục nào khớp</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => pick(undefined)}>
                <Check
                  className={cn('h-4 w-4', value === undefined ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => pick(o.value)}
                >
                  <Check
                    className={cn('h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
