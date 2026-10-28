'use client';

import { Search, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { DateRangeFilter } from '@/components/data/date-range-filter';
import { DraftInput } from '@/components/data/draft-input';
import { SearchableMultiSelect } from '@/components/data/searchable-multi-select';
import { SearchableSelect } from '@/components/data/searchable-select';
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
  | {
      key: F;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }>;
      /** Danh sách dài (vd mọi POS Pancake) → ô chọn có ô gõ tìm theo tên, không phân biệt dấu. */
      searchable?: boolean;
    }
  | {
      /** Chọn nhiều + ô tìm; URL giữ các giá trị nối bằng dấu phẩy (2026-10-26, lọc page). */
      key: F;
      label: string;
      type: 'multiSelect';
      options: Array<{ value: string; label: string; hint?: string }>;
      /** Đơn vị trên nút khi chọn từ 2 mục ("Page: 2 page"). */
      unit?: string;
    }
  | { key: F; label: string; type: 'text'; placeholder?: string }
  | { key: F; label: string; type: 'date'; placeholder?: string }
  | {
      /** Khoá URL ngày đầu; `toKey` = khoá ngày cuối (2026-10-22, bộ lọc khoảng ngày dùng chung). */
      key: F;
      toKey: F;
      label: string;
      type: 'dateRange';
      /** Lưu "Ghi nhớ khoảng ngày" theo tài khoản dưới khoá này. */
      rememberKey?: string;
      maxDays?: number;
      /**
       * Lọc theo trường ngày nào (ô "Theo" trong popover, ≥ 2 trường mới hiện): khoá URL giữ
       * trường đang chọn + danh sách; khoá trống = trường đầu danh sách.
       */
      fieldKey?: F;
      fields?: Array<{ value: string; label: string }>;
    }
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
  after,
  right,
}: {
  q: string;
  onQChange: (q: string) => void;
  filters?: FilterDef<F>[];
  values: Partial<Record<F, string>>;
  onFilterChange: (patch: Partial<Record<F, string | undefined>>) => void;
  searchPlaceholder?: string;
  /** Ngay sau ô lọc cuối, trước "Xóa lọc" — vd nút "Thêm lọc" bật lọc ít dùng. */
  after?: ReactNode;
  right?: ReactNode;
}) {
  const active =
    Object.entries(values).filter(
      // Ngày cuối của khoảng ngày đi cùng ngày đầu — một bộ lọc, đếm một lần.
      ([k, v]) =>
        v !== undefined &&
        v !== '' &&
        !(filters ?? []).some((f) => f.type === 'dateRange' && f.toKey === k && values[f.key]),
    ).length + (q ? 1 : 0);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <DraftInput
          value={q}
          onCommit={onQChange}
          clearOnEscape
          placeholder={searchPlaceholder}
          aria-label="Tìm nhanh"
          className="w-64 pl-8"
        />
      </div>
      {filters?.map((f) => {
        const value = values[f.key];
        const set = (v: string | undefined) =>
          onFilterChange({ [f.key]: v } as Partial<Record<F, string | undefined>>);
        if (f.type === 'select' && f.searchable) {
          return (
            <SearchableSelect
              key={f.key}
              label={f.label}
              value={value}
              options={f.options}
              onChange={set}
            />
          );
        }
        if (f.type === 'multiSelect') {
          return (
            <SearchableMultiSelect
              key={f.key}
              label={f.label}
              unit={f.unit}
              values={value ? value.split(',') : []}
              options={f.options}
              onChange={(vs) => set(vs.length ? vs.join(',') : undefined)}
            />
          );
        }
        if (f.type === 'select') {
          return (
            <Select
              key={f.key}
              value={value ?? ALL}
              onValueChange={(v) => set(v === ALL ? undefined : v)}
            >
              <SelectTrigger className="h-8 w-44" aria-label={f.label}>
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
        if (f.type === 'dateRange') {
          return (
            <DateRangeFilter
              key={f.key}
              label={f.label}
              rememberKey={f.rememberKey}
              maxDays={f.maxDays}
              {...(f.fieldKey && f.fields
                ? {
                    fields: f.fields,
                    field: values[f.fieldKey] ?? f.fields[0]?.value,
                    onFieldChange: (v: string) =>
                      onFilterChange({
                        [f.fieldKey as F]: v === f.fields?.[0]?.value ? undefined : v,
                      } as Partial<Record<F, string | undefined>>),
                  }
                : {})}
              value={{ from: value, to: values[f.toKey] }}
              onChange={(r) =>
                onFilterChange({ [f.key]: r.from, [f.toKey]: r.to } as Partial<
                  Record<F, string | undefined>
                >)
              }
            />
          );
        }
        if (f.type === 'date') {
          return (
            <Input
              key={f.key}
              type="date"
              value={value ?? ''}
              onChange={(e) => set(e.target.value || undefined)}
              placeholder={f.placeholder ?? f.label}
              aria-label={f.label}
              className="h-8 w-44"
            />
          );
        }
        return (
          <DraftInput
            key={f.key}
            value={value ?? ''}
            onCommit={(v) => set(v || undefined)}
            placeholder={f.placeholder ?? f.label}
            aria-label={f.label}
            className="h-8 w-44"
          />
        );
      })}
      {after}
      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onQChange('');
            const clear = {} as Partial<Record<F, string | undefined>>;
            for (const f of filters ?? []) {
              clear[f.key] = undefined;
              if (f.type === 'dateRange') clear[f.toKey] = undefined;
            }
            // Cả các filter màn hình tự vẽ ngoài FilterBar (tab trạng thái, chip khách…)
            // miễn là có mặt trong `values` — không thì "Xóa lọc" đếm mà không xóa được.
            for (const k of Object.keys(values) as F[]) clear[k] = undefined;
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
