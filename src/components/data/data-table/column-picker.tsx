'use client';

import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ColumnPickerOption {
  id: string;
  title: string;
  /** Cột luôn hiện (vd mã đơn) — không bỏ chọn được. */
  required?: boolean;
}

/**
 * Nút "Cột" + danh sách tick chọn cột hiển thị của DataTable. Chỉ phát sự kiện — nơi lưu (URL,
 * tuỳ chọn người dùng ở server…) do màn quyết định.
 */
export function ColumnPicker({
  columns,
  hidden,
  onChange,
}: {
  columns: ColumnPickerOption[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const hiddenSet = new Set(hidden);
  const toggle = (id: string, show: boolean) =>
    onChange(show ? hidden.filter((h) => h !== id) : [...hidden, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 aria-hidden />
          Cột
          {hidden.length > 0 ? (
            <span className="text-muted-foreground">
              {columns.length - hidden.length}/{columns.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground">Cột hiển thị</p>
        <ul className="space-y-0.5">
          {columns.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox
                  checked={c.required || !hiddenSet.has(c.id)}
                  disabled={c.required}
                  onCheckedChange={(v) => toggle(c.id, !!v)}
                  aria-label={c.title}
                />
                {c.title}
              </label>
            </li>
          ))}
        </ul>
        {hidden.length > 0 ? (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
            Hiện tất cả cột
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
