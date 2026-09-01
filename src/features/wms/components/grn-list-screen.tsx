'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { toSkipTake, useListState } from '@/lib/url-state';
import {
  useCancelReceipt,
  useReceipts,
  type ReceiptListRow,
  type ReceiptStatus,
} from '../api/use-receipts';
import { useWarehouses } from '../api/use-warehouses';

/**
 * Nhập kho — danh sách phiếu GRN nối GET /goods-receipts (design GrnList).
 * Tab trạng thái đếm từ `statusCounts` (server tính trên cùng bộ lọc, bỏ status).
 * Trạng thái/lọc/trang nằm trên URL (luật 8).
 *
 * Khác design (backend chưa mô tả được):
 * - Không có tab "Đang nhận": DocStatus không có trạng thái đó (PDA đang quét
 *   vẫn là DRAFT); sẽ thêm khi backend tách trạng thái nhận dở.
 * - Không có "Xuất CSV" (chưa có endpoint export) và loại "Hoàn từ đơn" (RMA là P2-06).
 */
const DEFAULTS = {
  size: 40,
  filterKeys: ['status', 'warehouseId', 'from', 'to'] as const,
};
type GrnFilter = (typeof DEFAULTS.filterKeys)[number];

const STATUS_LABEL: Record<ReceiptStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nháp', tone: 'draft' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warn' },
  APPROVED: { label: 'Đã duyệt', tone: 'brand' },
  POSTED: { label: 'Đã post', tone: 'ok' },
  CANCELLED: { label: 'Hủy', tone: 'err' },
};

const TABS: Array<{ key: '' | ReceiptStatus; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'POSTED', label: 'Đã post' },
  { key: 'CANCELLED', label: 'Hủy' },
];

export function GrnListScreen() {
  const { state, set } = useListState<GrnFilter>(DEFAULTS);
  const ability = useAbility();
  const canReceive = ability.can('receive', 'Stock');
  const cancel = useCancelReceipt();
  const warehouses = useWarehouses();

  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.status ? { status: state.filters.status as ReceiptStatus } : {}),
      ...(state.filters.warehouseId ? { warehouseId: state.filters.warehouseId } : {}),
      ...(state.filters.from ? { from: state.filters.from } : {}),
      ...(state.filters.to ? { to: state.filters.to } : {}),
    }),
    [state],
  );
  const query = useReceipts(params);
  const counts = query.data?.statusCounts;
  const tabCount = (key: '' | ReceiptStatus): number | undefined => {
    if (!counts) return undefined;
    if (key === '') return counts.DRAFT + counts.POSTED + counts.CANCELLED;
    return counts[key as 'DRAFT' | 'POSTED' | 'CANCELLED'] ?? 0;
  };

  const columns = useMemo<ColumnDef<ReceiptListRow, unknown>[]>(
    () => [
      {
        id: 'docNumber',
        header: 'Số phiếu',
        meta: { width: 150 },
        cell: ({ row }) => (
          <Link
            href={`/wms/grn/${row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        id: 'kind',
        header: 'Loại',
        meta: { width: 100 },
        cell: ({ row }) => (
          <StatusBadge tone="neutral">{row.original.poNumber ? 'Từ PO' : 'Nhập khác'}</StatusBadge>
        ),
      },
      {
        id: 'supplier',
        header: 'Nhà cung cấp',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.supplierName ?? '—'}</span>
        ),
      },
      {
        id: 'reference',
        header: 'Tham chiếu',
        meta: { width: 130 },
        cell: ({ row }) =>
          row.original.poNumber ? (
            <span className="font-mono text-xs">{row.original.poNumber}</span>
          ) : (
            '—'
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
          const s = STATUS_LABEL[row.original.status];
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
        },
      },
      {
        id: 'createdBy',
        header: 'Người tạo',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.createdByName ?? '—'}</span>
        ),
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
          // Chứng từ đã post là bất biến — chỉ nháp mới hủy được
          canReceive && row.original.status === 'DRAFT' ? (
            <RowActions
              onDelete={() =>
                cancel
                  .mutateAsync(row.original.id)
                  .then(() => toast.success(`Đã hủy phiếu nhập ${row.original.docNumber}`))
                  .catch((err) => toast.error(messageFor(err)))
              }
              deleteLabel="Hủy nháp"
              itemName={`phiếu nhập ${row.original.docNumber}`}
              deleteDescription="Phiếu nháp chưa chạm tồn kho — hủy không cần phiếu đảo."
            />
          ) : null,
      },
    ],
    [canReceive, cancel],
  );

  return (
    <>
      <PageHeader
        title="Phiếu nhập kho"
        description={query.data ? `${query.data.total} phiếu theo bộ lọc hiện tại` : 'Đang tải…'}
        breadcrumb={[{ label: 'Kho' }, { label: 'Nhập kho' }]}
        actions={
          canReceive ? (
            <Button size="sm" asChild>
              <Link href="/wms/grn/new">
                <Plus aria-hidden />
                Tạo phiếu nhập
              </Link>
            </Button>
          ) : undefined
        }
      />

      <FilterBar<GrnFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        searchPlaceholder="Tìm số phiếu…"
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        filters={[
          {
            key: 'warehouseId',
            label: 'Kho',
            type: 'select',
            options: (warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name })),
          },
          { key: 'from', label: 'Từ ngày', type: 'date' },
          { key: 'to', label: 'Đến ngày', type: 'date' },
        ]}
      />

      <div className="mb-3 flex border-b" role="tablist">
        {TABS.map((t) => {
          const active = (state.filters.status ?? '') === t.key;
          const count = tabCount(t.key);
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
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {count !== undefined ? (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={9} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có phiếu nhập nào theo bộ lọc"
            description="Tạo phiếu nhập khi hàng về kho — nhập từ PO hoặc nhập tự do."
            action={
              canReceive ? (
                <Button asChild>
                  <Link href="/wms/grn/new">
                    <Plus aria-hidden />
                    Tạo phiếu nhập
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
            sort={state.sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(sort) => set({ sort })}
          />
        )}
      </QueryState>
    </>
  );
}
