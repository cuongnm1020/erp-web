'use client';

import { History } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useComboHistory } from '../api/use-combos';

/**
 * Lịch sử sửa combo (2026-11-09, sự cố CB-1225 "16 chai" khai định mức 1): mỗi lần lưu — giờ,
 * người sửa, từng thay đổi cũ → mới (tên, giảm giá, thành phần, định mức, giá bán). Server ghi sẵn
 * chuỗi hiển thị; admin đăng nhập thay nhân viên → tên admin kèm "(thay <nhân viên>)".
 */
export function ComboHistory({ comboId }: { comboId: string }) {
  const query = useComboHistory(comboId);
  const entries = (query.data ?? []).map((e) => {
    const user = e.userName ?? (e.userId ? 'Tài khoản đã xóa' : 'Hệ thống');
    return {
      id: e.id,
      at: e.at,
      who: e.impersonatorId ? (e.impersonatorName ?? 'Tài khoản đã xóa') : user,
      onBehalfOf: e.impersonatorId ? user : null,
      changes: e.changes,
    };
  });

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
        <span>
          Lịch sử thay đổi{' '}
          {query.data ? (
            <span className="font-normal text-muted-foreground">· {entries.length}</span>
          ) : null}
        </span>
      </header>
      <div className="px-3 py-2">
        {query.isPending ? (
          <div className="space-y-2" aria-busy>
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">
            Không tải được lịch sử thay đổi.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void query.refetch()}
            >
              Thử lại
            </button>
          </p>
        ) : entries.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden />
            Chưa có lịch sử.
          </p>
        ) : (
          <ol className="max-h-96 space-y-3 overflow-y-auto">
            {entries.map((log) => (
              <li key={log.id} className="border-l-2 border-input-soft pl-3 text-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {log.who}
                    {log.onBehalfOf ? (
                      <span className="font-normal text-muted-foreground">
                        (thay {log.onBehalfOf})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(log.at)}
                  </span>
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {log.changes.map((c, i) => (
                    <li key={`${c.field}-${i}`} className="text-muted-foreground">
                      <span className="text-foreground">{c.label}</span>
                      {c.from !== null || c.to !== null ? ': ' : ''}
                      {c.from !== null ? <s>{c.from}</s> : null}
                      {c.from !== null && c.to !== null ? ' → ' : ''}
                      {c.to !== null ? <span className="text-foreground">{c.to}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
