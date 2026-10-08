'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CustomerTagMatch } from '../api/use-customers';
import { useCustomerTags } from '../api/use-segments';
import { TagChip } from './tag-chip';

/** API nhận tối đa 20 tag mỗi lần lọc (FilterCustomerQueryDto ArrayMaxSize 20). */
export const MAX_TAG_FILTER = 20;

/**
 * Bộ lọc tag nhiều lựa chọn + chế độ khớp "có ít nhất một" (any) / "có đủ" (all).
 * Giá trị nằm trên URL ở màn gọi — component không giữ state nguồn.
 */
export function CustomerTagFilter({
  value,
  match,
  onChange,
}: {
  value: string[];
  match: CustomerTagMatch;
  onChange: (next: { tagIds: string[]; match: CustomerTagMatch }) => void;
}) {
  const tags = useCustomerTags();
  const selected = new Set(value);
  const names = (tags.data ?? []).filter((t) => selected.has(t.id)).map((t) => t.name);
  const label =
    value.length === 0
      ? 'Tag: tất cả'
      : value.length === 1
        ? `Tag: ${names[0] ?? '1 tag'}`
        : `Tag: ${value.length} tag (${match === 'all' ? 'có đủ' : 'có một'})`;

  const toggle = (id: string) => {
    const next = selected.has(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange({ tagIds: next.slice(0, MAX_TAG_FILTER), match });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-44 justify-between px-3 font-normal"
          aria-label="Lọc theo tag"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="flex items-center gap-1 border-b px-2 py-1.5 text-xs" role="radiogroup">
          <span className="mr-1 text-muted-foreground">Khớp</span>
          {(
            [
              ['any', 'Có ít nhất một'],
              ['all', 'Có đủ các tag'],
            ] as const
          ).map(([m, text]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={match === m}
              onClick={() => onChange({ tagIds: value, match: m })}
              className={
                match === m
                  ? 'rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary'
                  : 'rounded-sm px-1.5 py-0.5 hover:bg-muted'
              }
            >
              {text}
            </button>
          ))}
        </div>
        <div className="max-h-64 overflow-auto py-1">
          {tags.isPending ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Đang tải tag…</p>
          ) : tags.isError ? (
            <p className="px-3 py-2 text-xs text-destructive">
              Không tải được danh sách tag. Đóng rồi mở lại để thử lại.
            </p>
          ) : (tags.data ?? []).length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Chưa có tag nào — tạo ở màn Nhóm · cấp độ · tag.
            </p>
          ) : (
            (tags.data ?? []).map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-muted"
              >
                <Checkbox
                  checked={selected.has(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                  disabled={!selected.has(t.id) && value.length >= MAX_TAG_FILTER}
                />
                <TagChip name={t.name} color={t.color} className="border-0 bg-transparent px-0" />
              </label>
            ))
          )}
        </div>
        {value.length > 0 ? (
          <div className="border-t px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => onChange({ tagIds: [], match })}
            >
              Bỏ chọn tag
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
