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
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import {
  formatDate,
  formatMoney,
  formatQuantity,
  formatRelative,
  gramsToKg,
  kgToGrams,
} from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState, type SortState } from '@/lib/url-state';
import { ALL_WAREHOUSES, useWarehouse } from '@/lib/warehouse';
import {
  stockKeys,
  useSetActualStock,
  useSetSkuCosts,
  useSetSkuWeights,
  useStockBySku,
  useStockByLocation,
  useStockByLot,
  type StockByLocationRow,
  type StockByLotRow,
  type StockRow,
  type StockSortField,
} from '../api/use-stock';
import { isNegativeQty, locationTypeLabel } from '../labels';

/**
 * G-01 Tồn kho — ba mặt đọc, ba endpoint:
 *   Theo SKU     → GET /stock             (gộp toàn kho, sắp theo mã SKU; bấm tiêu đề Cân nặng /
 *                                           Tồn thực / Đang giữ / Khả dụng để sắp phía server)
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
 * Phần tồn tăng thêm của SKU chưa có giá vốn mang giá 0 (user chốt 2026-10-19); SKU chưa có vị trí
 * trong kho thì server đưa hàng vào vị trí DEFAULT của kho.
 *
 * Nhập song song (2026-10-19): cột Tồn thực tế cho người có stock.adjust (kho, theo kho đang chọn),
 * cột Giá vốn cho người có stock.cost (kế toán — POST /stock/costs đặt giá cho mọi tồn còn lại của
 * SKU, không theo kho). Ai có quyền nào thấy cột đó; Lưu ghi số lượng trước rồi giá vốn.
 *
 * Cân nặng (2026-10-20): cột "Cân nặng" (gram, đọc từ Sku.weightKg) trên tab Theo SKU; ở chế độ
 * nhập, người có stock.adjust gõ cân nặng từng SKU theo gram (không cần chọn kho — cân nặng là
 * thuộc tính sản phẩm) → POST /stock/weights (kg). Dùng cho khối lượng gửi hãng và đẩy Pancake.
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
/** Gram, tối đa 1 chữ số lẻ (API giữ kg 4 chữ số lẻ). */
const WEIGHT_RE = /^\d{1,9}(\.\d)?$/;

/** Bản nháp một SKU: số đếm (kho), giá vốn (kế toán), cân nặng gram (kho) độc lập — '' = không đổi. */
interface CountDraft {
  qty: string;
  unitCost: string;
  weightG: string;
}

const EMPTY_DRAFT: CountDraft = { qty: '', unitCost: '', weightG: '' };
const draftEmpty = (d: CountDraft) => d.qty === '' && d.unitCost === '' && d.weightG === '';

/** Dòng nháp sai định dạng (ô đã gõ mà không phải số hợp lệ). */
function draftInvalid(d: CountDraft): boolean {
  return (
    (d.qty !== '' && !QTY_RE.test(d.qty)) ||
    (d.unitCost !== '' && !COST_RE.test(d.unitCost)) ||
    (d.weightG !== '' && !WEIGHT_RE.test(d.weightG))
  );
}

interface CountContextValue {
  drafts: Record<string, CountDraft>;
  setDraft: (row: StockRow, patch: Partial<CountDraft>) => void;
}

/** Cân nặng kg (API) → "250 g" / "1.500 g"; null = chưa cân. */
function formatGrams(weightKg: string | null): string {
  return weightKg === null ? '—' : formatQuantity(kgToGrams(weightKg), { maxDp: 1, unit: 'g' });
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

/** Giá vốn / ĐVT (kế toán): gợi ý = giá vốn hiện tại của tồn còn lại; trống = không đổi. */
function CountCostCell({ row }: { row: StockRow }) {
  const ctx = useContext(CountContext)!;
  const d = ctx.drafts[row.skuId];
  const value = d?.unitCost ?? '';
  const invalid = value !== '' && !COST_RE.test(value);
  return (
    <Input
      inputMode="decimal"
      aria-label={`Giá vốn ${row.skuCode}`}
      placeholder={row.unitCost === null ? 'chưa có' : formatMoney(row.unitCost)}
      value={value}
      onChange={(e) =>
        ctx.setDraft(row, { unitCost: e.target.value.trim().replace(/[.,\s]/g, '') })
      }
      aria-invalid={invalid || undefined}
      className={cn('h-8 text-right', invalid && 'border-destructive')}
    />
  );
}

/** Cân nặng gram (kho): gợi ý = cân nặng hiện tại; trống = không đổi. Enter sang dòng dưới. */
function CountWeightCell({ row }: { row: StockRow }) {
  const ctx = useContext(CountContext)!;
  const value = ctx.drafts[row.skuId]?.weightG ?? '';
  const invalid = value !== '' && !WEIGHT_RE.test(value);
  return (
    <Input
      data-count-input
      inputMode="decimal"
      aria-label={`Cân nặng ${row.skuCode}`}
      placeholder={row.weightKg === null ? 'chưa cân' : kgToGrams(row.weightKg)}
      value={value}
      onChange={(e) => ctx.setDraft(row, { weightG: e.target.value.trim().replace(',', '.') })}
      onKeyDown={focusNextCountInput}
      aria-invalid={invalid || undefined}
      className={cn('h-8 text-right', invalid && 'border-destructive')}
    />
  );
}

const STOCK_SORTABLE = new Set<string>([
  'weight',
  'onHand',
  'reserved',
  'available',
] satisfies StockSortField[]);

const TABS: Array<{ key: StockTabKey; label: string }> = [
  { key: 'sku', label: 'Theo SKU' },
  { key: 'location', label: 'Theo vị trí' },
  { key: 'lot', label: 'Theo lô' },
];

function parseTab(v: string | undefined): StockTabKey {
  return v === 'location' || v === 'lot' ? v : 'sku';
}

/**
 * Ba cột số dùng chung cho cả ba mặt — cùng thứ tự, cùng cách đọc. `sortable` chỉ bật ở mặt
 * Theo SKU (GET /stock nhận sortBy = id cột); hai mặt bóc tách giữ thứ tự cố định của API.
 */
function quantityColumns<T extends { onHand: string; reserved: string; available: string }>(
  sortable = false,
): ColumnDef<T, unknown>[] {
  return [
    {
      id: 'onHand',
      header: 'Tồn thực',
      meta: { align: 'right', width: 110, sortable },
      cell: ({ row }) => formatQuantity(row.original.onHand),
    },
    {
      id: 'reserved',
      header: 'Đang giữ',
      meta: { align: 'right', width: 110, sortable },
      cell: ({ row }) => formatQuantity(row.original.reserved),
    },
    {
      id: 'available',
      header: 'Khả dụng',
      meta: { align: 'right', width: 120, sortable },
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
  {
    id: 'weight',
    header: 'Cân nặng',
    meta: { align: 'right', width: 110, sortable: true },
    cell: ({ row }) => (
      <span className={cn(row.original.weightKg === null && 'text-muted-foreground')}>
        {formatGrams(row.original.weightKg)}
      </span>
    ),
  },
  ...quantityColumns<StockRow>(true),
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

const qtyEditColumns: ColumnDef<StockRow, unknown>[] = [
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
];
const costEditColumn: ColumnDef<StockRow, unknown> = {
  id: 'actualCost',
  header: 'Giá vốn / ĐVT',
  meta: { align: 'right', width: 140 },
  cell: ({ row }) => <CountCostCell row={row.original} />,
};
const weightEditColumn: ColumnDef<StockRow, unknown> = {
  id: 'actualWeight',
  header: 'Cân nặng (g)',
  meta: { align: 'right', width: 130 },
  cell: ({ row }) => <CountWeightCell row={row.original} />,
};
/** Chế độ nhập: bỏ cột Ghi chú và cột Cân nặng chỉ-đọc (thay bằng ô nhập khi có quyền). */
const baseEditColumns = skuColumns.filter((c) => c.id !== 'flags' && c.id !== 'weight');
/**
 * Tab Theo SKU ở chế độ nhập: cột theo quyền — số lượng (stock.adjust + đã chọn kho), cân nặng
 * (stock.adjust), giá vốn (stock.cost). Mọi biến thể khai sẵn ở cấp module để danh tính cột không
 * đổi giữa các lần render (ô nhập không mất focus).
 */
function buildEditColumns(opts: {
  qty: boolean;
  weight: boolean;
  cost: boolean;
}): ColumnDef<StockRow, unknown>[] {
  return [
    ...baseEditColumns,
    ...(opts.qty ? qtyEditColumns : []),
    ...(opts.weight ? [weightEditColumn] : []),
    ...(opts.cost ? [costEditColumn] : []),
  ];
}
const editColumnsByKey = new Map<string, ColumnDef<StockRow, unknown>[]>();
function editColumnsFor(opts: { qty: boolean; weight: boolean; cost: boolean }) {
  const key = `${opts.qty ? 'q' : ''}${opts.weight ? 'w' : ''}${opts.cost ? 'c' : ''}`;
  let cols = editColumnsByKey.get(key);
  if (!cols) {
    cols = buildEditColumns(opts);
    editColumnsByKey.set(key, cols);
  }
  return cols;
}

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

  const ability = useAbility();
  const canAdjust = ability.can('adjust', 'Stock');
  const canCost = ability.can('cost', 'Stock');
  const warehouse = useWarehouse();
  const countWarehouseId =
    warehouse.selected && warehouse.selected !== ALL_WAREHOUSES ? warehouse.selected : null;
  const countWarehouseName = warehouse.options.find((o) => o.id === countWarehouseId)?.name;
  const [counting, setCounting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  // Luật 4: key sinh LÚC BẤM, bấm lại sau lỗi dùng lại đúng key; bản nháp đổi → key mới.
  const saveKey = useRef<string | null>(null);
  const setActual = useSetActualStock();
  const setCosts = useSetSkuCosts();
  const setWeights = useSetSkuWeights();
  const saving = setActual.isPending || setCosts.isPending || setWeights.isPending;
  // Cột số lượng cần một kho cụ thể; cột cân nặng (stock.adjust) và giá vốn (stock.cost) không theo kho.
  const qtyEditable = canAdjust && countWarehouseId !== null;
  const editMode = canAdjust || canCost;
  const editColumns = editColumnsFor({ qty: qtyEditable, weight: canAdjust, cost: canCost });
  const editLabel =
    canAdjust && canCost ? 'Nhập tồn & giá vốn' : canCost ? 'Nhập giá vốn' : 'Nhập tồn thực tế';

  const setDraft = useCallback<CountContextValue['setDraft']>((row, patch) => {
    saveKey.current = null;
    setDrafts((prev) => {
      const next = { ...EMPTY_DRAFT, ...prev[row.skuId], ...patch };
      // Xoá trắng mọi ô = bỏ dòng khỏi bản nháp (không đổi gì SKU đó).
      if (draftEmpty(next)) {
        return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== row.skuId));
      }
      return { ...prev, [row.skuId]: next };
    });
  }, []);
  const countCtx = useMemo<CountContextValue>(() => ({ drafts, setDraft }), [drafts, setDraft]);

  const draftList = Object.entries(drafts);
  const invalidCount = draftList.filter(([, d]) => draftInvalid(d)).length;

  const stopCounting = () => {
    setCounting(false);
    setDrafts({});
    saveKey.current = null;
  };

  /** Bỏ phần đã lưu (số lượng / giá / cân nặng) khỏi bản nháp — lô sau lỗi không làm mất lô trước. */
  const clearSaved = (ids: Set<string>, part: keyof CountDraft) =>
    setDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).flatMap(([id, d]) => {
          if (!ids.has(id)) return [[id, d]];
          const next = { ...d, [part]: '' };
          return draftEmpty(next) ? [] : [[id, next]];
        }),
      ),
    );

  const saveActual = async () => {
    if (draftList.length === 0 || invalidCount > 0) return;
    const qtyLines =
      qtyEditable && countWarehouseId
        ? draftList
            .filter(([, d]) => d.qty !== '')
            .map(([id, d]) => ({ skuId: id, qtyCounted: d.qty }))
        : [];
    const costLines = canCost
      ? draftList
          .filter(([, d]) => d.unitCost !== '')
          .map(([id, d]) => ({ skuId: id, unitCost: d.unitCost }))
      : [];
    // Gram ở ô nhập → kg cho API, đổi đơn vị chỉ ở đây (luật 10).
    const weightLines = canAdjust
      ? draftList
          .filter(([, d]) => d.weightG !== '')
          .map(([id, d]) => ({ skuId: id, weightKg: gramsToKg(d.weightG) }))
      : [];
    const done: string[] = [];
    try {
      if (qtyLines.length && countWarehouseId) {
        const key = (saveKey.current ??= crypto.randomUUID());
        let adjusted = 0;
        let unchanged = 0;
        const docs: string[] = [];
        for (let i = 0; i < qtyLines.length; i += ACTUAL_BATCH) {
          const batch = qtyLines.slice(i, i + ACTUAL_BATCH);
          const r = await setActual.mutateAsync({
            key: `${key}-${i / ACTUAL_BATCH}`,
            body: { warehouseId: countWarehouseId, lines: batch },
          });
          adjusted += r.adjustedSkuCount;
          unchanged += r.unchangedSkuCount;
          if (r.docNumber) docs.push(r.docNumber);
          clearSaved(new Set(batch.map((l) => l.skuId)), 'qty');
        }
        saveKey.current = null;
        done.push(
          adjusted > 0
            ? `tồn thực tế ${adjusted} SKU lệch${docs.length ? ` (${docs.join(', ')})` : ''}, ${unchanged} SKU khớp`
            : `tồn thực tế ${unchanged} SKU khớp, không ghi gì`,
        );
      }
      // Giá vốn SAU số lượng: phần tồn vừa tăng thêm cũng nhận giá kế toán nhập.
      if (costLines.length) {
        let updated = 0;
        let skipped = 0;
        for (let i = 0; i < costLines.length; i += ACTUAL_BATCH) {
          const batch = costLines.slice(i, i + ACTUAL_BATCH);
          const r = await setCosts.mutateAsync({ lines: batch });
          updated += r.updatedSkuCount;
          skipped += r.skippedSkuIds.length;
          clearSaved(new Set(batch.map((l) => l.skuId)), 'unitCost');
        }
        done.push(
          `giá vốn ${updated} SKU${skipped ? ` (${skipped} SKU không còn tồn — không đổi)` : ''}`,
        );
      }
      if (weightLines.length) {
        let updated = 0;
        for (let i = 0; i < weightLines.length; i += ACTUAL_BATCH) {
          const batch = weightLines.slice(i, i + ACTUAL_BATCH);
          const r = await setWeights.mutateAsync({ lines: batch });
          updated += r.updatedSkuCount;
          clearSaved(new Set(batch.map((l) => l.skuId)), 'weightG');
        }
        done.push(`cân nặng ${updated} SKU`);
      }
      if (done.length) toast.success(`Đã lưu ${done.join('; ')}`);
    } catch (err) {
      saveKey.current = null;
      toast.error(messageFor(err));
    }
  };

  const listParams = useMemo(
    () => ({ q: state.q, erpOnly: true, ...skipTake }),
    [state.q, skipTake],
  );
  // Chỉ cột trong whitelist sort của GET /stock mới gửi lên — sort lạ trên URL bị bỏ qua.
  const sortBy =
    state.sort && STOCK_SORTABLE.has(state.sort.id) ? (state.sort.id as StockSortField) : undefined;
  const sortDir = sortBy ? (state.sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined;
  const skuParams = useMemo(
    () => ({ ...listParams, sortBy, sortDir }),
    [listParams, sortBy, sortDir],
  );
  const breakdownParams = useMemo(
    () => ({ ...listParams, skuId, locationId }),
    [listParams, skuId, locationId],
  );

  const bySku = useStockBySku(skuParams, tab === 'sku');
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
          (canAdjust || canCost) && !counting ? (
            <Button
              variant="outline"
              onClick={() => {
                setCounting(true);
                if (tab !== 'sku') setFilter({ tab: undefined });
              }}
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              {editLabel}
            </Button>
          ) : null
        }
      />

      {counting ? (
        <div className="flex flex-col gap-1 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-xs">
          {canAdjust ? (
            countWarehouseId ? (
              <span>
                Đang nhập tồn thực tế cho kho{' '}
                <b className="font-semibold text-foreground">{countWarehouseName ?? 'đang chọn'}</b>
                . Gõ số đếm theo <b className="font-semibold">ĐVT cơ sở</b> vào cột Tồn thực tế
                (Enter sang dòng dưới), để trống là không đổi. Hệ thống ghi phần chênh lệch vào tồn
                và sinh phiếu kiểm kê đã ghi sổ để tra lại. Sản phẩm chưa có vị trí trong kho được
                đưa vào vị trí DEFAULT để lên đơn được ngay; tồn tăng thêm chưa có giá vốn tính giá
                0 tới khi kế toán nhập giá. Tồn thực tế không được thấp hơn phần đang giữ cho đơn.
              </span>
            ) : (
              <span className="text-destructive">
                Đang xem tất cả kho. Chọn một kho ở ô kho làm việc (thanh bên trái) để nhập tồn thực
                tế cho kho đó. Cân nặng vẫn nhập được.
              </span>
            )
          ) : null}
          {canAdjust ? (
            <span>
              Cột <b className="font-semibold">Cân nặng (g)</b>: cân nặng một {''}
              <b className="font-semibold">ĐVT cơ sở</b> theo gram (vd 250 = 250 g, 1500 = 1,5 kg),
              áp cho sản phẩm ở mọi kho; ô mờ là cân nặng hiện tại, để trống là không đổi. Dùng để
              tính khối lượng gửi hãng vận chuyển.
            </span>
          ) : null}
          {canCost ? (
            <span>
              Cột <b className="font-semibold">Giá vốn / ĐVT</b>: giá mới áp cho toàn bộ tồn còn lại
              của sản phẩm ở mọi kho; ô mờ là giá vốn hiện tại, để trống là không đổi. Đơn đã đóng
              gói giữ giá vốn cũ.
            </span>
          ) : null}
          <span className="text-muted-foreground">
            Số đã gõ giữ nguyên khi tìm kiếm hay sang trang.
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
            columns={counting && editMode ? editColumns : skuColumns}
            getRowId={(r) => r.skuId}
            skeletonColumns={counting ? 10 : 8}
            empty={empty}
            pager={pager}
          />
        </CountContext.Provider>
      ) : null}

      {counting ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background py-2">
          <span className="text-sm">
            <b className="font-semibold">{draftList.length}</b> SKU đã nhập
            {invalidCount > 0 ? (
              <span className="text-destructive">
                {' '}
                · {invalidCount} dòng chưa hợp lệ (số lượng, giá vốn hoặc cân nặng sai định dạng)
              </span>
            ) : null}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={stopCounting} disabled={saving}>
              {draftList.length > 0 ? 'Bỏ nhập' : 'Đóng'}
            </Button>
            <Button
              onClick={() => void saveActual()}
              disabled={!editMode || draftList.length === 0 || invalidCount > 0 || saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
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
