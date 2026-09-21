'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { ScanQtyControl } from '../use-scan-qty';

/**
 * Ô số lượng cho lần quét đang chờ (một tay, chạm ≥ 56 px — DESIGN-BRIEF §6). Trạng thái:
 * chưa quét → ô mờ, gợi ý "quét mã trước"; đã quét → hiện mã đang chờ, ô sáng, nút "Lấy".
 */
export function ScanQtyBar({
  ctl,
  verb = 'Lấy',
  className,
}: {
  ctl: ScanQtyControl;
  /** Động từ của màn: "Lấy" (pick) / "Đóng" (pack) — giữ nguyên xuyên suốt (ngôn ngữ giao diện). */
  verb?: string;
  className?: string;
}) {
  const waiting = ctl.pending !== null;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Số lượng</span>
        {waiting ? (
          <span className="truncate font-mono text-xs" aria-live="polite">
            Đã quét {ctl.pending} — nhập số rồi Enter
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Quét mã trước, mặc định 1</span>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        <Input
          ref={ctl.inputRef}
          inputMode="decimal"
          autoComplete="off"
          aria-label="Số lượng lần quét này"
          aria-invalid={ctl.error !== null}
          value={ctl.qty}
          onChange={(e) => ctl.setQty(e.target.value)}
          onKeyDown={ctl.onKeyDown}
          className={cn(
            'h-14 flex-1 text-center text-2xl font-bold tabular-nums',
            !waiting && 'text-muted-foreground',
          )}
        />
        <Button
          type="button"
          className="h-14 min-w-24 text-lg"
          disabled={!waiting}
          onClick={ctl.submit}
        >
          <Check aria-hidden />
          {verb} {waiting ? ctl.qty || '1' : ''}
        </Button>
        {waiting ? (
          <Button
            type="button"
            variant="outline"
            className="h-14 w-14"
            aria-label="Bỏ mã đang chờ (Esc)"
            onClick={ctl.reset}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      {ctl.error ? (
        <p role="alert" className="text-sm text-destructive">
          {ctl.error}
        </p>
      ) : null}
    </div>
  );
}
