'use client';

import { DateRangeFilter } from './date-range-filter';

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

/**
 * Khoảng ngày BẮT BUỘC (báo cáo, khách của team…) — từ 2026-10-22 hiện bằng bộ lọc khoảng ngày
 * dùng chung (nút + hộp lịch 2 tháng, khoảng chọn sẵn, Áp dụng). Giữ chữ ký cũ cho màn đang gọi.
 */
export function DateRangePicker({
  value,
  onChange,
  today,
  maxDays,
  presets,
  label = 'Kỳ',
  rememberKey,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Khoá hôm nay (giờ VN) — chặn chọn ngày tương lai. */
  today: string;
  /** Trần số ngày (gồm hai đầu) của API. */
  maxDays: number;
  /** Thay khoảng chọn sẵn chuẩn (Hôm nay … Tháng trước). */
  presets?: DateRangePreset[];
  label?: string;
  rememberKey?: string;
}) {
  return (
    <DateRangeFilter
      label={label}
      required
      today={today}
      maxDays={maxDays}
      presets={presets}
      rememberKey={rememberKey}
      value={value}
      onChange={(r) => {
        if (r.from) onChange({ from: r.from, to: r.to ?? r.from });
      }}
    />
  );
}
