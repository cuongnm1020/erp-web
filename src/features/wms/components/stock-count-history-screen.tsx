'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { toSkipTake, useListState } from '@/lib/url-state';
import {
  useStockCountHistory,
  useStockCountHistoryUsers,
  type StockCountHistoryRow,
} from '../api/use-stocktake';

const DEFAULTS = { size: 50, filterKeys: ['userId'] as const };
type HistoryFilter = (typeof DEFAULTS.filterKeys)[number];

/** Chênh lệch có dấu: "+3" / "−1" — tăng xanh, giảm đỏ. */
function Variance({ value }: { value: string | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const negative = value.startsWith('-');
  return (
    <span
      className={cn('font-semibold tabular-nums', negative ? 'text-destructive' : 'text-success')}
    >
      {negative ? '−' : '+'}
      {formatQuantity(negative ? value.slice(1) : value)}
    </span>
  );
}

/**
 * Lịch sử nhập tồn (2026-11-05, user): mọi lần nhập làm đổi tồn — nhập tồn thực tế / nhập Excel
 * trên màn Tồn kho và phiên kiểm kê đã duyệt — từng dòng SKU × vị trí, kèm người nhập. Admin đăng
 * nhập thay nhân viên thì người nhập là admin (ghi "thay <nhân viên>"). Lần nhập khớp sổ không
 * đổi tồn nên không có dòng. Kho theo ô kho làm việc ở sidebar; lọc người / tìm SKU trên URL
 * (luật 8), phân trang phía server.
 */
export function StockCountHistoryScreen() {
  const { state, set } = useListState<HistoryFilter>(DEFAULTS);
  const userId = state.filters.userId;
  const params = useMemo(
    () => ({
      ...toSkipTake(state),
      ...(state.q ? { q: state.q } : {}),
      ...(userId ? { userId } : {}),
    }),
    [state, userId],
  );
  const query = useStockCountHistory(params);
  const users = useStockCountHistoryUsers(undefined);

  const columns = useMemo<ColumnDef<StockCountHistoryRow, unknown>[]>(
    () => [
      {
        id: 'at',
        header: 'Thời gian',
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.at)}</span>
        ),
      },
      {
        id: 'user',
        header: 'Người nhập',
        cell: ({ row }) => {
          const r = row.original;
          if (!r.userName) return <span className="text-muted-foreground">Không rõ</span>;
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {r.userName}
                {r.userCode ? (
                  <span className="font-normal text-muted-foreground"> ({r.userCode})</span>
                ) : null}
              </span>
              {r.onBehalfOfName ? (
                <span className="text-xs text-muted-foreground">
                  Đăng nhập thay {r.onBehalfOfName}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'sku',
        header: 'Sản phẩm',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.skuName}</span>
            <span className="text-xs text-muted-foreground">{row.original.skuCode}</span>
          </div>
        ),
      },
      {
        id: 'where',
        header: 'Kho · vị trí',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.warehouseName} · {row.original.locationCode}
          </span>
        ),
      },
      {
        id: 'qtySystem',
        header: 'Tồn sổ',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatQuantity(row.original.qtySystem)}</span>
        ),
      },
      {
        id: 'qtyCounted',
        header: 'Thực tế',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) =>
          row.original.qtyCounted === null ? (
            '—'
          ) : (
            <span className="tabular-nums">{formatQuantity(row.original.qtyCounted)}</span>
          ),
      },
      {
        id: 'variance',
        header: 'Chênh lệch',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => <Variance value={row.original.variance} />,
      },
      {
        id: 'doc',
        header: 'Phiếu',
        meta: { width: 130 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs">{row.original.docNumber}</span>
        ),
      },
    ],
    [],
  );

  const userOptions = (users.data ?? []).map((u) => ({
    value: u.userId,
    label: `${u.name} (${u.code}) · ${u.lineCount} dòng`,
  }));

  return (
    <>
      <PageHeader
        title="Lịch sử nhập tồn"
        description={
          query.data
            ? `${query.data.total} lần đổi tồn theo bộ lọc · lần nhập khớp sổ không đổi tồn nên không có dòng`
            : 'Đang tải…'
        }
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Tồn kho', href: '/wms/stock' },
          { label: 'Lịch sử nhập tồn' },
        ]}
      />

      <FilterBar<HistoryFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        searchPlaceholder="Tìm theo mã hoặc tên SKU…"
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        filters={[
          {
            key: 'userId',
            label: 'Nhân viên',
            type: 'select',
            searchable: true,
            options: userOptions,
          },
        ]}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={8} />}
        isEmpty={(d) => d.total === 0}
        empty={
          <EmptyState
            title="Chưa có lần nhập tồn nào theo bộ lọc"
            description="Lịch sử ghi lại mỗi lần nhập tồn thực tế làm thay đổi tồn kho."
            action={
              <Button asChild>
                <Link href="/wms/stock">Về màn Tồn kho</Link>
              </Button>
            }
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            getRowId={(r) => r.lineId}
            total={data.total}
            page={state.page}
            size={state.size}
            // Luôn mới nhất trước (server) — không cột nào sort được.
            sort={null}
            onSortChange={() => {}}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
          />
        )}
      </QueryState>
    </>
  );
}
