'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type FilterDef<F extends string = string> =
  | { key: F; label: string; type: 'select'; options: Array<{ value: string; label: string }> }
  | { key: F; label: string; type: 'text'; placeholder?: string }
  | { key: F; label: string; type: 'date'; placeholder?: string }
  | {
      key: F;
      label: string;
      type: 'custom';
      /** Component nhận value/onChange — dùng cho EntityPicker (FE-0-08). */
      render: (p: {
        value: string | undefined;
        onChange: (v: string | undefined) => void;
      }) => ReactNode;
    };

const ALL = '__all__';

/**
 * Thanh lọc: ô tìm nhanh (debounce 300ms, Enter áp ngay) + filter theo định nghĩa + "Xóa lọc".
 * Giá trị nằm trên URL qua useListState — component này không giữ state nguồn.
 */
export function FilterBar<F extends string = string>({
  q,
  onQChange,
  filters,
  values,
  onFilterChange,
  searchPlaceholder = 'Tìm nhanh…',
  right,
}: {
  q: string;
  onQChange: (q: string) => void;
  filters?: FilterDef<F>[];
  values: Partial<Record<F, string>>;
  onFilterChange: (patch: Partial<Record<F, string | undefined>>) => void;
  searchPlaceholder?: string;
  right?: ReactNode;
}) {
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => onQChange(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft, q, onQChange]);

  const active =
    Object.values(values).filter((v) => v !== undefined && v !== '').length + (q ? 1 : 0);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onQChange(draft.trim());
            if (e.key === 'Escape') setDraft('');
          }}
          placeholder={searchPlaceholder}
          aria-label="Tìm nhanh"
          className="w-64 pl-8"
        />
      </div>
      {filters?.map((f) => {
        const value = values[f.key];
        const set = (v: string | undefined) =>
          onFilterChange({ [f.key]: v } as Partial<Record<F, string | undefined>>);
        if (f.type === 'select') {
          return (
            <Select
              key={f.key}
              value={value ?? ALL}
              onValueChange={(v) => set(v === ALL ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-44" aria-label={f.label}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{f.label}: tất cả</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        if (f.type === 'custom') return <div key={f.key}>{f.render({ value, onChange: set })}</div>;
        return (
          <Input
            key={f.key}
            type={f.type === 'date' ? 'date' : 'text'}
            value={value ?? ''}
            onChange={(e) => set(e.target.value || undefined)}
            placeholder={f.placeholder ?? f.label}
            aria-label={f.label}
            className="h-9 w-44"
          />
        );
      })}
      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft('');
            onQChange('');
            const clear = {} as Partial<Record<F, string | undefined>>;
            for (const f of filters ?? []) clear[f.key] = undefined;
            onFilterChange(clear);
          }}
        >
          <X aria-hidden /> Xóa lọc ({active})
        </Button>
      ) : null}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
