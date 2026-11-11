'use client';

import { ChevronDown, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { EntityOption, EntitySearchResult } from './entity-picker';

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export interface EntityMultiPickerProps {
  /** Nhãn ô: "Sản phẩm" → "Sản phẩm: tất cả" / "Sản phẩm: <tên>" / "Sản phẩm: 3 SP". */
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** Hook tìm do feature cung cấp (luật 12) — gọi với chữ đã debounce. */
  useSearch: (q: string) => EntitySearchResult;
  /** Mục đang chọn (nhãn do feature tra) — hiện ở đầu danh sách dù không nằm trong kết quả tìm. */
  selectedOptions: readonly EntityOption[];
  /** Đơn vị trên nút khi chọn từ 2 mục. Mặc định "mục". */
  unit?: string;
  /** Tối đa số mục chọn (khớp giới hạn API); đủ thì mục chưa chọn bị khóa. */
  max?: number;
  /** Chữ thay cho "tất cả" khi chưa chọn gì (vd "Loại trừ SP: không"). */
  emptySummary?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

/**
 * Ô chọn NHIỀU thực thể có ô tìm bất đồng bộ (sản phẩm…) — như {@link SearchableMultiSelect} nhưng
 * danh sách lấy từ server theo chữ gõ. Tích / bỏ tích không đóng hộp; mục đã chọn ghim lên đầu (thứ
 * tự chốt lúc mở hộp, tick khi đang mở không làm dòng nhảy chỗ).
 */
export function EntityMultiPicker({
  label,
  values,
  onChange,
  useSearch,
  selectedOptions,
  unit,
  max,
  emptySummary,
  searchPlaceholder = 'Gõ để tìm…',
  emptyText = 'Không tìm thấy',
  className,
}: EntityMultiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const dq = useDebounced(q, 250);
  const listId = React.useId();
  const { options, isPending } = useSearch(open ? dq : '');
  const picked = new Set(values);
  const full = max !== undefined && values.length >= max;
  // Nhãn mục vừa tích trong phiên này (feature chưa kịp tra) — lấy từ kết quả tìm.
  const seen = React.useRef(new Map<string, EntityOption>());
  for (const o of options ?? []) seen.current.set(o.id, o);
  const byId = new Map(selectedOptions.map((o) => [o.id, o]));
  const optionOf = (id: string): EntityOption =>
    byId.get(id) ?? seen.current.get(id) ?? { id, label: 'Đang tải…' };

  const [pinned, setPinned] = React.useState<readonly string[]>([]);
  const pinnedSet = new Set(pinned);
  const pinnedRows = pinned.map(optionOf);
  const rest = (options ?? []).filter((o) => !pinnedSet.has(o.id));

  const first = values.length === 1 ? optionOf(values[0]!) : undefined;
  const summary =
    values.length === 0
      ? (emptySummary ?? `${label}: tất cả`)
      : first
        ? `${label}: ${first.label}`
        : `${label}: ${values.length} ${unit ?? 'mục'}`;

  const toggle = (id: string) => {
    if (picked.has(id)) onChange(values.filter((x) => x !== id));
    else if (!full) onChange([...values, id]);
  };
  const onOpenChange = (next: boolean) => {
    if (next) {
      setPinned(values);
      setQ('');
    }
    setOpen(next);
  };

  const row = (o: EntityOption) => {
    const on = picked.has(o.id);
    return (
      <CommandItem key={o.id} value={o.id} disabled={!on && full} onSelect={() => toggle(o.id)}>
        <Checkbox checked={on} tabIndex={-1} aria-hidden className="pointer-events-none" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate" title={o.label}>
            {o.label}
            {on ? <span className="sr-only"> (đã chọn)</span> : null}
          </span>
          {o.hint ? (
            <span className="truncate font-mono text-xs text-muted-foreground">{o.hint}</span>
          ) : null}
        </span>
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          className={cn(
            'flex h-8 w-56 items-center justify-between whitespace-nowrap rounded-md border border-control-border bg-card px-2.5 py-1 text-sm text-foreground focus-visible:border-control-border-focus',
            values.length > 0 && 'border-primary bg-secondary font-semibold text-primary',
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={searchPlaceholder} />
          <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>
              Đã chọn {values.length}
              {max !== undefined ? ` / tối đa ${max}` : ''}
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
            {pinnedRows.length > 0 ? (
              <CommandGroup heading="Đã chọn">{pinnedRows.map(row)}</CommandGroup>
            ) : null}
            {rest.length > 0 ? <CommandGroup>{rest.map(row)}</CommandGroup> : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
