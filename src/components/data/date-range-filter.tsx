'use client';

import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { toLocalDateKey } from '@/lib/format';
import { useSaveUserPreference, useUserPreference } from '@/lib/preferences';

/**
 * Bộ lọc khoảng ngày dùng chung (2026-10-22, mockup "Bộ lọc khoảng ngày" đã duyệt): nút trên thanh
 * lọc → hộp gồm khoảng chọn sẵn (trái), ô Từ ngày → Đến ngày, lịch 2 tháng, "Theo" (trường ngày,
 * khi màn có nhiều), "Ghi nhớ khoảng ngày cho lần sau" (lưu theo tài khoản qua /me/preferences),
 * Xóa ngày / Đóng / Áp dụng. Chỉ "Áp dụng" (hoặc Enter) mới đổi giá trị — danh sách không tải lại
 * theo từng cú bấm lịch. Giá trị là khoá `YYYY-MM-DD` giờ VN, gồm hai đầu; trống = mọi lúc.
 */
export interface DateRangeFilterValue {
  from?: string;
  to?: string;
}

export interface DateRangePresetOption {
  /** Khoá ổn định để "Ghi nhớ" lưu tương đối ("7 ngày qua" mai vẫn là 7 ngày tính tới mai). */
  key?: string;
  label: string;
  /** '' cả hai = mọi lúc. */
  from: string;
  to: string;
}

const isKey = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

const shift = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};
const between = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const weekday = (key: string): number => new Date(`${key}T00:00:00Z`).getUTCDay();

/** "2026-10-01" → "01/10/2026"; bỏ năm khi `short`. */
const show = (key: string, short = false) =>
  short
    ? `${key.slice(8, 10)}/${key.slice(5, 7)}`
    : `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** "01/10/2026" / "1/10/2026" / "2026-10-01" → khoá; sai → null. */
function parseTyped(raw: string): string | null {
  const s = raw.trim();
  if (isKey(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const key = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${key}T00:00:00Z`)) || shift(key, 0) !== key ? null : key;
}

const keyToDate = (k: string): Date => {
  const [y, m, d] = k.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(y!, m! - 1, d!);
};
const dateToKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Khoảng chọn sẵn chuẩn — bỏ những khoảng dài hơn `maxDays`; `includeAll` thêm "Mọi lúc". */
export function rangePresetOptions(
  today: string,
  opts: { includeAll?: boolean; maxDays?: number } = {},
): DateRangePresetOption[] {
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = shift(monthStart, -1);
  const all: DateRangePresetOption[] = [
    { key: 'today', label: 'Hôm nay', from: today, to: today },
    { key: 'yesterday', label: 'Hôm qua', from: shift(today, -1), to: shift(today, -1) },
    { key: 'last7', label: '7 ngày qua', from: shift(today, -6), to: today },
    { key: 'last30', label: '30 ngày qua', from: shift(today, -29), to: today },
    { key: 'last90', label: '90 ngày qua', from: shift(today, -89), to: today },
    {
      key: 'weekToDate',
      label: 'Đầu tuần đến nay',
      from: shift(today, -((weekday(today) + 6) % 7)),
      to: today,
    },
    { key: 'monthToDate', label: 'Đầu tháng đến nay', from: monthStart, to: today },
    {
      key: 'lastMonth',
      label: 'Tháng trước',
      from: `${lastMonthEnd.slice(0, 8)}01`,
      to: lastMonthEnd,
    },
  ];
  const fit = opts.maxDays ? all.filter((p) => between(p.from, p.to) < opts.maxDays!) : all;
  return opts.includeAll ? [...fit, { key: 'all', label: 'Mọi lúc', from: '', to: '' }] : fit;
}

interface RememberedRange {
  preset?: string;
  from?: string;
  to?: string;
  field?: string;
}

export function DateRangeFilter({
  label,
  value,
  onChange,
  required = false,
  maxDays,
  presets: presetsProp,
  fields,
  field,
  onFieldChange,
  rememberKey,
  today: todayProp,
  className,
}: {
  /** Tên trường ngày trên nút ("Ngày đặt", "Kỳ"…). */
  label: string;
  value: DateRangeFilterValue;
  onChange: (next: DateRangeFilterValue) => void;
  /** Màn bắt buộc có khoảng (báo cáo): không "Mọi lúc", không xóa. */
  required?: boolean;
  /** Trần số ngày (gồm hai đầu) API nhận — kéo đầu kia lại, ẩn khoảng chọn sẵn dài hơn. */
  maxDays?: number;
  /** Thay khoảng chọn sẵn chuẩn. */
  presets?: DateRangePresetOption[];
  /** "Theo": các trường ngày màn hỗ trợ (≥ 2 mới hiện). */
  fields?: Array<{ value: string; label: string }>;
  field?: string;
  onFieldChange?: (field: string) => void;
  /** Có → hiện "Ghi nhớ khoảng ngày cho lần sau", khôi phục khi mở màn chưa chọn ngày. */
  rememberKey?: string;
  today?: string;
  className?: string;
}) {
  const today = todayProp ?? toLocalDateKey(new Date()) ?? '';
  const presets = useMemo(
    () => presetsProp ?? rangePresetOptions(today, { includeAll: !required, maxDays }),
    [presetsProp, today, required, maxDays],
  );
  const from = isKey(value.from) ? value.from : '';
  const to = isKey(value.to) ? value.to : from;
  // Chưa chọn ngày → nút ghi "tất cả" (không phải "Mọi lúc" của khoảng chọn sẵn).
  const active = from ? presets.find((p) => p.from === from && p.to === to) : undefined;

  const remembered = useUserPreference<RememberedRange>(rememberKey);
  const saveRemembered = useSaveUserPreference<RememberedRange>(rememberKey);
  const hasRemembered = !!remembered.data && (!!remembered.data.preset || !!remembered.data.from);

  const resolve = (r: RememberedRange): DateRangeFilterValue | null => {
    if (r.preset) {
      const p = rangePresetOptions(today, { includeAll: true }).find((x) => x.key === r.preset);
      return p ? { from: p.from || undefined, to: p.to || undefined } : null;
    }
    return isKey(r.from) ? { from: r.from, to: isKey(r.to) ? r.to : r.from } : null;
  };

  // Khôi phục khoảng đã ghi nhớ — một lần, chỉ khi màn mở ra chưa có ngày (URL dán sẵn thì thắng).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !rememberKey || remembered.isPending) return;
    restored.current = true;
    if (from || !remembered.data) return;
    const r = resolve(remembered.data);
    if (r && (r.from || r.to)) onChange(r);
    if (remembered.data.field && onFieldChange && remembered.data.field !== field) {
      onFieldChange(remembered.data.field);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy đúng một lần khi tuỳ chọn về
  }, [rememberKey, remembered.isPending, remembered.data]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const [pickingEnd, setPickingEnd] = useState(false);
  const [draftField, setDraftField] = useState(field);
  const [remember, setRemember] = useState(false);
  const [typedFrom, setTypedFrom] = useState('');
  const [typedTo, setTypedTo] = useState('');
  const [month, setMonth] = useState<Date>(keyToDate(today));

  const reset = () => {
    setDraft({ from, to });
    setTypedFrom(from ? show(from) : '');
    setTypedTo(to ? show(to) : '');
    setPickingEnd(false);
    setDraftField(field);
    setRemember(hasRemembered);
    // Tháng trái = tháng trước của ngày cuối → hai tháng hiện đủ khoảng ngắn quanh hôm nay.
    const end = to || today;
    setMonth(keyToDate(`${shift(`${end.slice(0, 8)}01`, -1).slice(0, 8)}01`));
  };

  const clamp = (f: string, t: string, moved: 'from' | 'to'): { from: string; to: string } => {
    let a = f;
    let b = t;
    if (a && b && a > b) [a, b] = [b, a];
    if (maxDays && a && b && between(a, b) >= maxDays) {
      if (moved === 'from') b = shift(a, maxDays - 1);
      else a = shift(b, -(maxDays - 1));
    }
    return { from: a, to: b };
  };
  const setDraftRange = (r: { from: string; to: string }) => {
    setDraft(r);
    setTypedFrom(r.from ? show(r.from) : '');
    setTypedTo(r.to ? show(r.to) : '');
  };

  const pickDay = (d: Date) => {
    const k = dateToKey(d);
    if (!pickingEnd || !draft.from) {
      setDraftRange({ from: k, to: k });
      setPickingEnd(true);
    } else {
      setDraftRange(clamp(draft.from, k, 'to'));
      setPickingEnd(false);
    }
  };

  const draftPreset = presets.find((p) => p.from === draft.from && p.to === draft.to);
  const apply = () => {
    if (required && !draft.from) return;
    onChange({ from: draft.from || undefined, to: draft.to || draft.from || undefined });
    if (onFieldChange && draftField && draftField !== field) onFieldChange(draftField);
    if (rememberKey) {
      if (remember) {
        saveRemembered.mutate({
          ...(draftPreset?.key ? { preset: draftPreset.key } : { from: draft.from, to: draft.to }),
          ...(draftField ? { field: draftField } : {}),
        });
      } else if (hasRemembered) {
        saveRemembered.mutate({});
      }
    }
    setOpen(false);
  };

  const fieldLabel = fields?.find((f) => f.value === field)?.label ?? label;
  const shown = active
    ? active.label
    : from
      ? from === to
        ? show(from)
        : `${show(from, from.slice(0, 4) === to.slice(0, 4))} – ${show(to)}`
      : 'tất cả';
  const isSet = !required && !!from;
  const nights = draft.from && draft.to ? between(draft.from, draft.to) + 1 : 0;
  const titleId = useId();

  return (
    <div className={cn('relative inline-flex', className)}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o) reset();
          setOpen(o);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${fieldLabel}: ${shown}`}
            className={cn(
              'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border bg-card px-2.5 text-sm',
              isSet
                ? 'border-primary bg-secondary pr-8 text-primary'
                : 'border-control-border text-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-semibold">{fieldLabel}:</span>
            <span>{shown}</span>
            {isSet ? null : <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-0"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              apply();
            }
          }}
        >
          <span id={titleId} className="sr-only">
            Chọn khoảng {fieldLabel.toLowerCase()}
          </span>
          <div className="flex">
            <div
              className="flex w-44 flex-col gap-0.5 border-r p-2"
              role="group"
              aria-label="Khoảng chọn sẵn"
            >
              {presets.map((p) => {
                const on = draftPreset?.label === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setDraftRange({ from: p.from, to: p.to });
                      setPickingEnd(false);
                      if (p.to)
                        setMonth(keyToDate(`${shift(`${p.to.slice(0, 8)}01`, -1).slice(0, 8)}01`));
                    }}
                    className={cn(
                      'h-8 rounded-md px-2.5 text-left text-sm',
                      on ? 'bg-secondary font-semibold text-primary' : 'hover:bg-muted',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col">
              <div className="flex items-end gap-3 border-b px-4 py-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">Từ ngày</span>
                  <Input
                    value={typedFrom}
                    placeholder="dd/mm/yyyy"
                    onChange={(e) => setTypedFrom(e.target.value)}
                    onBlur={() => {
                      const k = parseTyped(typedFrom);
                      if (k) setDraftRange(clamp(k, draft.to || k, 'from'));
                      else setTypedFrom(draft.from ? show(draft.from) : '');
                    }}
                    inputMode="numeric"
                    aria-label="Từ ngày"
                  />
                </label>
                <span aria-hidden className="pb-1.5 text-muted-foreground">
                  →
                </span>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">Đến ngày</span>
                  <Input
                    value={typedTo}
                    placeholder="dd/mm/yyyy"
                    onChange={(e) => setTypedTo(e.target.value)}
                    onBlur={() => {
                      const k = parseTyped(typedTo);
                      if (k) setDraftRange(clamp(draft.from || k, k, 'to'));
                      else setTypedTo(draft.to ? show(draft.to) : '');
                    }}
                    inputMode="numeric"
                    aria-label="Đến ngày"
                  />
                </label>
                <span className="w-16 pb-1.5 text-sm text-muted-foreground">
                  {nights ? `${nights} ngày` : 'Mọi lúc'}
                </span>
              </div>
              <Calendar
                mode="range"
                numberOfMonths={2}
                month={month}
                onMonthChange={setMonth}
                selected={
                  draft.from
                    ? { from: keyToDate(draft.from), to: keyToDate(draft.to || draft.from) }
                    : undefined
                }
                onSelect={(_r, day) => pickDay(day)}
                disabled={{ after: keyToDate(today) }}
                className="relative px-4 py-3"
                classNames={{
                  months: 'flex gap-6',
                  range_middle: 'bg-secondary text-primary rounded-none',
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5">
            {fields && fields.length > 1 ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Theo</span>
                <Select value={draftField} onValueChange={setDraftField}>
                  <SelectTrigger className="w-40" aria-label="Lọc theo trường ngày">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            {rememberKey ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  aria-label="Ghi nhớ khoảng ngày cho lần sau"
                />
                Ghi nhớ khoảng ngày cho lần sau
              </label>
            ) : null}
            <span className="flex-1" />
            {required ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraftRange({ from: '', to: '' })}
              >
                Xóa ngày
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button type="button" onClick={apply} disabled={required && !draft.from}>
              Áp dụng
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {isSet ? (
        <button
          type="button"
          aria-label={`Xóa lọc ${fieldLabel.toLowerCase()}`}
          onClick={() => onChange({})}
          className="absolute right-2 top-2 rounded text-primary hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
