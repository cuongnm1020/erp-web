'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { matchesVi } from './form/search-select';

/**
 * Ô chọn NHIỀU giá trị có ô tìm (Popover + Command) — cùng kích thước với SearchableSelect. Dùng cho
 * danh sách dài cần lọc nhiều mục một lúc (page Facebook…). Mục đã chọn lên đầu danh sách; khớp khi
 * mọi từ gõ vào đều có trong nhãn (không phân biệt hoa thường / dấu).
 */
export function SearchableMultiSelect({
  label,
  values,
  options,
  onChange,
  unit,
  className,
}: {
  label: string;
  values: readonly string[];
  /** `hint` = chữ phụ bên phải (vd "3 POS"). */
  options: Array<{ value: string; label: string; hint?: string }>;
  onChange: (values: string[]) => void;
  /** Đơn vị trên nút khi chọn từ 2 mục: "Page: 2 page". Mặc định "mục". */
  unit?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const picked = new Set(values);
  const first = values.length === 1 ? options.find((o) => o.value === values[0]) : undefined;
  const summary =
    values.length === 0
      ? `${label}: tất cả`
      : first
        ? `${label}: ${first.label}`
        : `${label}: ${values.length} ${unit ?? 'mục'}`;
  const toggle = (v: string) =>
    onChange(picked.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  // Mục đã chọn lên đầu (theo thứ tự danh sách gốc) — mở lại thấy ngay mình đang lọc gì.
  const ordered = [
    ...options.filter((o) => picked.has(o.value)),
    ...options.filter((o) => !picked.has(o.value)),
  ];
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
            values.length > 0 && 'border-primary bg-secondary font-semibold text-primary',
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-96 p-0" align="start">
        <Command filter={(itemValue, search) => (matchesVi(itemValue, search) ? 1 : 0)}>
          <CommandInput placeholder={`Tìm ${label.toLowerCase()}…`} />
          <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>
              Đã chọn {values.length} / {options.length}
            </span>
            {values.length > 0 ? (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => onChange([])}
              >
                Bỏ chọn
              </button>
            ) : null}
          </div>
          <CommandList>
            <CommandEmpty>Không có mục nào khớp</CommandEmpty>
            <CommandGroup>
              {ordered.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => toggle(o.value)}
                >
                  <Checkbox
                    checked={picked.has(o.value)}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {o.label}
                    {picked.has(o.value) ? <span className="sr-only"> (đã chọn)</span> : null}
                  </span>
                  {o.hint ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
