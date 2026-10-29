'use client';

import { History } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useOrderEditHistory } from '../api/use-orders';
import { Card } from './order-create/order-side-cards';

/**
 * Lịch sử sửa đơn (2026-10-29): mỗi lần lưu ở màn Sửa đơn — giờ, người sửa, từng thay đổi cũ → mới.
 * Server ghi sẵn chuỗi hiển thị (tên người, hãng, địa chỉ một dòng, "OE-X ×2").
 */
export function OrderEditHistory({ orderId }: { orderId: string }) {
  const q = useOrderEditHistory(orderId);
  return (
    <Card title="Lịch sử sửa đơn">
      {q.isPending ? (
        <div className="space-y-2" aria-busy>
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-destructive">
          Không tải được lịch sử sửa đơn.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void q.refetch()}
          >
            Thử lại
          </button>
        </p>
      ) : q.data.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <History className="h-3.5 w-3.5" aria-hidden />
          Đơn chưa được sửa lần nào.
        </p>
      ) : (
        <ol className="space-y-3">
          {q.data.map((log) => (
            <li key={log.id} className="border-l-2 border-input-soft pl-3 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-semibold">{log.userName ?? 'Tài khoản đã xóa'}</span>
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
    </Card>
  );
}
