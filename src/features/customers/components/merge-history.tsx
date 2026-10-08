'use client';

import { Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { DataTablePagination } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { formatDateTime } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useMergeLogs, useUndoMerge, type MergeLog } from '../api/use-customer-merge';
import { mergeFieldLabel, nonZero, refTotal, undoErrorMessage } from '../merge-labels';

function CustomerCell({ c }: { c: MergeLog['survivor'] }) {
  // code/name null = khách ngoài phạm vi người xem.
  if (!c.code) return <span className="text-muted-foreground">Ngoài phạm vi của bạn</span>;
  return (
    <Link href={`/crm/customers/${c.id}`} className="hover:underline">
      <span className="font-mono text-xs text-primary">{c.code}</span>{' '}
      <span className="text-muted-foreground">{c.name}</span>
    </Link>
  );
}

function RefSummary({ refs }: { refs: MergeLog['moved'] }) {
  const list = nonZero(refs);
  if (list.length === 0) return <span className="text-muted-foreground">0</span>;
  return (
    <span className="tabular-nums" title={list.map((r) => `${r.label}: ${r.count}`).join('\n')}>
      {refTotal(list)} dòng
    </span>
  );
}

/**
 * Lịch sử gộp (GET /customers/merge-logs). API bắt buộc `customerId` với người không phải quản
 * trị toàn cục → không có khách trên URL thì mời mở từ hồ sơ khách.
 */
export function MergeHistory({
  customerId,
  page,
  size,
  onPageChange,
  onSizeChange,
  onClearCustomer,
  onShowPairs,
}: {
  customerId?: string;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onClearCustomer: () => void;
  onShowPairs: () => void;
}) {
  const ability = useAbility();
  const global = ability.can('manage', 'all');
  const allowed = Boolean(customerId) || global;
  const query = useMergeLogs({ customerId, take: size, skip: (page - 1) * size }, allowed);
  const undo = useUndoMerge();
  const [target, setTarget] = useState<MergeLog | null>(null);

  if (!allowed) {
    return (
      <EmptyState
        title="Chọn một khách để xem lịch sử gộp"
        description="Mở hồ sơ khách rồi bấm “Lịch sử gộp”. Toàn bộ lịch sử chỉ quản trị hệ thống xem được."
        action={
          <Button variant="outline" asChild>
            <Link href="/crm/customers">Mở danh sách khách hàng</Link>
          </Button>
        }
      />
    );
  }

  const runUndo = async () => {
    if (!target) return;
    try {
      const r = await undo.mutateAsync(target.id);
      const stuck = refTotal(nonZero(r.stuck));
      toast.success('Đã hoàn tác gộp khách', {
        description:
          stuck > 0
            ? `${stuck} dòng đã chốt sau khi gộp không trả lại được, vẫn ở khách giữ.`
            : `${target.merged.code ?? 'Hồ sơ cũ'} đã tách lại khỏi ${target.survivor.code ?? 'khách giữ'}.`,
      });
    } catch (err) {
      toast.error(undoErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {customerId ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Đang xem lịch sử gộp của một khách</span>
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href={`/crm/customers/${customerId}`}>Mở hồ sơ khách</Link>
          </Button>
          {global ? (
            <Button variant="outline" size="sm" onClick={onClearCustomer}>
              Xem tất cả
            </Button>
          ) : null}
        </div>
      ) : null}
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="Chưa có lần gộp nào"
            description="Gộp khách trùng ở tab Nhóm trùng — mỗi lần gộp được ghi lại ở đây để hoàn tác khi cần."
            action={
              <Button variant="outline" onClick={onShowPairs}>
                Xem nhóm trùng
              </Button>
            }
          />
        }
      >
        {(d) => (
          <div className="rounded-md border bg-card">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5 text-xs">Thời điểm</TableHead>
                  <TableHead className="px-2.5 text-xs">Khách giữ</TableHead>
                  <TableHead className="px-2.5 text-xs">Hồ sơ bị gộp</TableHead>
                  <TableHead className="px-2.5 text-xs">Khớp theo</TableHead>
                  <TableHead className="px-2.5 text-xs">Đã chuyển</TableHead>
                  <TableHead className="px-2.5 text-xs">Ở lại hồ sơ cũ</TableHead>
                  <TableHead className="px-2.5 text-xs">Người gộp</TableHead>
                  <TableHead className="px-2.5 text-xs">Trạng thái</TableHead>
                  <TableHead className="px-2.5 text-xs">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="px-2.5 py-1.5 tabular-nums">
                      {formatDateTime(log.mergedAt)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <CustomerCell c={log.survivor} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <CustomerCell c={log.merged} />
                      {log.fieldsChanged.length > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          lấy: {log.fieldsChanged.map(mergeFieldLabel).join(', ')}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {log.matchedOn === 'phone' ? 'Cùng SĐT' : 'Thủ công'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <RefSummary refs={log.moved} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <RefSummary refs={log.kept} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{log.mergedBy?.name ?? '—'}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {log.undoneAt ? (
                        <span className="flex flex-col">
                          <StatusBadge tone="neutral">Đã hoàn tác</StatusBadge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(log.undoneAt)}
                            {log.undoneBy ? ` · ${log.undoneBy.name}` : ''}
                          </span>
                        </span>
                      ) : (
                        <StatusBadge tone="ok">Đang hiệu lực</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      {log.canUndo ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={undo.isPending}
                          onClick={() => setTarget(log)}
                          aria-label={`Hoàn tác gộp ${log.merged.code ?? ''} vào ${log.survivor.code ?? ''}`}
                        >
                          <Undo2 aria-hidden />
                          Hoàn tác
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3">
              <DataTablePagination
                page={page}
                size={size}
                total={d.total}
                onPageChange={onPageChange}
                onSizeChange={onSizeChange}
              />
            </div>
          </div>
        )}
      </QueryState>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Hoàn tác lần gộp này?"
        description={`Dữ liệu đã chuyển trả về ${target?.merged.code ?? 'hồ sơ cũ'} và hồ sơ này hoạt động lại. Dòng đã chốt sau khi gộp ở lại ${target?.survivor.code ?? 'khách giữ'}.`}
        confirmLabel="Hoàn tác"
        destructive={false}
        onConfirm={runUndo}
      />
    </div>
  );
}
