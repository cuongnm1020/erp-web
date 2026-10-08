'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Chọn một ngày hoặc khoảng ngày (khoá `YYYY-MM-DD` theo giờ VN, gồm cả hai đầu) + preset.
 * Một ngày = from = to. Component không giữ state nguồn — giá trị nằm trên URL ở màn gọi.
 * Khoảng vượt `maxDays` được kéo đầu kia lại để không bắn 422 lên API.
 */
export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangePreset extends DateRange {
  label: string;
}

/** Cộng/trừ ngày trên khoá ngày (thuần UTC, không lệch múi giờ). */
export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Số ngày giữa hai khoá (to − from); cùng ngày = 0. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const isDateKey = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Preset chuẩn: Hôm nay / Hôm qua / 7 ngày / Tháng này / Tháng trước. */
export function defaultRangePresets(today: string): DateRangePreset[] {
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = shiftDay(monthStart, -1);
  const yesterday = shiftDay(today, -1);
  return [
    { label: 'Hôm nay', from: today, to: today },
    { label: 'Hôm qua', from: yesterday, to: yesterday },
    { label: '7 ngày', from: shiftDay(today, -6), to: today },
    { label: 'Tháng này', from: monthStart, to: today },
    { label: 'Tháng trước', from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
  ];
}

/**
 * Đọc khoảng từ URL: thiếu / sai định dạng → mặc định; from > to → đổi chỗ; quá `maxDays` → cắt
 * `from` về cho vừa.
 */
export function normalizeRange(
  raw: { from?: string; to?: string },
  fallback: DateRange,
  maxDays: number,
): DateRange {
  let from = isDateKey(raw.from) ? raw.from : fallback.from;
  let to = isDateKey(raw.to) ? raw.to : fallback.to;
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) >= maxDays) from = shiftDay(to, -(maxDays - 1));
  return { from, to };
}

export function DateRangePicker({
  value,
  onChange,
  today,
  maxDays,
  presets = defaultRangePresets(today),
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Khoá hôm nay (giờ VN) — chặn chọn ngày tương lai. */
  today: string;
  /** Trần số ngày (gồm hai đầu) của API. */
  maxDays: number;
  presets?: DateRangePreset[];
}) {
  const { from, to } = value;
  const activePreset = presets.find((p) => p.from === from && p.to === to);
  const onFrom = (v: string) => {
    if (!isDateKey(v)) return;
    const t = v > to ? v : daysBetween(v, to) >= maxDays ? shiftDay(v, maxDays - 1) : to;
    onChange({ from: v, to: t });
  };
  const onTo = (v: string) => {
    if (!isDateKey(v)) return;
    const f = v < from ? v : daysBetween(from, v) >= maxDays ? shiftDay(v, -(maxDays - 1)) : from;
    onChange({ from: f, to: v });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Chọn nhanh khoảng ngày">
        {presets.map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant={activePreset?.label === p.label ? 'default' : 'outline'}
            aria-pressed={activePreset?.label === p.label}
            onClick={() => onChange({ from: p.from, to: p.to })}
          >
            {p.label}
          </Button>
        ))}
        {activePreset ? null : (
          <span className="inline-flex h-8 items-center rounded-md bg-secondary px-3 text-xs font-semibold text-secondary-foreground">
            Tùy chọn
          </span>
        )}
      </div>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        Từ ngày
        <Input
          type="date"
          className="h-8 w-40"
          value={from}
          max={today}
          onChange={(e) => onFrom(e.target.value)}
          aria-label="Từ ngày"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        Đến ngày
        <Input
          type="date"
          className="h-8 w-40"
          value={to}
          max={today}
          onChange={(e) => onTo(e.target.value)}
          aria-label="Đến ngày"
        />
      </label>
    </div>
  );
}
