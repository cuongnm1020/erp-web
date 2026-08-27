import { EMPTY } from './money';

/**
 * Ngày giờ (luật 10): API trả ISO UTC; hiển thị theo Asia/Ho_Chi_Minh qua đây.
 * Không dùng new Date(x).toLocaleDateString() ngoài file này. Không thêm lib ngày.
 */
export const TZ = 'Asia/Ho_Chi_Minh';

export type DateInput = string | Date | number | null | undefined;

export function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const parts = (d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
};

/** 23/08/2026 */
export function formatDate(v: DateInput): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  const p = parts(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.day}/${p.month}/${p.year}`;
}

/** 23/08/2026 14:05 */
export function formatDateTime(v: DateInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  const p = parts(d, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const hh = p.hour === '24' ? '00' : p.hour;
  return `${p.day}/${p.month}/${p.year} ${hh}:${p.minute}${opts.seconds ? `:${p.second}` : ''}`;
}

/** 14:05 */
export function formatTime(v: DateInput): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  const p = parts(d, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

/** Ngày theo múi giờ VN dạng yyyy-mm-dd — cho input[type=date] và query theo ngày. */
export function toLocalDateKey(v: DateInput): string | null {
  const d = toDate(v);
  if (!d) return null;
  const p = parts(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "vừa xong", "5 phút trước", "2 giờ trước", "hôm qua", ngoài 7 ngày → formatDate. */
export function formatRelative(v: DateInput, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  const diff = now.getTime() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const min = 60_000;
  if (abs < min) return 'vừa xong';
  if (abs < 60 * min) return `${Math.floor(abs / min)} phút ${future ? 'nữa' : 'trước'}`;
  if (abs < 24 * 60 * min) return `${Math.floor(abs / (60 * min))} giờ ${future ? 'nữa' : 'trước'}`;
  const days = Math.floor(abs / (24 * 60 * min));
  if (days === 1) return future ? 'ngày mai' : 'hôm qua';
  if (days < 7) return `${days} ngày ${future ? 'nữa' : 'trước'}`;
  return formatDate(d);
}
