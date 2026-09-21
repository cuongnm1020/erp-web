'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef, type FilterDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity } from '@/lib/format';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import {
  replenishmentKeys,
  useReplenishment,
  type ReplenishmentRow,
  type ReplenishmentStatus,
} from '../api/use-replenishment';
import { useWarehouses } from '../api/use-warehouses';
import { isNegativeQty } from '../labels';

/**
 * Cảnh báo nhập hàng (2026-09-22) — GET /stock/replenishment. Mỗi dòng là một SKU của sản phẩm
 * có "Mức tồn kho" (đặt trên form sản phẩm): tồn thực, số bán hôm nay / hôm qua / hôm kia, tốc
 * độ bán trung bình 2 ngày, số ngày còn bán được và ngày dự kiến hết. Trạng thái do API xếp:
 *   Hết hàng (khả dụng ≤ 0) → Dưới mức (tồn ≤ mức) → Sắp chạm mức (2 ngày nữa chạm) → Đủ.
 * Mọi con số là string decimal do API tính (luật 10) — màn hình chỉ hiển thị.
 * Kho / phạm vi / tìm nhanh / trang nằm trên URL (luật 8). Mặc định chỉ dòng cần chú ý;
 * `scope=all` để rà cả SKU đang đủ hàng.
 */
const DEFAULTS = { size: 50, filterKeys: ['warehouseId', 'scope'] as const };
type Filter = (typeof DEFAULTS.filterKeys)[number];

const STATUS: Record<ReplenishmentStatus, { label: string; tone: StatusTone }> = {
  OUT: { label: 'Hết hàng', tone: 'err' },
  BELOW: { label: 'Dưới mức', tone: 'err' },
  SOON: { label: 'Sắp chạm mức', tone: 'warn' },
  OK: { label: 'Đủ', tone: 'ok' },
};

const columns: ColumnDef<ReplenishmentRow, unknown>[] = [
  {
    id: 'status',
    header: 'Trạng thái',
    meta: { width: 130 },
    cell: ({ row }) => (
      <StatusBadge tone={STATUS[row.original.status].tone}>
        {STATUS[row.original.status].label}
      </StatusBadge>
    ),
  },
  {
    id: 'skuCode',
    accessorKey: 'skuCode',
    header: 'SKU',
    meta: { width: 140 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  {
    id: 'productName',
    header: 'Tên thương mại',
    meta: { width: 280 },
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span>{row.original.productName}</span>
        {row.original.skuName !== row.original.productName ? (
          <span className="text-xs text-muted-foreground">{row.original.skuName}</span>
        ) : null}
      </span>
    ),
  },
  { id: 'baseUomCode', accessorKey: 'baseUomCode', header: 'ĐVT', meta: { width: 80 } },
  {
    id: 'reorderLevel',
    header: 'Mức tồn kho',
    meta: { align: 'right', width: 120 },
    cell: ({ row }) => formatQuantity(row.original.reorderLevel),
  },
  {
    id: 'onHand',
    header: 'Tồn thực',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => (
      <span
        className={cn(
          'font-semibold',
          (row.original.status === 'BELOW' || row.original.status === 'OUT') && 'text-destructive',
        )}
      >
        {formatQuantity(row.original.onHand)}
      </span>
    ),
  },
  {
    id: 'available',
    header: 'Khả dụng',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => (
      <span className={cn(isNegativeQty(row.original.available) && 'text-destructive')}>
        {formatQuantity(row.original.available)}
      </span>
    ),
  },
  {
    id: 'soldToday',
    header: 'Bán hôm nay',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => formatQuantity(row.original.soldToday),
  },
  {
    id: 'sold1d',
    header: 'Bán hôm qua',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => formatQuantity(row.original.sold1d),
  },
  {
    id: 'sold2d',
    header: 'Bán hôm kia',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => formatQuantity(row.original.sold2d),
  },
  {
    id: 'avgDaily',
    header: 'TB / ngày',
    meta: { align: 'right', width: 100 },
    cell: ({ row }) => formatQuantity(row.original.avgDaily, { maxDp: 1 }),
  },
  {
    id: 'daysLeft',
    header: 'Còn bán được',
    meta: { align: 'right', width: 120 },
    cell: ({ row }) =>
      row.original.daysLeft === null ? (
        <span className="text-muted-foreground">chưa có số bán</span>
      ) : (
        `${formatQuantity(row.original.daysLeft, { maxDp: 1 })} ngày`
      ),
  },
  {
    id: 'projectedOutDate',
    header: 'Dự kiến hết',
    meta: { width: 120 },
    cell: ({ row }) =>
      row.original.projectedOutDate === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatDate(row.original.projectedOutDate)
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { width: 110 },
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/catalog/products/${row.original.productId}/edit`}>Sửa mức</Link>
      </Button>
    ),
  },
];

export function ReplenishmentAlertScreen() {
  const { state, set, skipTake } = useListState<Filter>(DEFAULTS);
  const warehouseId = state.filters.warehouseId ?? '';
  const onlyAlert = state.filters.scope !== 'all';
  const params = useMemo(
    () => ({ q: state.q, warehouseId, onlyAlert, ...skipTake }),
    [state.q, warehouseId, onlyAlert, skipTake],
  );
  const query = useReplenishment(params);
  const warehouses = useWarehouses();
  // Luật 9: realtime chỉ invalidate theo prefix — tồn đổi (pack xong / nhập kho) → tính lại.
  useInvalidateOn(['stock.changed', 'stock.moved'], [replenishmentKeys.all]);

  const filters: FilterDef<Filter>[] = [
    {
      key: 'warehouseId',
      label: 'Kho',
      type: 'select',
      options: (warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name })),
    },
    {
      key: 'scope',
      label: 'Phạm vi',
      type: 'select',
      options: [{ value: 'all', label: 'Mọi SKU có mức tồn kho' }],
    },
  ];
  const hasFilter = state.q !== '' || warehouseId !== '';
  const data = query.data;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Cảnh báo nhập hàng"
        description={
          data === undefined
            ? 'Đang tính tồn và số bán 2 ngày gần nhất…'
            : `${data.alertCount} SKU cần chú ý · số bán tính đến hôm nay ${formatDate(data.asOf)}`
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Cảnh báo nhập hàng' }]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog/products">Đặt mức tồn kho ở Sản phẩm</Link>
          </Button>
        }
      />

      <p className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <b className="font-semibold text-foreground">Dưới mức</b> = tồn thực đã chạm mức tồn kho
          đặt trên sản phẩm. <b className="font-semibold text-foreground">Sắp chạm mức</b> = với tốc
          độ bán trung bình hôm qua + hôm kia, trong 2 ngày nữa sẽ chạm.{' '}
          <b className="font-semibold text-foreground">Dự kiến hết</b> = khả dụng ÷ tốc độ bán. Số
          bán tính theo đơn không hủy, ngày đặt giờ VN.
        </span>
      </p>

      <FilterBar<Filter>
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filters}
        values={{ warehouseId: state.filters.warehouseId, scope: state.filters.scope }}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm theo mã SKU, tên biến thể hoặc tên thương mại…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={13} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              hasFilter
                ? 'Không có SKU nào khớp'
                : onlyAlert
                  ? 'Chưa có sản phẩm nào cần nhập'
                  : 'Chưa sản phẩm nào đặt mức tồn kho'
            }
            description={
              hasFilter
                ? 'Thử từ khóa khác, hoặc bỏ bớt bộ lọc đang dán trên URL.'
                : onlyAlert
                  ? 'Mọi SKU có mức tồn kho đều đang trên ngưỡng. Xem cả dòng đủ hàng để rà lại ngưỡng.'
                  : 'Mở form sản phẩm, điền "Mức tồn kho" — SKU của sản phẩm đó sẽ được theo dõi ở đây.'
            }
            action={
              hasFilter ? (
                <Button
                  variant="outline"
                  onClick={() => set({ q: '', filters: { scope: state.filters.scope } })}
                >
                  Xóa lọc
                </Button>
              ) : onlyAlert ? (
                <Button
                  variant="outline"
                  onClick={() => set({ filters: { ...state.filters, scope: 'all' } })}
                >
                  Xem mọi SKU có mức tồn kho
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/catalog/products">Mở danh sách sản phẩm</Link>
                </Button>
              )
            }
          />
        }
      >
        {(d) => (
          <DataTable
            columns={columns}
            rows={d.items}
            getRowId={(r) => r.skuId}
            total={d.total}
            page={state.page}
            size={state.size}
            sort={state.sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(sort) => set({ sort })}
          />
        )}
      </QueryState>
    </div>
  );
}
