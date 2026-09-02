'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { toSkipTake, useListState } from '@/lib/url-state';
import {
  GDN_KIND_LABEL,
  gdnStage,
  useGoodsIssues,
  type GoodsIssueKind,
  type GoodsIssueListRow,
  type GoodsIssueStatus,
} from '../api/use-goods-issues';
import { useWarehouses } from '../api/use-warehouses';

/**
 * Xuất kho — danh sách GDN nối GET /goods-issues (design GdnList).
 * Màn CHỈ ĐỌC: GDN kind=SALES sinh tự động khi đơn được điều phối thành task
 * PICK và POSTED tự động khi đóng gói xong (PLAN-gdn-transfer bước 2); không có
 * nút "Tạo phiếu xuất" — kind thủ công (Trả NCC / Xuất khác) là bước sau.
 *
 * Tab trạng thái đếm từ statusCounts của server; cột "Trạng thái" là vòng đời
 * suy từ task PICK/PACK (gdnStage) — 'Chờ pick / Đang pick / Đang đóng gói' đều
 * là phiếu DRAFT ở DB.
 *
 * Khác design (backend chưa mô tả được):
 * - "Khách / đích đến": SalesOrder là model có scope, wms không đọc — cột Tham
 *   chiếu link sang đơn bán theo id (cùng cách bảng điều phối).
 * - "Người pick" và "Xuất CSV": chưa có trong DTO/endpoint.
 */
const DEFAULTS = {
  size: 40,
  filterKeys: ['status', 'kind', 'warehouseId'] as const,
};
type GdnFilter = (typeof DEFAULTS.filterKeys)[number];

const TABS: Array<{ key: '' | GoodsIssueStatus; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Đang xử lý' },
  { key: 'POSTED', label: 'Đã post' },
  { key: 'CANCELLED', label: 'Hủy' },
];

export function GdnListScreen() {
  const { state, set } = useListState<GdnFilter>(DEFAULTS);
  const warehouses = useWarehouses();

  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.status ? { status: state.filters.status as GoodsIssueStatus } : {}),
      ...(state.filters.kind ? { kind: state.filters.kind as GoodsIssueKind } : {}),
      ...(state.filters.warehouseId ? { warehouseId: state.filters.warehouseId } : {}),
    }),
    [state],
  );
  const query = useGoodsIssues(params);
  const counts = query.data?.statusCounts;
  const tabCount = (key: '' | GoodsIssueStatus): number | undefined => {
    if (!counts) return undefined;
    if (key === '') return counts.DRAFT + counts.POSTED + counts.CANCELLED;
    return counts[key as 'DRAFT' | 'POSTED' | 'CANCELLED'] ?? 0;
  };

  const columns = useMemo<ColumnDef<GoodsIssueListRow, unknown>[]>(
    () => [
      {
        id: 'docNumber',
        header: 'Số phiếu',
        meta: { width: 150 },
        cell: ({ row }) => (
          <Link
            href={`/wms/gdn/${row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        id: 'kind',
        header: 'Loại',
        meta: { width: 110 },
        cell: ({ row }) => {
          const k = GDN_KIND_LABEL[row.original.kind];
          return <StatusBadge tone={k.tone}>{k.label}</StatusBadge>;
        },
      },
      {
        id: 'reference',
        header: 'Tham chiếu',
        meta: { width: 110 },
        cell: ({ row }) =>
          row.original.refType === 'SalesOrder' && row.original.refId ? (
            <Link
              href={`/crm/orders/${row.original.refId}`}
              className="text-primary hover:underline"
            >
              Đơn bán
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'warehouse',
        header: 'Kho',
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
        header: 'SL kế hoạch',
        meta: { align: 'right', width: 110 },
        cell: ({ row }) => formatQuantity(row.original.totalQtyPlanned),
      },
      {
        id: 'totalDone',
        header: 'SL đã xuất',
        meta: { align: 'right', width: 110 },
        cell: ({ row }) =>
          row.original.status === 'POSTED' ? (
            <span className="font-semibold">{formatQuantity(row.original.totalQtyDone)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'stage',
        header: 'Trạng thái',
        meta: { width: 140 },
        cell: ({ row }) => {
          const s = gdnStage(row.original);
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
        },
      },
      {
        id: 'createdAt',
        header: 'Ngày tạo',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Phiếu xuất kho"
        description={
          query.data
            ? `${query.data.total} phiếu theo bộ lọc hiện tại · phiếu bán hàng sinh và post tự động theo luồng pick → đóng gói`
            : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Xuất kho' }]}
      />

      <FilterBar<GdnFilter>
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
          {
            key: 'kind',
            label: 'Loại',
            type: 'select',
            options: (Object.keys(GDN_KIND_LABEL) as GoodsIssueKind[]).map((k) => ({
              value: k,
              label: GDN_KIND_LABEL[k].label,
            })),
          },
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
        skeleton={<ListSkeleton rows={8} columns={8} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có phiếu xuất nào theo bộ lọc"
            description="Phiếu xuất bán hàng sinh tự động khi đơn được điều phối cho kho."
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
