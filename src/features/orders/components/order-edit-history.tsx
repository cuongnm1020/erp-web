'use client';

import { History } from 'lucide-react';
import { StatusBadge } from '@/components/data/status-badge';
import { formatDateTime } from '@/lib/format';
import { useOrderEditHistory, usePancakeOrderHistory } from '../api/use-orders';
import { Card } from './order-create/order-side-cards';

interface Change {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

interface Entry {
  key: string;
  at: string;
  who: string;
  /** Admin "đăng nhập với tư cách" `who` lúc thao tác (2026-11-06) — hiện "(thay <who>)". */
  onBehalfOf: string | null;
  pancake: boolean;
  changes: Change[];
}

/**
 * Lịch sử đơn (2026-10-29): mỗi lần lưu ở màn Sửa đơn — giờ, người sửa, từng thay đổi cũ → mới.
 * Server ghi sẵn chuỗi hiển thị (tên người, hãng, địa chỉ một dòng, "OE-X ×2").
 * 2026-11-04: trộn cả lịch sử cập nhật trên Pancake (chip "Pancake"), xếp chung theo giờ.
 * 2026-11-06: server ghi cả tạo đơn (người tạo + SP/SL), xác nhận, gửi ĐVVC, chuyển kho, hủy đơn,
 * hủy vận đơn; admin đăng nhập thay nhân viên → hiện tên admin, kèm "(thay <nhân viên>)".
 */
export function OrderEditHistory({ orderId }: { orderId: string }) {
  const erp = useOrderEditHistory(orderId);
  const pancake = usePancakeOrderHistory(orderId);
  const pending = erp.isPending || pancake.isPending;
  const failed = erp.isError || pancake.isError;
  const entries: Entry[] = [
    ...(erp.data ?? []).map((l) => {
      const user = l.userName ?? 'Tài khoản đã xóa';
      return {
        key: `erp-${l.id}`,
        at: l.at,
        who: l.impersonatorId ? (l.impersonatorName ?? 'Tài khoản đã xóa') : user,
        onBehalfOf: l.impersonatorId ? user : null,
        pancake: false,
        changes: l.changes,
      };
    }),
    ...(pancake.data ?? []).map((l, i) => ({
      key: `pancake-${l.at}-${i}`,
      at: l.at,
      who: l.userName ?? 'NV Pancake chưa liên kết',
      onBehalfOf: null,
      pancake: true,
      changes: l.changes,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card title="Lịch sử sửa đơn">
      {pending ? (
        <div className="space-y-2" aria-busy>
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : failed && entries.length === 0 ? (
        <p className="text-sm text-destructive">
          Không tải được lịch sử sửa đơn.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              void erp.refetch();
              void pancake.refetch();
            }}
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
            <li key={log.key} className="border-l-2 border-input-soft pl-3 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  {log.who}
                  {log.onBehalfOf ? (
                    <span className="font-normal text-muted-foreground">
                      (thay {log.onBehalfOf})
                    </span>
                  ) : null}
                  {log.pancake ? (
                    <StatusBadge tone="neutral" dot={false}>
                      Pancake
                    </StatusBadge>
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
          {failed ? (
            <li className="text-xs text-destructive">
              Một phần lịch sử chưa tải được.{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  void erp.refetch();
                  void pancake.refetch();
                }}
              >
                Thử lại
              </button>
            </li>
          ) : null}
        </ol>
      )}
    </Card>
  );
}
