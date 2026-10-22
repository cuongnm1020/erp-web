'use client';

import { Check, Plus, X } from 'lucide-react';
import { useMemo } from 'react';
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
import { useOrderTags } from '../api/use-order-create';

/**
 * Chọn thẻ đơn (core.Tag) ngoài form tạo đơn — màn Sửa đơn (2026-10-22, PATCH `tagIds` thay cả
 * danh sách). Cùng hình với TagPicker của màn tạo đơn: chip có nút bỏ + "Thêm thẻ" mở ô tìm.
 */
export function OrderTagsField({
  value,
  onChange,
  disabled,
  dirty,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Đổi chưa lưu — viền warning quanh cụm thẻ. */
  dirty?: boolean;
}) {
  const tags = useOrderTags();
  const byId = useMemo(() => new Map((tags.data ?? []).map((t) => [t.id, t])), [tags.data]);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div
      className={cn(
        'flex min-h-control flex-wrap items-center gap-1.5 rounded-md border border-transparent',
        dirty && 'border-warning bg-warning-weak px-1.5',
      )}
    >
      {value.map((id) => (
        <span
          key={id}
          className="inline-flex h-7 items-center gap-1 rounded-chip bg-muted px-2 text-xs font-semibold"
        >
          {byId.get(id)?.name ?? '…'}
          {disabled ? null : (
            <button
              type="button"
              aria-label={`Bỏ thẻ ${byId.get(id)?.name ?? ''}`}
              onClick={() => toggle(id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </span>
      ))}
      {disabled ? (
        value.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : null
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus aria-hidden />
              Thêm thẻ
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Tìm thẻ…" />
              <CommandList>
                <CommandEmpty>
                  {tags.isPending ? 'Đang tải…' : 'Chưa có thẻ — tạo ở Danh mục khách hàng › Thẻ'}
                </CommandEmpty>
                <CommandGroup>
                  {(tags.data ?? []).map((t) => (
                    <CommandItem
                      key={t.id}
                      value={`${t.name} ${t.code}`}
                      onSelect={() => toggle(t.id)}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          value.includes(t.id) ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      {t.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
