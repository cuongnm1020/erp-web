'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity, formatRelative } from '@/lib/format';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState, type SortState } from '@/lib/url-state';
import {
  stockKeys,
  useStockBySku,
  useStockByLocation,
  useStockByLot,
  type StockByLocationRow,
  type StockByLotRow,
  type StockRow,
} from '../api/use-stock';
import { isNegativeQty, locationTypeLabel } from '../labels';

/**
 * G-01 Tồn kho — ba mặt đọc, ba endpoint:
 *   Theo SKU     → GET /stock             (gộp toàn kho, sắp theo mã SKU)
 *   Theo vị trí  → GET /stock/by-location (sắp theo pickSequence = thứ tự đi kho)
 *   Theo lô      → GET /stock/by-lot      (sắp theo hạn dùng tăng dần = FEFO)
 *
 * Ba con số `onHand` / `reserved` / `available` là ba trường RIÊNG do API tính
 * (bất biến 3) — màn hình chỉ hiển thị, không tự cộng trừ. Tất cả là string decimal
 * nên đi qua `formatQuantity`, so sánh dấu bằng decimal.js (luật 10).
 *
 * Tab / tìm nhanh / phân trang nằm trên URL (luật 8): F5 và dán link ra đúng mặt đang xem.
 * Chỉ tab đang mở mới gọi API — hai tab kia `enabled: false`.
 *
 * Cột bỏ so với bản UI-first vì DTO không có trường tương ứng:
 * - "Ngưỡng tối thiểu" và cờ "Dưới ngưỡng": chưa có định mức tồn (P2-08).
 * - "Giá trị tồn" và tổng giá trị kho: chưa có mặt đọc giá vốn theo SKU.
 * - "Cập nhật": StockRowDto không trả mốc thời gian cập nhật.
 * - Tab vị trí: "Lô", "HSD", "ĐVT" — StockByLocationRowDto đã gộp mọi lô của một ô kệ.
 * - Tab lô: "Kho", "ĐVT" — StockByLotRowDto đã gộp mọi vị trí của một lô.
 * - Tab lô: "Thứ tự FEFO" — API chỉ sắp xếp, không trả thứ hạng; đánh số theo trang hiện
 *   tại sẽ sai ngay từ trang 2.
 * - Băng cảnh báo "N lô sắp hết hạn": cần số đếm toàn cục, API không trả.
 * - Chọn kho: `GET /warehouses` chưa khai kiểu response nên chưa dựng được danh sách chọn;
 *   tham số `warehouseId` vẫn đọc từ URL để dán link theo kho được.
 */
const DEFAULTS = {
  size: 50,
  filterKeys: ['tab', 'warehouseId', 'skuId', 'locationId'] as const,
};

type StockFilter = (typeof DEFAULTS.filterKeys)[number];
type StockTabKey = 'sku' | 'location' | 'lot';

const TABS: Array<{ key: StockTabKey; label: string }> = [
  { key: 'sku', label: 'Theo SKU' },
  { key: 'location', label: 'Theo vị trí' },
  { key: 'lot', label: 'Theo lô' },
];

function parseTab(v: string | undefined): StockTabKey {
  return v === 'location' || v === 'lot' ? v : 'sku';
}

/** Ba cột số dùng chung cho cả ba mặt — cùng thứ tự, cùng cách đọc. */
function quantityColumns<
  T extends { onHand: string; reserved: string; available: string },
>(): ColumnDef<T, unknown>[] {
  return [
    {
      id: 'onHand',
      header: 'Tồn thực',
      meta: { align: 'right', width: 110 },
      cell: ({ row }) => formatQuantity(row.original.onHand),
    },
    {
      id: 'reserved',
      header: 'Đang giữ',
      meta: { align: 'right', width: 110 },
      cell: ({ row }) => formatQuantity(row.original.reserved),
    },
    {
      id: 'available',
      header: 'Khả dụng',
      meta: { align: 'right', width: 120 },
      cell: ({ row }) => (
        <span
          className={cn(
            'font-semibold',
            isNegativeQty(row.original.available) && 'text-destructive',
          )}
        >
          {formatQuantity(row.original.available)}
        </span>
      ),
    },
  ];
}

const skuColumns: ColumnDef<StockRow, unknown>[] = [
  {
    id: 'skuCode',
    accessorKey: 'skuCode',
    header: 'SKU',
    meta: { width: 140 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  { id: 'skuName', accessorKey: 'skuName', header: 'Tên sản phẩm', meta: { width: 300 } },
  { id: 'baseUomCode', accessorKey: 'baseUomCode', header: 'ĐVT cơ sở', meta: { width: 110 } },
  ...quantityColumns<StockRow>(),
  {
    id: 'flags',
    header: 'Ghi chú',
    meta: { width: 160 },
    cell: ({ row }) => (
      <span className="flex gap-1">
        {isNegativeQty(row.original.available) ? (
          <StatusBadge tone="err">Khả dụng âm</StatusBadge>
        ) : null}
        {row.original.isActive ? null : <StatusBadge tone="neutral">Ngừng bán</StatusBadge>}
      </span>
    ),
  },
];

const locationColumns: ColumnDef<StockByLocationRow, unknown>[] = [
  {
    id: 'locationCode',
    accessorKey: 'locationCode',
    header: 'Vị trí',
    meta: { width: 140 },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold">{getValue() as string}</span>
    ),
  },
  {
    id: 'warehouseCode',
    accessorKey: 'warehouseCode',
    header: 'Kho',
    meta: { width: 100 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  {
    id: 'locationType',
    header: 'Loại vị trí',
    meta: { width: 130 },
    cell: ({ row }) => locationTypeLabel(row.original.locationType),
  },
  {
    id: 'isPickable',
    header: 'Lấy hàng được',
    meta: { width: 130 },
    cell: ({ row }) =>
      row.original.isPickable ? (
        <StatusBadge tone="ok">Được lấy</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Không lấy</StatusBadge>
      ),
  },
  {
    id: 'pickSequence',
    header: 'Thứ tự đi kho',
    meta: { align: 'right', width: 120 },
    cell: ({ row }) => row.original.pickSequence ?? '—',
  },
  {
    id: 'skuCode',
    accessorKey: 'skuCode',
    header: 'SKU',
    meta: { width: 140 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  { id: 'skuName', accessorKey: 'skuName', header: 'Tên sản phẩm', meta: { width: 260 } },
  ...quantityColumns<StockByLocationRow>(),
];

const lotColumns: ColumnDef<StockByLotRow, unknown>[] = [
  {
    id: 'lotNumber',
    header: 'Lô',
    meta: { width: 130 },
    cell: ({ row }) =>
      row.original.lotNumber === null ? (
        <span className="text-muted-foreground">không theo lô</span>
      ) : (
        <span className="font-mono text-xs font-semibold">{row.original.lotNumber}</span>
      ),
  },
  {
    id: 'skuCode',
    accessorKey: 'skuCode',
    header: 'SKU',
    meta: { width: 140 },
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  { id: 'skuName', accessorKey: 'skuName', header: 'Tên sản phẩm', meta: { width: 260 } },
  {
    id: 'mfgDate',
    header: 'Ngày sản xuất',
    meta: { width: 130 },
    cell: ({ row }) => formatDate(row.original.mfgDate),
  },
  {
    id: 'expiryDate',
    header: 'Hạn dùng',
    meta: { width: 130 },
    cell: ({ row }) => formatDate(row.original.expiryDate),
  },
  {
    id: 'expiryIn',
    header: 'Còn lại',
    meta: { width: 150 },
    cell: ({ row }) =>
      row.original.expiryDate === null ? (
        <span className="text-muted-foreground">không có hạn dùng</span>
      ) : (
        formatRelative(row.original.expiryDate)
      ),
  },
  ...quantityColumns<StockByLotRow>(),
];

interface ListQuery<T> {
  data: { items: T[]; total: number } | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

interface PagerState {
  page: number;
  size: number;
  sort: SortState | null;
  set: (p: { page?: number; size?: number; sort?: SortState | null }) => void;
}

/** Một mặt tồn kho: 4 trạng thái (luật 13) + bảng phân trang phía server (luật 8). */
function StockTable<T>({
  query,
  columns,
  getRowId,
  skeletonColumns,
  empty,
  pager,
}: {
  query: ListQuery<T>;
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  skeletonColumns: number;
  empty: ReactNode;
  pager: PagerState;
}) {
  return (
    <QueryState
      query={query}
      skeleton={<ListSkeleton rows={12} columns={skeletonColumns} />}
      isEmpty={(d) => d.items.length === 0}
      empty={empty}
    >
      {(data) => (
        <DataTable
          columns={columns}
          rows={data.items}
          getRowId={getRowId}
          total={data.total}
          page={pager.page}
          size={pager.size}
          sort={pager.sort}
          onPageChange={(page) => pager.set({ page })}
          onSizeChange={(size) => pager.set({ size })}
          onSortChange={(sort) => pager.set({ sort })}
        />
      )}
    </QueryState>
  );
}

export function StockScreen() {
  const { state, set, skipTake } = useListState<StockFilter>(DEFAULTS);
  const tab = parseTab(state.filters.tab);
  const warehouseId = state.filters.warehouseId ?? '';
  const skuId = state.filters.skuId ?? '';
  const locationId = state.filters.locationId ?? '';

  const listParams = useMemo(
    () => ({ q: state.q, warehouseId, ...skipTake }),
    [state.q, warehouseId, skipTake],
  );
  const breakdownParams = useMemo(
    () => ({ ...listParams, skuId, locationId }),
    [listParams, skuId, locationId],
  );

  const bySku = useStockBySku(listParams, tab === 'sku');
  const byLocation = useStockByLocation(breakdownParams, tab === 'location');
  const byLot = useStockByLot(breakdownParams, tab === 'lot');
  const total = (tab === 'sku' ? bySku : tab === 'location' ? byLocation : byLot).data?.total;

  // Luật 9: sự kiện realtime chỉ invalidate theo prefix, không vá cache bằng payload socket.
  useInvalidateOn(['stock.changed', 'stock.moved'], [stockKeys.all]);

  const setFilter = (patch: Partial<Record<StockFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter = state.q !== '' || warehouseId !== '' || skuId !== '' || locationId !== '';
  const unit = tab === 'sku' ? 'SKU' : tab === 'location' ? 'dòng vị trí' : 'dòng lô';
  const pager: PagerState = { page: state.page, size: state.size, sort: state.sort, set };

  const empty = (
    <EmptyState
      title={hasFilter ? 'Không có dòng tồn nào khớp' : 'Chưa có dữ liệu tồn kho'}
      description={
        hasFilter
          ? 'Thử từ khóa khác, hoặc bỏ bớt bộ lọc đang dán trên URL.'
          : 'Tồn kho sinh ra từ sổ cái — nhập hàng hoặc ghi tồn đầu kỳ trước đã.'
      }
      action={
        hasFilter ? (
          <Button
            variant="outline"
            onClick={() => set({ q: '', filters: { tab: state.filters.tab } })}
          >
            Xóa lọc
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/wms/grn/new">Tạo phiếu nhập</Link>
          </Button>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tồn kho"
        description={
          total === undefined ? `Đang đếm số ${unit} khớp bộ lọc…` : `${total} ${unit} khớp bộ lọc`
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Tồn kho' }]}
      />

      <p className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <b className="font-semibold text-foreground">Tồn thực</b> là hàng đang nằm trong kho,{' '}
          <b className="font-semibold text-foreground">đang giữ</b> là phần đã hứa cho đơn nhưng
          chưa pick, <b className="font-semibold text-foreground">khả dụng</b> là phần còn bán được.
          Ba con số tách biệt, do API tính.
        </span>
      </p>

      <div className="flex border-b" role="tablist" aria-label="Cách xem tồn kho">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setFilter({ tab: t.key === 'sku' ? undefined : t.key })}
            className={cn(
              '-mb-px flex h-9 items-center border-b-2 px-3 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar<StockFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={setFilter}
        searchPlaceholder="Tìm theo mã hoặc tên SKU…"
      />

      {tab === 'location' ? (
        <p className="text-xs text-muted-foreground">
          Sắp theo thứ tự đi kho (pickSequence). Mọi lô trong cùng một ô kệ đã được gộp lại.
        </p>
      ) : null}
      {tab === 'lot' ? (
        <p className="text-xs text-muted-foreground">
          Sắp theo hạn dùng tăng dần — đúng thứ tự FEFO mà kho sẽ xuất. Lô không có hạn dùng nằm
          cuối.
        </p>
      ) : null}

      {tab === 'sku' ? (
        <StockTable
          query={bySku}
          columns={skuColumns}
          getRowId={(r) => r.skuId}
          skeletonColumns={7}
          empty={empty}
          pager={pager}
        />
      ) : null}
      {tab === 'location' ? (
        <StockTable
          query={byLocation}
          columns={locationColumns}
          getRowId={(r) => `${r.locationId}:${r.skuId}`}
          skeletonColumns={11}
          empty={empty}
          pager={pager}
        />
      ) : null}
      {tab === 'lot' ? (
        <StockTable
          query={byLot}
          columns={lotColumns}
          getRowId={(r) => `${r.lotId ?? 'no-lot'}:${r.skuId}`}
          skeletonColumns={9}
          empty={empty}
          pager={pager}
        />
      ) : null}
    </div>
  );
}
