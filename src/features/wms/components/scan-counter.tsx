'use client';

import { Check, CheckCircle2, CircleAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatQuantity, toDecimal } from '@/lib/format';
import type { ScanFeedback } from '../scan-session';

/** Quá số này thì thanh tiến độ chia 20 ô theo tỉ lệ thay vì mỗi đơn vị một ô. */
const MAX_SEGMENTS = 20;

/**
 * Khung đếm của dòng đang lấy (thiết kế 2026-10-26, canvas 74cSn4eQquHQ56iaAxHmL3): "ĐÃ QUÉT
 * 2 / 5" thật to + ô "CÒN QUÉT 3" + thanh mỗi đơn vị một ô, phản hồi lần quét vừa rồi nằm ngay
 * trong khung (đúng → xanh, sai mã → viền đỏ, số không đổi). Đủ → khung xanh lá "ĐỦ".
 */
export function ScanCounter({
  done,
  planned,
  unit,
  feedback,
  className,
}: {
  done: string;
  planned: string;
  /** Đơn vị cơ bản ("CHAI") — null thì chỉ hiện số. */
  unit?: string | null;
  feedback: ScanFeedback | null;
  className?: string;
}) {
  const d = toDecimal(done)?.toNumber() ?? 0;
  const p = toDecimal(planned)?.toNumber() ?? 0;
  const complete = p > 0 && d >= p;
  const remaining = toDecimal(planned)?.minus(toDecimal(done) ?? 0);
  const error = feedback?.kind === 'error';
  const count = p > 0 && p <= MAX_SEGMENTS && Number.isInteger(p) ? p : MAX_SEGMENTS;
  const filled = p > 0 ? Math.min(count, Math.floor((d / p) * count)) : 0;
  const unitLabel = unit ? unit.toLowerCase() : '';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 p-3.5 lg:gap-4 lg:px-6 lg:py-5',
        error
          ? 'border-destructive bg-destructive-weak'
          : complete
            ? 'border-success bg-success-weak'
            : 'border-primary bg-info-weak',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground lg:text-sm">
            ĐÃ QUÉT
          </span>
          <span
            className="flex items-baseline gap-1.5 leading-none tabular-nums"
            data-testid="scan-counter"
          >
            <span
              className={cn('text-7xl font-bold lg:text-8xl', complete && !error && 'text-success')}
            >
              {formatQuantity(done)}
            </span>
            <span className="text-4xl font-semibold text-muted-foreground lg:text-6xl">
              / {formatQuantity(planned)}
            </span>
            {unitLabel ? (
              <span className="text-lg text-muted-foreground lg:text-2xl">{unitLabel}</span>
            ) : null}
          </span>
        </div>
        {complete ? (
          <div className="flex min-w-28 flex-col items-center gap-0.5 rounded-lg bg-success px-3 py-2.5 text-primary-foreground lg:min-w-40 lg:py-4">
            <Check className="h-9 w-9 lg:h-12 lg:w-12" strokeWidth={3} aria-hidden />
            <span className="text-base font-bold lg:text-xl">ĐỦ</span>
          </div>
        ) : (
          <div className="flex min-w-28 flex-col items-center rounded-lg border bg-card px-3 py-2 lg:min-w-40 lg:px-5 lg:py-3">
            <span className="text-xs font-semibold text-muted-foreground lg:text-sm">CÒN QUÉT</span>
            <span className="text-5xl font-bold leading-tight text-primary tabular-nums lg:text-7xl">
              {formatQuantity(remaining?.toFixed(6) ?? planned)}
            </span>
          </div>
        )}
      </div>

      <div
        className="flex gap-1 lg:gap-1.5"
        role="img"
        aria-label={`Đã quét ${formatQuantity(done)} trên ${formatQuantity(planned)}`}
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 flex-1 rounded-sm lg:h-6',
              i < filled ? (complete ? 'bg-success' : 'bg-primary') : 'bg-border',
            )}
          />
        ))}
      </div>

      <p
        role={error ? 'alert' : 'status'}
        aria-live="polite"
        className={cn(
          'flex items-start gap-2 text-base font-semibold lg:text-lg',
          error
            ? 'text-destructive'
            : feedback?.kind === 'warn'
              ? 'text-warning'
              : feedback?.kind === 'info'
                ? 'text-info'
                : 'text-success',
          !feedback && !complete && 'font-medium text-muted-foreground',
        )}
      >
        {feedback ? (
          error ? (
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          ) : feedback.kind === 'warn' ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          )
        ) : null}
        <span>
          {feedback
            ? feedback.text
            : complete
              ? 'Đủ — tự sang dòng kế tiếp'
              : `Quét mã sản phẩm — còn ${formatQuantity(remaining?.toFixed(6) ?? planned)}${unitLabel ? ` ${unitLabel}` : ''}`}
        </span>
      </p>
    </div>
  );
}
