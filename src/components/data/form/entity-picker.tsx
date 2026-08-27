'use client';

import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
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

export interface EntityOption {
  id: string;
  label: string;
  /** Dòng phụ: mã, SĐT… */
  hint?: string;
}

export interface EntitySearchResult {
  options: EntityOption[] | undefined;
  isPending: boolean;
  error?: unknown;
}

export interface EntityPickerProps {
  value: string | '';
  onChange: (id: string | '', option?: EntityOption) => void;
  /**
   * Hook tìm kiếm do feature cung cấp (ví dụ useCustomerSearch) — component không biết module nào
   * (luật 12). Được gọi với q đã debounce.
   */
  useSearch: (q: string) => EntitySearchResult;
  /** Nhãn của giá trị đang chọn khi chưa có trong kết quả tìm (edit form). */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** Combobox tìm bất đồng bộ (khách hàng, sản phẩm, nhân viên). Đi hết bằng bàn phím. */
export const EntityPicker = React.forwardRef<HTMLButtonElement, EntityPickerProps>(
  (
    {
      value,
      onChange,
      useSearch,
      selectedLabel,
      placeholder = 'Chọn…',
      searchPlaceholder = 'Gõ để tìm…',
      emptyText = 'Không tìm thấy',
      disabled,
      clearable = true,
      className,
      ...aria
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const dq = useDebounced(q, 250);
    const { options, isPending } = useSearch(open ? dq : '');
    const [picked, setPicked] = React.useState<EntityOption | undefined>();
    const label = picked?.id === value ? picked.label : (selectedLabel ?? (value ? value : ''));

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn('relative', className)}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                'w-full justify-between font-normal',
                !value && 'text-muted-foreground',
                clearable && value && 'pr-8',
              )}
              {...aria}
            >
              <span className="truncate">{value ? label : placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          {clearable && value && !disabled ? (
            <button
              type="button"
              aria-label="Bỏ chọn"
              onClick={() => onChange('')}
              className="absolute right-8 top-2.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder={searchPlaceholder} />
            <CommandList>
              {isPending ? (
                <div
                  className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang tìm…
                </div>
              ) : (
                <CommandEmpty>{emptyText}</CommandEmpty>
              )}
              <CommandGroup>
                {(options ?? []).map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => {
                      setPicked(o);
                      onChange(o.id, o);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('h-4 w-4', o.id === value ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="flex flex-col">
                      <span>{o.label}</span>
                      {o.hint ? (
                        <span className="text-xs text-muted-foreground">{o.hint}</span>
                      ) : null}
                    </span>
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
EntityPicker.displayName = 'EntityPicker';
