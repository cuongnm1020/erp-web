'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { DateRangeFilter } from '@/components/data/date-range-filter';
import { DraftInput } from '@/components/data/draft-input';
import { SearchableMultiSelect } from '@/components/data/searchable-multi-select';
import { SearchableSelect } from '@/components/data/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type FilterDef<F extends string = string> = FilterDefCommon<F> &
  (
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
      }
  );

/** Phần dùng khi thanh lọc có `pinned` (design system FilterBar, 2026-11-03). */
interface FilterDefCommon<F extends string> {
  /** Tiêu đề nhóm trong panel "Bộ lọc khác". */
  group?: string;
  /**
   * Chữ giá trị trên chip "Đang lọc" cho ô `custom` (select / multiSelect / text tự suy từ
   * options). `null` / bỏ trống = ô custom không có chip.
   */
  chip?: string | null;
  /** Khoá URL khác bỏ cùng khi bấm × trên chip (vd cận trên của khoảng giá trị). */
  clearKeys?: F[];
}

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
  pinned,
  secondRow,
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
  /**
   * Thanh một hàng (2026-11-03): chỉ ô khoảng ngày + các ô này nằm trên thanh, còn lại vào panel
   * "Bộ lọc khác (n)"; dưới `lg` ô ghim cũng vào panel. Có `pinned` thì thêm dòng chip "Đang lọc".
   * Bỏ trống = bày mọi ô như cũ.
   */
  pinned?: F[];
  /**
   * Chỉ dùng cùng `pinned` (2026-11-03): các ô này luôn hiện ở hàng thứ hai của thanh (mọi bề
   * rộng), không vào panel — ô nhập khoảng giá trị / cân nặng cần thấy ngay.
   */
  secondRow?: F[];
}) {
  const active =
    Object.entries(values).filter(
      // Ngày cuối của khoảng ngày đi cùng ngày đầu — một bộ lọc, đếm một lần.
      ([k, v]) =>
        v !== undefined &&
        v !== '' &&
        !(filters ?? []).some((f) => f.type === 'dateRange' && f.toKey === k && values[f.key]),
    ).length + (q ? 1 : 0);

  const clearAll = () => {
    onQChange('');
    const clear = {} as Partial<Record<F, string | undefined>>;
    for (const f of filters ?? []) {
      clear[f.key] = undefined;
      if (f.type === 'dateRange') clear[f.toKey] = undefined;
      for (const k of f.clearKeys ?? []) clear[k] = undefined;
    }
    // Cả các filter màn hình tự vẽ ngoài FilterBar (tab trạng thái, chip khách…)
    // miễn là có mặt trong `values` — không thì "Xóa lọc" đếm mà không xóa được.
    for (const k of Object.keys(values) as F[]) clear[k] = undefined;
    onFilterChange(clear);
  };

  const renderFilter = (f: FilterDef<F>) => {
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
  };

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
      {pinned ? (
        <PinnedFilters
          filters={filters ?? []}
          pinned={pinned}
          secondRow={secondRow ?? []}
          values={values}
          renderFilter={renderFilter}
          onClear={clearAll}
        />
      ) : (
        filters?.map(renderFilter)
      )}
      {after}
      {active > 0 && !pinned ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X aria-hidden /> Xóa lọc ({active})
        </Button>
      ) : null}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
      {pinned && secondRow?.length ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          {(filters ?? []).filter((f) => secondRow.includes(f.key)).map(renderFilter)}
        </div>
      ) : null}
      {pinned ? (
        <ActiveFilterChips
          filters={filters ?? []}
          values={values}
          onFilterChange={onFilterChange}
          onClearAll={clearAll}
        />
      ) : null}
    </div>
  );
}

/** Ô ghim trên thanh (từ `lg`) + nút "Bộ lọc khác (n)" mở panel chứa phần còn lại. */
function PinnedFilters<F extends string>({
  filters: all,
  pinned,
  secondRow,
  values,
  renderFilter,
  onClear,
}: {
  filters: FilterDef<F>[];
  pinned: F[];
  secondRow: F[];
  values: Partial<Record<F, string>>;
  renderFilter: (f: FilterDef<F>) => ReactNode;
  onClear: () => void;
}) {
  // Ô hàng hai do FilterBar vẽ riêng — không lên hàng một, không vào panel.
  const filters = all.filter((f) => !secondRow.includes(f.key));
  const onBar = (f: FilterDef<F>) => f.type === 'dateRange' || pinned.includes(f.key);
  const dates = filters.filter((f) => f.type === 'dateRange');
  const pins = filters.filter((f) => f.type !== 'dateRange' && pinned.includes(f.key));
  const rest = filters.filter((f) => !onBar(f));
  const inPanel = rest.filter((f) => isActive(f, values)).length;
  if (!rest.length && !pins.length) return <>{dates.map(renderFilter)}</>;
  // Nhóm theo `group` giữ thứ tự xuất hiện; ô ghim đứng nhóm riêng, chỉ hiện dưới `lg`.
  const groups: Array<{ title: string; items: FilterDef<F>[]; pinnedGroup?: boolean }> = [];
  if (pins.length) groups.push({ title: 'Lọc nhanh', items: pins, pinnedGroup: true });
  for (const f of rest) {
    const title = f.group ?? 'Khác';
    const g = groups.find((x) => !x.pinnedGroup && x.title === title);
    if (g) g.items.push(f);
    else groups.push({ title, items: [f] });
  }
  return (
    <>
      {dates.map(renderFilter)}
      {pins.map((f) => (
        <div key={f.key} className="hidden lg:block">
          {renderFilter(f)}
        </div>
      ))}
      {rest.length || pins.length ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" aria-label="Bộ lọc khác">
              <SlidersHorizontal aria-hidden />
              <span className="hidden sm:inline">Bộ lọc khác</span>
              {inPanel > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-primary-foreground">
                  {inPanel}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-4xl p-0">
            <div className="border-b px-3.5 py-2.5 text-sm font-semibold">Bộ lọc khác</div>
            <div className="grid gap-4 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div
                  key={g.title}
                  className={
                    g.pinnedGroup
                      ? 'grid content-start gap-2 lg:hidden'
                      : 'grid content-start gap-2'
                  }
                >
                  <div className="text-xs font-semibold text-muted-foreground">{g.title}</div>
                  {g.items.map((f) => (
                    <div key={f.key}>{renderFilter(f)}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t bg-muted px-3.5 py-2.5">
              <Button variant="outline" size="sm" onClick={onClear}>
                Xóa lọc
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}

function isActive<F extends string>(f: FilterDef<F>, values: Partial<Record<F, string>>): boolean {
  if (f.type === 'dateRange') return !!(values[f.key] || values[f.toKey]);
  if (f.type === 'custom') return f.chip != null && f.chip !== '';
  const v = values[f.key];
  return v !== undefined && v !== '';
}

/** Chữ giá trị trên chip — null = không có chip (ô ngày đã hiện trên thanh). */
function chipText<F extends string>(
  f: FilterDef<F>,
  values: Partial<Record<F, string>>,
): string | null {
  if (f.type === 'dateRange') return null;
  if (f.type === 'custom') return f.chip ?? null;
  const v = values[f.key];
  if (v === undefined || v === '') return null;
  if (f.type === 'select') return f.options.find((o) => o.value === v)?.label ?? v;
  if (f.type === 'multiSelect') {
    const vs = v.split(',').filter(Boolean);
    if (vs.length === 1) return f.options.find((o) => o.value === vs[0])?.label ?? vs[0]!;
    return `${vs.length} ${f.unit ?? 'mục'}`;
  }
  return v;
}

/** Dòng "Đang lọc": mỗi lọc đang bật một chip, × bỏ đúng lọc đó; cuối dòng "Xóa tất cả lọc". */
function ActiveFilterChips<F extends string>({
  filters,
  values,
  onFilterChange,
  onClearAll,
}: {
  filters: FilterDef<F>[];
  values: Partial<Record<F, string>>;
  onFilterChange: (patch: Partial<Record<F, string | undefined>>) => void;
  onClearAll: () => void;
}) {
  const chips = filters.flatMap((f) => {
    const text = chipText(f, values);
    return text ? [{ f, text }] : [];
  });
  if (!chips.length) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 text-sm">
      <span className="text-xs font-semibold text-muted-foreground">Đang lọc</span>
      {chips.map(({ f, text }) => (
        <span
          key={f.key}
          className="flex h-6 items-center gap-1 rounded-full bg-secondary pl-2.5 pr-0.5 text-primary"
        >
          {f.label}: <span className="font-semibold">{text}</span>
          <button
            type="button"
            aria-label={`Bỏ lọc ${f.label}`}
            className="grid h-5 w-5 place-items-center rounded-full hover:bg-card"
            onClick={() => {
              const patch = { [f.key]: undefined } as Partial<Record<F, string | undefined>>;
              for (const k of f.clearKeys ?? []) patch[k] = undefined;
              onFilterChange(patch);
            }}
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Button variant="link" size="sm" onClick={onClearAll}>
        Xóa tất cả lọc
      </Button>
    </div>
  );
}
