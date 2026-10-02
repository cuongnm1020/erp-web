'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { toSkipTake, useListState } from '@/lib/url-state';
import {
  useCancelReturn,
  useReturnReceipts,
  type ReturnReceiptRow,
  type ReturnReceiptStatus,
} from '../api/use-returns';
import { RETURN_STATUS } from './return-status';

/**
 * Nhập hàng hoàn (2026-10-02) — GET /return-receipts. Hàng khách trả (một phần / cả đơn) và hàng
 * ĐVVC hoàn về khi giao không thành. Tab trạng thái + tìm số phiếu nằm trên URL (luật 8).
 */
const DEFAULTS = { size: 40, filterKeys: ['status'] as const };
type Filter = (typeof DEFAULTS.filterKeys)[number];

const TABS: Array<{ key: '' | ReturnReceiptStatus; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'POSTED', label: 'Đã post' },
  { key: 'CANCELLED', label: 'Hủy' },
];

export function ReturnListScreen() {
  const { state, set } = useListState<Filter>(DEFAULTS);
  const ability = useAbility();
  const canReceive = ability.can('receive', 'Stock');
  const cancel = useCancelReturn();
  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.status ? { status: state.filters.status as ReturnReceiptStatus } : {}),
    }),
    [state],
  );
  const query = useReturnReceipts(params);

  const columns = useMemo<ColumnDef<ReturnReceiptRow, unknown>[]>(
    () => [
      {
        id: 'docNumber',
        header: 'Số phiếu',
        meta: { width: 150 },
        cell: ({ row }) => (
          <Link
            href={`/wms/returns/${row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        id: 'order',
        header: 'Đơn bán',
        meta: { width: 150 },
        cell: ({ row }) => (
          <Link
            href={`/crm/orders/${row.original.orderId}`}
            className="font-mono text-xs hover:underline"
          >
            {row.original.orderDocNumber}
          </Link>
        ),
      },
      {
        id: 'reason',
        header: 'Lý do',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.reason ?? '—'}</span>
        ),
      },
      {
        id: 'warehouse',
        header: 'Kho',
        meta: { width: 120 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.warehouseName}</span>
        ),
      },
      {
        id: 'lineCount',
        header: 'Số dòng',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => row.original.lineCount,
      },
      {
        id: 'totalQty',
        header: 'Tổng SL',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => formatQuantity(row.original.totalQty),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        meta: { width: 110 },
        cell: ({ row }) => {
          const s = RETURN_STATUS[row.original.status];
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
        },
      },
      {
        id: 'receivedAt',
        header: 'Ngày',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.receivedAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { width: 70 },
        cell: ({ row }) =>
          canReceive && row.original.status === 'DRAFT' ? (
            <RowActions
              onDelete={() =>
                cancel
                  .mutateAsync(row.original.id)
                  .then(() => toast.success(`Đã hủy phiếu ${row.original.docNumber}`))
                  .catch((err) => toast.error(messageFor(err)))
              }
              deleteLabel="Hủy nháp"
              itemName={`phiếu hoàn ${row.original.docNumber}`}
              deleteDescription="Phiếu nháp chưa chạm tồn kho — hủy không cần phiếu đảo."
            />
          ) : null,
      },
    ],
    [canReceive, cancel],
  );

  const newButton = canReceive ? (
    <Button size="sm" asChild>
      <Link href="/wms/returns/new">
        <Plus aria-hidden />
        Nhập hàng hoàn
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Nhập hàng hoàn"
        description={
          query.data
            ? `${query.data.total} phiếu · hàng khách trả và hàng ĐVVC hoàn về kho`
            : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Nhập hàng hoàn' }]}
        actions={newButton}
      />

      <FilterBar<Filter>
        q={state.q}
        onQChange={(q) => set({ q })}
        searchPlaceholder="Tìm số phiếu RTN…"
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
      />

      <div className="mb-3 flex border-b" role="tablist">
        {TABS.map((t) => {
          const active = (state.filters.status ?? '') === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() =>
                set({ filters: { ...state.filters, status: t.key === '' ? undefined : t.key } })
              }
              className={cn(
                '-mb-px border-b-2 px-3 pb-2 pt-1 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={8} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có phiếu nhập hàng hoàn nào"
            description="Khi khách trả hàng hoặc ĐVVC hoàn về, lập phiếu theo số đơn để nhập lại kho."
            action={
              canReceive ? (
                <Button asChild>
                  <Link href="/wms/returns/new">
                    <Plus aria-hidden />
                    Nhập hàng hoàn
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.id}
            total={data.total}
            page={state.page}
            size={state.size}
            sort={null}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={() => undefined}
          />
        )}
      </QueryState>
    </>
  );
}
