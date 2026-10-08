'use client';

import Decimal from 'decimal.js';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { toDecimal } from '@/lib/format';

/**
 * Biểu đồ tối giản (SVG + CSS, không thêm thư viện): đường so sánh kỳ này / kỳ trước và thanh
 * ngang xếp hạng. Giá trị vào là chuỗi decimal của API; chỉ đổi sang number để tính TOẠ ĐỘ vẽ —
 * số hiển thị luôn đi qua `format` của màn gọi (luật 10). Một trục duy nhất; màu theo token.
 */

/* ───────────────────────── Đường so sánh ───────────────────────── */

export interface ComparisonPoint {
  /** Khoá ổn định của điểm (period). */
  key: string;
  /** Nhãn trục X kỳ này. */
  label: string;
  current: string | null;
  previous: string | null;
  /** Nhãn kỳ trước tương ứng (tooltip). */
  previousLabel?: string;
}

const VB_W = 1000;
const VB_H = 240;

/** Bước chia "đẹp" 1 / 2 / 2,5 / 5 × 10^n. */
function niceStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/** Chỉ để tính toạ độ — không hiển thị, không cộng dồn tiền. */
const geom = (v: string | null): number | null => toDecimal(v)?.toNumber() ?? null;

export function ComparisonLineChart({
  points,
  format,
  currentLabel = 'Kỳ này',
  previousLabel = 'Kỳ trước',
  ariaLabel,
  tooltipExtra,
  className,
}: {
  points: ComparisonPoint[];
  format: (v: string) => string;
  currentLabel?: string;
  previousLabel?: string;
  ariaLabel: string;
  /** Dòng thêm trong tooltip (ví dụ % tăng/giảm). */
  tooltipExtra?: (p: ComparisonPoint) => ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;

  const scale = useMemo(() => {
    const vals = points.flatMap((p) => [geom(p.current), geom(p.previous)]);
    const nums = vals.filter((v): v is number => v !== null);
    const max = Math.max(0, ...nums);
    const min = Math.min(0, ...nums);
    const step = niceStep((max - min) / 4 || 1);
    const top = Math.ceil(max / step) * step || step;
    const bottom = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let t = bottom; t <= top + step / 2; t += step) ticks.push(t);
    return { top, bottom, ticks };
  }, [points]);

  const xPct = (i: number) => ((i + 0.5) / Math.max(n, 1)) * 100;
  const yPct = (v: number) => ((scale.top - v) / (scale.top - scale.bottom || 1)) * 100;
  const path = (pick: (p: ComparisonPoint) => string | null) => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = geom(pick(p));
      if (v === null) {
        pen = false;
        return;
      }
      const x = (xPct(i) / 100) * VB_W;
      const y = (yPct(v) / 100) * VB_H;
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const tickLabel = (t: number) => format(new Decimal(t).toFixed(4));
  const activePoint = active === null ? null : points[active];

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="8" aria-hidden className="stroke-primary">
            <line x1="0" y1="4" x2="20" y2="4" strokeWidth="2" />
          </svg>
          {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="8" aria-hidden className="stroke-muted-foreground">
            <line x1="0" y1="4" x2="20" y2="4" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {previousLabel}
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div className="relative h-56 w-24 shrink-0" aria-hidden>
          {scale.ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ top: `${yPct(t)}%` }}
            >
              {tickLabel(t)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative h-56" role="img" aria-label={ariaLabel}>
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              {scale.ticks.map((t) => (
                <line
                  key={t}
                  x1="0"
                  x2={VB_W}
                  y1={(yPct(t) / 100) * VB_H}
                  y2={(yPct(t) / 100) * VB_H}
                  className={t === 0 ? 'stroke-muted-foreground/60' : 'stroke-border'}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                d={path((p) => p.previous)}
                fill="none"
                className="stroke-muted-foreground"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={path((p) => p.current)}
                fill="none"
                className="stroke-primary"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {activePoint && active !== null ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-muted-foreground/40"
                  style={{ left: `${xPct(active)}%` }}
                />
                {(
                  [
                    [activePoint.previous, 'border-muted-foreground'],
                    [activePoint.current, 'border-primary'],
                  ] as const
                ).map(([v, tone], i) => {
                  const g = geom(v);
                  return g === null ? null : (
                    <span
                      key={i}
                      className={cn(
                        'pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card',
                        tone,
                      )}
                      style={{ left: `${xPct(active)}%`, top: `${yPct(g)}%` }}
                    />
                  );
                })}
                <div
                  role="tooltip"
                  className={cn(
                    'pointer-events-none absolute top-1 z-10 min-w-44 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
                    active > n / 2 ? '-translate-x-full -ml-2' : 'ml-2',
                  )}
                  style={{ left: `${xPct(active)}%` }}
                >
                  <div className="mb-1 font-semibold">{activePoint.label}</div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{currentLabel}</span>
                    <span className="tabular-nums">
                      {activePoint.current === null ? '—' : format(activePoint.current)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {activePoint.previousLabel ?? previousLabel}
                    </span>
                    <span className="tabular-nums">
                      {activePoint.previous === null ? '—' : format(activePoint.previous)}
                    </span>
                  </div>
                  {tooltipExtra ? <div className="mt-1">{tooltipExtra(activePoint)}</div> : null}
                </div>
              </>
            ) : null}
            <div className="absolute inset-0 flex" onMouseLeave={() => setActive(null)}>
              {points.map((p, i) => (
                <div
                  key={p.key}
                  className="h-full flex-1"
                  data-testid="chart-hit"
                  onMouseEnter={() => setActive(i)}
                />
              ))}
            </div>
          </div>
          <div className="relative h-5" aria-hidden>
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <span
                  key={p.key}
                  className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground"
                  style={{ left: `${xPct(i)}%` }}
                >
                  {p.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}

/* ───────────────────────── Thanh ngang ───────────────────────── */

export interface BarListItem {
  key: string;
  label: ReactNode;
  /** Chuỗi decimal để tính độ dài thanh. */
  value: string;
  /** Giá trị đã định dạng, in cạnh thanh. */
  display: ReactNode;
  /** Dòng "Chưa gán" / "Chưa phân loại" — thanh nhạt hơn. */
  muted?: boolean;
}

export function BarList({
  items,
  ariaLabel,
  className,
}: {
  items: BarListItem[];
  ariaLabel: string;
  className?: string;
}) {
  const max = items.reduce((m, it) => {
    const d = toDecimal(it.value);
    return d && d.gt(m) ? d : m;
  }, new Decimal(0));
  return (
    <ul className={cn('flex flex-col gap-1.5', className)} aria-label={ariaLabel}>
      {items.map((it) => {
        const d = toDecimal(it.value);
        const pct = d && max.gt(0) && d.gt(0) ? d.div(max).times(100).toNumber() : 0;
        return (
          <li key={it.key} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-2">
            <span className="truncate text-sm">{it.label}</span>
            <span className="h-2.5 rounded-sm bg-muted">
              <span
                className={cn(
                  'block h-full rounded-sm',
                  it.muted ? 'bg-muted-foreground/50' : 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-right text-xs tabular-nums">{it.display}</span>
          </li>
        );
      })}
    </ul>
  );
}
