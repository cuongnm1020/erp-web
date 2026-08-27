'use client';

import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';

/** Lỗi không bắt được trong route segment. Luật 6: 5xx phải hiện traceId. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const traceId = isApiError(error) ? error.traceId : error.digest;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Trang gặp lỗi</h1>
      <p className="max-w-md text-sm text-muted-foreground">{messageFor(error)}</p>
      {traceId ? (
        <p className="font-mono text-xs text-muted-foreground">Mã truy vết: {traceId}</p>
      ) : null}
      <Button onClick={reset}>Thử lại</Button>
    </main>
  );
}
