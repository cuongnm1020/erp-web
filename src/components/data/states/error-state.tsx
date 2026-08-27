'use client';

import { AlertTriangle, Copy, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';

/**
 * Lỗi chuẩn (luật 6 + 13): câu từ bộ dịch duy nhất, nút thử lại, traceId (copy được).
 * 403 → tự chuyển sang ForbiddenState. Không render message thô từ server.
 */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  if (isApiError(error) && error.isForbidden) return <ForbiddenState className={className} />;
  const traceId = isApiError(error) ? error.traceId : undefined;
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center',
        className,
      )}
    >
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title ?? 'Không tải được dữ liệu'}</p>
        <p className="text-sm text-muted-foreground">{messageFor(error)}</p>
      </div>
      {traceId ? <TraceId value={traceId} /> : null}
      {onRetry ? <Button onClick={onRetry}>Thử lại</Button> : null}
    </div>
  );
}

export function ForbiddenState({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center',
        className,
      )}
    >
      <ShieldAlert className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Bạn không có quyền xem mục này</p>
        <p className="text-sm text-muted-foreground">
          Liên hệ quản trị viên nếu bạn cần được cấp quyền.
        </p>
      </div>
    </div>
  );
}

export function TraceId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bị chặn — người dùng vẫn đọc được mã bên cạnh
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
      aria-label={`Mã truy vết ${value}, bấm để sao chép`}
    >
      <Copy className="h-3 w-3" aria-hidden />
      {copied ? 'Đã sao chép' : value}
    </button>
  );
}
