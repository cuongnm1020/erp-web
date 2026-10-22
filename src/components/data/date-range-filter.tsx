'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
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

/** Khoá ngày đầu tháng của `key` ("2026-10-22" → "2026-10-01"). */
const monthOf = (key: string) => `${key.slice(0, 8)}01`;
/** Cộng `n` tháng vào khoá đầu tháng. */
const addMonths = (month: string, n: number): string => {
  const y = Number.parseInt(month.slice(0, 4), 10);
  const m = Number.parseInt(month.slice(5, 7), 10) - 1 + n;
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
};
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** 42 ô (6 tuần, tuần bắt đầu thứ 2) của tháng `month` (khoá ngày 01). */
function monthCells(month: string): Array<{ key: string; inMonth: boolean }> {
  const lead = (weekday(month) + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const key = shift(month, i - lead);
    return { key, inMonth: key.slice(0, 7) === month.slice(0, 7) };
  });
}

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
  // Tháng bên trái của lịch 2 tháng (khoá ngày 01).
  const [month, setMonth] = useState(monthOf(today));

  const reset = () => {
    setDraft({ from, to });
    setTypedFrom(from ? show(from) : '');
    setTypedTo(to ? show(to) : '');
    setPickingEnd(false);
    setDraftField(field);
    setRemember(hasRemembered);
    // Tháng trái = tháng của ngày cuối (thiết kế: khoảng 01/10–22/10 nằm ở tháng trái).
    setMonth(monthOf(to || today));
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

  const pickDay = (k: string) => {
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
  const range = from
    ? from === to
      ? show(from)
      : `${show(from, from.slice(0, 4) === to.slice(0, 4))} – ${show(to)}`
    : '';
  // Màn bắt buộc có kỳ (báo cáo) ghi cả tên khoảng lẫn ngày: "Tháng này · 01/10 – 22/10".
  const shown = active
    ? required && range
      ? `${active.label} · ${range}`
      : active.label
    : from
      ? from === to
        ? show(from)
        : `${show(from, from.slice(0, 4) === to.slice(0, 4))} – ${show(to)}`
      : 'tất cả';
  const isSet = !required && !!from;
  const nights = draft.from && draft.to ? between(draft.from, draft.to) + 1 : 0;
  const titleId = useId();

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      {/* Nút trên thanh lọc (thiết kế "Nút trên thanh lọc — các trạng thái"): chưa chọn = viền
          control; đã chọn = viền + chữ primary trên nền secondary, có × xóa; đang mở = viền
          primary + vòng secondary. × là nút riêng nên cả cụm là Anchor, không lồng button. */}
      <PopoverAnchor asChild>
        <div
          className={cn(
            'inline-flex h-control items-center whitespace-nowrap rounded-md border text-sm',
            isSet
              ? 'border-primary bg-secondary text-primary'
              : 'border-control-border bg-card text-foreground',
            open && 'border-primary ring-2 ring-secondary',
            className,
          )}
        >
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${fieldLabel}: ${shown}`}
            onClick={() => {
              if (!open) reset();
              setOpen(!open);
            }}
            className="flex h-full items-center gap-1.5 rounded-md pl-2.5 pr-1.5"
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-semibold">{fieldLabel}:</span>
            <span>{shown}</span>
          </button>
          {isSet ? (
            <button
              type="button"
              aria-label={`Xóa lọc ${fieldLabel.toLowerCase()}`}
              onClick={() => onChange({})}
              className="flex h-full items-center px-0.5 text-subtle-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <ChevronDown
            className="mr-2 h-3.5 w-3.5 shrink-0 text-subtle-foreground"
            aria-hidden
            onClick={() => {
              if (!open) reset();
              setOpen(!open);
            }}
          />
        </div>
      </PopoverAnchor>
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
                    if (p.to) setMonth(monthOf(p.to));
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
                  className={cn(!pickingEnd && 'border-primary ring-2 ring-secondary')}
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
                  className={cn(pickingEnd && 'border-primary ring-2 ring-secondary')}
                />
              </label>
              <span className="w-16 whitespace-nowrap pb-1.5 text-sm text-muted-foreground">
                {nights ? `${nights} ngày` : 'Mọi lúc'}
              </span>
            </div>
            <div className="flex gap-6 px-4 py-3">
              {[0, 1].map((i) => (
                <MonthGrid
                  key={i}
                  month={addMonths(month, i)}
                  from={draft.from}
                  to={draft.to || draft.from}
                  today={today}
                  onPick={pickDay}
                  onPrev={i === 0 ? () => setMonth(addMonths(month, -1)) : undefined}
                  onNext={i === 1 ? () => setMonth(addMonths(month, 1)) : undefined}
                />
              ))}
            </div>
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
          <Button type="button" onClick={apply} disabled={required && !draft.from} shortcut="Enter">
            Áp dụng
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Một tháng của lịch khoảng ngày (thiết kế "Hộp chọn khoảng ngày"): tiêu đề "Tháng 10 / 2026",
 * mũi tên lùi ở tháng trái / tới ở tháng phải, thứ T2…CN, ô 32×28 bo 4px; hai đầu khoảng nền
 * primary chữ trắng đậm, giữa khoảng một dải nền secondary liền nhau; ngày ngoài tháng chữ nhạt,
 * không bấm. Mũi tên ←→↑↓ đi giữa các ngày (cùng tháng).
 */
function MonthGrid({
  month,
  from,
  to,
  today,
  onPick,
  onPrev,
  onNext,
}: {
  month: string;
  from: string;
  to: string;
  today: string;
  onPick: (key: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const cells = monthCells(month);
  const title = `Tháng ${Number.parseInt(month.slice(5, 7), 10)} / ${month.slice(0, 4)}`;
  const hasRange = !!from && !!to && from !== to;
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const current = (e.target as HTMLElement).dataset.day;
    if (!step || !current) return;
    const next = e.currentTarget.querySelector<HTMLButtonElement>(
      `[data-day="${shift(current, step)}"]`,
    );
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-7 items-center justify-between">
        <NavButton label="Xem tháng trước" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </NavButton>
        <span className="text-sm font-semibold">{title}</span>
        <NavButton label="Xem tháng sau" onClick={onNext}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </NavButton>
      </div>
      <div
        className="grid grid-cols-7 gap-y-0.5"
        role="group"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            aria-hidden
            className="flex h-7 w-12 items-center justify-center text-xs font-semibold text-muted-foreground"
          >
            {w}
          </span>
        ))}
        {cells.map(({ key, inMonth }) => {
          const day = Number.parseInt(key.slice(8, 10), 10);
          if (!inMonth) {
            return (
              <span
                key={key}
                aria-hidden
                className="flex h-7 w-12 items-center justify-center text-sm text-input"
              >
                {day}
              </span>
            );
          }
          const isStart = !!from && key === from;
          const isEnd = !!to && key === to;
          const inside = hasRange && key > from && key < to;
          return (
            <span
              key={key}
              className={cn(
                'relative flex h-7 w-12 items-center justify-center',
                inside && 'bg-secondary',
              )}
            >
              {hasRange && (isStart || isEnd) ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 w-1/2 bg-secondary',
                    isStart ? 'right-0' : 'left-0',
                  )}
                />
              ) : null}
              <button
                type="button"
                data-day={key}
                aria-label={show(key)}
                aria-pressed={isStart || isEnd || inside}
                aria-current={key === today ? 'date' : undefined}
                onClick={() => onPick(key)}
                className={cn(
                  'relative z-10 flex h-7 w-8 items-center justify-center rounded-md text-sm tabular-nums',
                  isStart || isEnd
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  isEnd && hasRange && 'ring-2 ring-secondary',
                  key === today && !(isStart || isEnd) && 'font-semibold text-primary',
                )}
              >
                {day}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Mũi tên chuyển tháng — phía không có mũi tên giữ một ô trống để tiêu đề luôn ở giữa. */
function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (!onClick) return <span aria-hidden className="h-7 w-7" />;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}
