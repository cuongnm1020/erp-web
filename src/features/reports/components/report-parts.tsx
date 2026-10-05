'use client';

import { Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatMoney, toDecimal } from '@/lib/format';
import type { Granularity } from '../api/use-sales-report';

/** "54.29" → "54,29%"; null → "—". */
export const pct = (v: string | null) => (v === null ? '—' : `${v.replace('.', ',')}%`);

export const money = (v: string) => <span className="tabular-nums">{formatMoney(v)}</span>;

export const profitCell = (v: string) => (
  <span className={cn('font-semibold tabular-nums', v.startsWith('-') && 'text-destructive')}>
    {formatMoney(v)}
  </span>
);

/** Số nguyên (số đơn, số khách) nhóm nghìn kiểu VN. */
export const count = (n: number) => (
  <span className="tabular-nums">{formatMoney(String(n), { unit: '' })}</span>
);

/** Tiền làm tròn đồng cho CSV — chuỗi số thuần, Excel đọc được. */
export const csvMoney = (v: string) => toDecimal(v)?.toFixed(0) ?? '';

/** Số lượng cho CSV — bỏ số 0 thừa, dấu chấm thập phân. */
export const csvQty = (v: string) => toDecimal(v)?.toString() ?? '';

/** Tên nhóm; id null = "Chưa gán" / "Chưa phân loại" (tên do API đặt) — in nghiêng, nhạt. */
export function GroupKeyLabel({
  id,
  name,
  code,
  fallback = 'Chưa gán',
}: {
  id: string | null;
  name: string;
  code?: string | null;
  fallback?: string;
}) {
  if (id === null) {
    return <span className="italic text-muted-foreground">{name || fallback}</span>;
  }
  return (
    <span className="flex flex-col">
      <span>{name}</span>
      {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
    </span>
  );
}

/** Nhãn kỳ theo độ chia: ngày 01/10 · tuần từ 29/09 · tháng 10/2026. */
export function periodLabel(period: string, g: Granularity): string {
  const [y, m, d] = period.split('-');
  if (g === 'month') return `${m}/${y}`;
  if (g === 'week') return `Tuần ${d}/${m}`;
  return `${d}/${m}`;
}

export function rangeLabel(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}

/** dataAsOf khác null = số đọc từ bảng tổng hợp ngày (tính lại mỗi 5 phút). */
export function DataAsOfNotice({
  dataAsOf,
  previousFrom,
  previousTo,
}: {
  dataAsOf: string | null;
  previousFrom: string;
  previousTo: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      So với kỳ trước {rangeLabel(previousFrom, previousTo)}.{' '}
      {dataAsOf ? (
        <span>
          Số liệu tính đến <span className="font-semibold">{formatDateTime(dataAsOf)}</span> (bảng
          tổng hợp, cập nhật mỗi 5 phút; số khách luôn đếm tức thời).
        </span>
      ) : (
        <span>Số liệu tức thời.</span>
      )}
    </p>
  );
}

export function ExportButton({
  onClick,
  pending = false,
  label = 'Xuất CSV',
  title,
}: {
  onClick: () => void;
  pending?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending} title={title}>
      <Download aria-hidden />
      {pending ? 'Đang xuất…' : label}
    </Button>
  );
}

/** Nhóm nút chọn một (segmented) — giá trị nằm trên URL ở màn gọi. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, ReactNode]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={value === key ? 'default' : 'outline'}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
