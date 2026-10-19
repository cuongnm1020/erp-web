'use client';

import Decimal from 'decimal.js';
import { ClipboardCheck, Info } from 'lucide-react';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatQuantity, formatRelative } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState, type SortState } from '@/lib/url-state';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';
import {
  stockKeys,
  useSetActualStock,
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
 * - Kho: theo ô chọn kho làm việc ở sidebar (header X-Warehouse-Id, PLAN-warehouse-context) —
 *   không còn tham số kho riêng trên URL.
 *
 * 2026-10-19 (đưa phần mềm vào kho đang chạy): chỉ hiện hàng tạo trong ERP (`erpOnly` — bỏ hàng
 * đơn Pancake tự sinh, combo, SKU đã xoá) và chế độ "Nhập tồn thực tế" trên tab Theo SKU: người có
 * quyền điều chỉnh tồn gõ số đếm theo ĐVT cơ sở cho kho đang chọn, bản nháp giữ qua các trang,
 * Lưu → POST /cycle-counts/actual-stock ghi thẳng phần lệch (phiếu kiểm kê CC-… đã ghi sổ).
 * SKU chưa có giá vốn mà số đếm cao hơn tồn sổ phải nhập giá vốn (user chốt — FIFO cần lô giá).
 */
const DEFAULTS = {
  size: 50,
  filterKeys: ['tab', 'skuId', 'locationId'] as const,
};

type StockFilter = (typeof DEFAULTS.filterKeys)[number];
type StockTabKey = 'sku' | 'location' | 'lot';

/** Server nhận tối đa 200 dòng / lần — nhiều hơn thì gửi tuần tự từng lô. */
const ACTUAL_BATCH = 200;
const QTY_RE = /^\d+(\.\d{1,6})?$/;
const COST_RE = /^\d+(\.\d{1,4})?$/;

interface CountDraft {
  skuCode: string;
  /** Tồn sổ của kho lúc gõ — chỉ để hiện chênh lệch; server tự tính lại lúc ghi. */
  onHand: string;
  hasCost: boolean;
  qty: string;
  unitCost: string;
}

/** Bản nháp đã hợp lệ chưa + có cần giá vốn không (số đếm cao hơn tồn sổ, SKU chưa có giá). */
function draftState(d: CountDraft): { qtyOk: boolean; needsCost: boolean; costOk: boolean } {
  const qtyOk = QTY_RE.test(d.qty);
  const needsCost = qtyOk && !d.hasCost && new Decimal(d.qty).greaterThan(d.onHand);
  const costOk = !needsCost || COST_RE.test(d.unitCost);
  return { qtyOk, needsCost, costOk };
}

interface CountContextValue {
  drafts: Record<string, CountDraft>;
  /** SKU server báo thiếu giá vốn ở lần lưu trước — tô đỏ ô giá. */
  costMissing: string | null;
  setDraft: (row: StockRow, patch: Partial<Pick<CountDraft, 'qty' | 'unitCost'>>) => void;
}

/**
 * Bản nháp số đếm đi qua context để cột của bảng giữ nguyên danh tính — ô nhập không bị dựng lại
 * (mất focus) mỗi lần gõ.
 */
const CountContext = createContext<CountContextValue | null>(null);

/** Enter → sang ô tồn thực tế của dòng kế tiếp: đi hết bảng bằng bàn phím. */
function focusNextCountInput(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-count-input]'));
  all[all.indexOf(e.currentTarget) + 1]?.focus();
}

function CountQtyCell({ row }: { row: StockRow }) {
  const ctx = useContext(CountContext)!;
  const d = ctx.drafts[row.skuId];
  const invalid = d !== undefined && d.qty !== '' && !QTY_RE.test(d.qty);
  return (
    <Input
      data-count-input
      inputMode="decimal"
      aria-label={`Tồn thực tế ${row.skuCode}`}
      placeholder={formatQuantity(row.onHand)}
      value={d?.qty ?? ''}
      onChange={(e) => ctx.setDraft(row, { qty: e.target.value.trim().replace(',', '.') })}
      onKeyDown={focusNextCountInput}
      aria-invalid={invalid || undefined}
      className={cn('h-8 text-right', invalid && 'border-destructive')}
    />
  );
}

function CountDiffCell({ row }: { row: StockRow }) {
  const d = useContext(CountContext)!.drafts[row.skuId];
  if (!d || !QTY_RE.test(d.qty)) return <span className="text-muted-foreground">—</span>;
  const diff = new Decimal(d.qty).minus(row.onHand);
  if (diff.isZero()) return <span className="text-muted-foreground">khớp</span>;
  return (
    <span className={cn('font-semibold', diff.isNegative() ? 'text-destructive' : 'text-success')}>
      {diff.isPositive() ? '+' : ''}
      {formatQuantity(diff.toString())}
    </span>
  );
}

function CountCostCell({ row }: { row: StockRow }) {
  const ctx = useContext(CountContext)!;
  const d = ctx.drafts[row.skuId];
  if (!d || !draftState(d).needsCost) {
    return row.hasCost ? null : <span className="text-xs text-muted-foreground">chưa có</span>;
  }
  const invalid =
    (d.unitCost !== '' && !COST_RE.test(d.unitCost)) ||
    (ctx.costMissing === row.skuId && d.unitCost === '');
  return (
    <Input
      inputMode="decimal"
      aria-label={`Giá vốn ${row.skuCode}`}
      placeholder="Bắt buộc"
      value={d.unitCost}
      onChange={(e) =>
        ctx.setDraft(row, { unitCost: e.target.value.trim().replace(/[.,\s]/g, '') })
      }
      aria-invalid={invalid || undefined}
      className={cn('h-8 text-right', (invalid || d.unitCost === '') && 'border-destructive')}
    />
  );
}

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

/** Tab Theo SKU ở chế độ nhập tồn thực tế: bỏ cột Ghi chú, thêm ô nhập + chênh lệch + giá vốn. */
const countColumns: ColumnDef<StockRow, unknown>[] = [
  ...skuColumns.filter((c) => c.id !== 'flags'),
  {
    id: 'actualQty',
    header: 'Tồn thực tế',
    meta: { align: 'right', width: 130 },
    cell: ({ row }) => <CountQtyCell row={row.original} />,
  },
  {
    id: 'actualDiff',
    header: 'Chênh lệch',
    meta: { align: 'right', width: 110 },
    cell: ({ row }) => <CountDiffCell row={row.original} />,
  },
  {
    id: 'actualCost',
    header: 'Giá vốn / ĐVT',
    meta: { align: 'right', width: 140 },
    cell: ({ row }) => <CountCostCell row={row.original} />,
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
  const skuId = state.filters.skuId ?? '';
  const locationId = state.filters.locationId ?? '';

  const canAdjust = useAbility().can('adjust', 'Stock');
  const warehouse = useWarehouse();
  const countWarehouseId =
    warehouse.selected && warehouse.selected !== ALL_WAREHOUSES ? warehouse.selected : null;
  const countWarehouseName = warehouse.options.find((o) => o.id === countWarehouseId)?.name;
  const [counting, setCounting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  const [costMissing, setCostMissing] = useState<string | null>(null);
  // Luật 4: key sinh LÚC BẤM, bấm lại sau lỗi dùng lại đúng key; bản nháp đổi → key mới.
  const saveKey = useRef<string | null>(null);
  const setActual = useSetActualStock();

  const setDraft = useCallback<CountContextValue['setDraft']>((row, patch) => {
    saveKey.current = null;
    setDrafts((prev) => {
      const cur = prev[row.skuId] ?? {
        skuCode: row.skuCode,
        onHand: row.onHand,
        hasCost: row.hasCost,
        qty: '',
        unitCost: '',
      };
      const next = { ...cur, ...patch };
      // Xoá trắng số đếm = bỏ dòng khỏi bản nháp (không đổi tồn SKU đó).
      if (next.qty === '') {
        return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== row.skuId));
      }
      return { ...prev, [row.skuId]: next };
    });
  }, []);
  const countCtx = useMemo<CountContextValue>(
    () => ({ drafts, costMissing, setDraft }),
    [drafts, costMissing, setDraft],
  );

  const draftList = Object.entries(drafts);
  const draftInvalid = draftList.filter(([, d]) => {
    const st = draftState(d);
    return !st.qtyOk || !st.costOk;
  }).length;

  const stopCounting = () => {
    setCounting(false);
    setDrafts({});
    setCostMissing(null);
    saveKey.current = null;
  };

  const saveActual = async () => {
    if (!countWarehouseId || draftList.length === 0 || draftInvalid > 0) return;
    const key = (saveKey.current ??= crypto.randomUUID());
    const lines = draftList.map(([id, d]) => ({
      skuId: id,
      qtyCounted: d.qty,
      ...(draftState(d).needsCost ? { unitCost: d.unitCost } : {}),
    }));
    let adjusted = 0;
    let unchanged = 0;
    const docs: string[] = [];
    try {
      for (let i = 0; i < lines.length; i += ACTUAL_BATCH) {
        const batch = lines.slice(i, i + ACTUAL_BATCH);
        const r = await setActual.mutateAsync({
          key: `${key}-${i / ACTUAL_BATCH}`,
          body: { warehouseId: countWarehouseId, lines: batch },
        });
        adjusted += r.adjustedSkuCount;
        unchanged += r.unchangedSkuCount;
        if (r.docNumber) docs.push(r.docNumber);
        // Lô đã ghi thì bỏ khỏi bản nháp — lô sau lỗi không làm mất lô trước.
        const saved = new Set(batch.map((l) => l.skuId));
        setDrafts((prev) =>
          Object.fromEntries(Object.entries(prev).filter(([id]) => !saved.has(id))),
        );
      }
      saveKey.current = null;
      setCostMissing(null);
      toast.success(
        adjusted > 0
          ? `Đã lưu tồn thực tế: ${adjusted} SKU lệch đã ghi${docs.length ? ` (${docs.join(', ')})` : ''}, ${unchanged} SKU khớp`
          : `Đã lưu tồn thực tế: ${unchanged} SKU khớp tồn hệ thống, không ghi gì`,
      );
    } catch (err) {
      saveKey.current = null;
      if (err instanceof ApiError && err.code === 'ACTUAL_STOCK_COST_REQUIRED') {
        const d = err.details as { skuId?: unknown } | null;
        setCostMissing(typeof d?.skuId === 'string' ? d.skuId : null);
      }
      toast.error(messageFor(err));
    }
  };

  const listParams = useMemo(
    () => ({ q: state.q, erpOnly: true, ...skipTake }),
    [state.q, skipTake],
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

  const hasFilter = state.q !== '' || skuId !== '' || locationId !== '';
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
        actions={
          canAdjust && !counting ? (
            <Button
              variant="outline"
              onClick={() => {
                setCounting(true);
                if (tab !== 'sku') setFilter({ tab: undefined });
              }}
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Nhập tồn thực tế
            </Button>
          ) : null
        }
      />

      {counting ? (
        <div className="flex flex-col gap-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          {countWarehouseId ? (
            <span>
              Đang nhập tồn thực tế cho kho{' '}
              <b className="font-semibold text-foreground">{countWarehouseName ?? 'đang chọn'}</b>.
              Gõ số đếm theo <b className="font-semibold">ĐVT cơ sở</b> vào cột Tồn thực tế (Enter
              sang dòng dưới), để trống là không đổi. Số đã gõ giữ nguyên khi tìm kiếm hay sang
              trang. Bấm <b className="font-semibold">Lưu tồn thực tế</b> để ghi phần chênh lệch vào
              tồn — hệ thống sinh phiếu kiểm kê đã ghi sổ để tra lại.
            </span>
          ) : (
            <span className="text-destructive">
              Đang xem tất cả kho. Chọn một kho ở ô kho làm việc (thanh bên trái) để nhập tồn thực
              tế cho kho đó.
            </span>
          )}
          <span className="text-muted-foreground">
            Sản phẩm chưa có giá vốn mà tồn thực tế cao hơn tồn hệ thống cần nhập giá vốn / ĐVT cơ
            sở (dùng tính lãi lỗ). Tồn thực tế không được thấp hơn phần đang giữ cho đơn.
          </span>
        </div>
      ) : null}

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
        {(counting ? TABS.filter((t) => t.key === 'sku') : TABS).map((t) => (
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
        // KHÔNG đưa `tab` vào values: tab là chế độ xem, "Xóa lọc" không được reset nó
        values={{
          skuId: state.filters.skuId,
          locationId: state.filters.locationId,
        }}
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
        <CountContext.Provider value={countCtx}>
          <StockTable
            query={bySku}
            columns={counting && countWarehouseId ? countColumns : skuColumns}
            getRowId={(r) => r.skuId}
            skeletonColumns={counting ? 9 : 7}
            empty={empty}
            pager={pager}
          />
        </CountContext.Provider>
      ) : null}

      {counting ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background py-2">
          <span className="text-sm">
            <b className="font-semibold">{draftList.length}</b> SKU đã nhập
            {draftInvalid > 0 ? (
              <span className="text-destructive">
                {' '}
                · {draftInvalid} dòng chưa hợp lệ (số lượng sai định dạng hoặc thiếu giá vốn)
              </span>
            ) : null}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={stopCounting} disabled={setActual.isPending}>
              {draftList.length > 0 ? 'Bỏ nhập' : 'Đóng'}
            </Button>
            <Button
              onClick={() => void saveActual()}
              disabled={
                !countWarehouseId ||
                draftList.length === 0 ||
                draftInvalid > 0 ||
                setActual.isPending
              }
            >
              {setActual.isPending ? 'Đang lưu…' : 'Lưu tồn thực tế'}
            </Button>
          </div>
        </div>
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
