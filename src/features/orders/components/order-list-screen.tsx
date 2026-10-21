'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import { MessageSquareText, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CopyText } from '@/components/data/copy-text';
import { ColumnPicker, DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  normalizePhone,
  formatQuantity,
  formatRelative,
  phoneCarrier,
  toDecimal,
} from '@/lib/format';
import { Can } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState, type SortState } from '@/lib/url-state';
import { useWarehouse } from '@/lib/warehouse';
import { useCarriers } from '@/features/wms/api/use-shipping';
import {
  orderKeys,
  useOrderFlowCounts,
  useOrderListPrefs,
  useOrders,
  usePancakeShops,
  useSaveOrderListPrefs,
  type OrderFlow,
  type OrderItemOrigin,
  type OrderSortField,
  type SalesOrderListItem,
} from '../api/use-orders';
import { fulfilmentLabel, ORDER_FLOW_TABS, parseOrderFlow, parseOrderStatus } from '../labels';
import { BulkCancelDialog } from './bulk-cancel-dialog';
import { BulkMoveWarehouseDialog } from './bulk-move-warehouse-dialog';
import { BulkFulfilPrintDialog } from './bulk-fulfil-print-dialog';
import { BulkReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { FlowBadge, OrderQuickView, TelcoBadge } from './order-quick-view';
import { PancakeOrderResyncButton } from './pancake-order-resync-button';
import { SendToCarrierMenu } from './send-to-carrier-menu';
import { PancakeOrderLink } from './pancake-order-link';

/**
 * D-03 Quản lý đơn hàng — GET /sales-orders + GET /sales-orders/flow-counts (thiết kế lại
 * 2026-10-12, canvas "Quản lý đơn hàng — thiết kế lại").
 *
 * Dữ liệu đã được API scope theo khách hàng (bất biến 8): sale chỉ thấy đơn của khách mình
 * phụ trách; số đếm tab cũng do API tính theo scope. Frontend KHÔNG lọc lại theo quyền (luật 7).
 *
 * Tab = luồng chung của đơn (Chờ duyệt → … → Thành công | Sự cố hoàn | Hãng hủy | Đã hủy, bảng
 * trạng thái ở apps/api/docs/carrier-status-mapping.md) — `?flow=` trên URL cùng mọi bộ lọc,
 * trang (luật 8). Bấm một dòng → xem nhanh bên phải; bấm số đơn → màn chi tiết. Chọn nhiều dòng →
 * "Gửi sang ĐVVC" / "Gán hãng / cân nặng" / "In lại vận đơn" (tem ERP 100×75, đơn đã có mã).
 *
 * Trạng thái không sửa tay trên dòng (khác Pancake): trạng thái do quy trình kho + hãng cập nhật.
 * Chưa làm so với canvas (cần API riêng): Nhập / Xuất Excel, In nhãn hàng loạt, Hủy đơn hàng
 * loạt, lọc theo người phụ trách (chưa có danh bạ người dùng cho sale).
 */
const DEFAULTS = {
  size: 50,
  filterKeys: [
    'flow',
    'status',
    'customerId',
    'weightMin',
    'weightMax',
    'noCarrier',
    'carrierId',
    // Kho: ô chọn kho làm việc ở sidebar (header X-Warehouse-Id) — không còn bộ lọc kho riêng.
    'source',
    'from',
    'to',
    // CSKH-5: chỉ đơn trùng trong ngày (cùng SĐT, cùng ngày VN, chưa hủy).
    'duplicate',
    // Đơn có sản phẩm không phải hàng ERP (món gõ tay / SKU Pancake tự sinh), 2026-10-22.
    'itemOrigin',
  ] as const,
};

const ITEM_ORIGIN_OPTIONS: { value: OrderItemOrigin; label: string }[] = [
  { value: 'NON_ERP', label: 'Có SP không phải hàng ERP' },
  { value: 'CUSTOM', label: 'Có món gõ tay trên Pancake' },
  { value: 'POS_SKU', label: 'Có SP Pancake tự tạo' },
];
const parseItemOrigin = (v: string | undefined): OrderItemOrigin | undefined =>
  ITEM_ORIGIN_OPTIONS.find((o) => o.value === v)?.value;

/**
 * Cột sắp được → trường `sortBy` của API. Cột không có ở đây không sắp được (sản phẩm, vận
 * chuyển… là dữ liệu ghép từ nhiều nguồn, server không sắp theo chúng).
 */
const SORT_FIELD: Record<string, OrderSortField> = {
  docNumber: 'docNumber',
  orderDate: 'orderDate',
  customer: 'customer',
  total: 'total',
  time: 'time',
};

/** Cột ẩn khi người dùng chưa chọn lần nào. */
const DEFAULT_HIDDEN = ['orderDate'];

type OrderFilter = (typeof DEFAULTS.filterKeys)[number];

/**
 * Cột của bảng — `carrierOf` tra mã + tên hãng chọn trên đơn khi kho chưa tạo phiếu giao,
 * `warehouseName` tra tên kho xuất của đơn.
 */
const buildColumns = (
  carrierOf: (id: string) => CarrierRef | null,
  warehouseName: (id: string) => string | null,
): ColumnDef<SalesOrderListItem, unknown>[] => [
  {
    id: 'docNumber',
    header: 'Mã đơn',
    meta: { width: 170, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/crm/orders/${o.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs font-medium text-primary hover:underline"
            >
              {o.docNumber}
            </Link>
            {o.note ? (
              <span title={o.note} className="inline-flex text-warning">
                <MessageSquareText className="h-3.5 w-3.5" aria-label="Có ghi chú" />
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="rounded-sm bg-muted px-1.5 font-medium">
              {o.pancakeOrderId ? (
                <PancakeOrderLink orderId={o.pancakeOrderId} link={o.pancakeOrderLink} />
              ) : (
                'ERP'
              )}
            </span>
          </div>
          {/* Sale một dòng riêng dưới mã Pancake — tên sale dài không còn đẩy / cắt mã đơn nguồn. */}
          {o.ownerName ? (
            <div className="max-w-40 truncate text-xs text-muted-foreground" title={o.ownerName}>
              {o.ownerName}
            </div>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'orderDate',
    header: 'Ngày đặt',
    meta: { width: 130, sortable: true },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs">{formatDateTime(row.original.orderDate)}</span>
    ),
  },
  {
    id: 'customer',
    header: 'Khách hàng',
    meta: { width: 200, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      const telco = phoneCarrier(o.phone);
      return (
        <div className="space-y-1">
          <span className="block max-w-48 truncate font-medium" title={o.customer.name}>
            {o.recipientName ?? o.customer.name}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {o.phone ? (
              // Viết liền (0356523006) để dán thẳng vào Zalo / tổng đài; bấm là sao chép.
              <CopyText
                value={normalizePhone(o.phone) ?? o.phone}
                what="số điện thoại"
                className="font-mono text-xs"
              />
            ) : (
              <span className="font-mono text-xs">{formatPhone(o.phone)}</span>
            )}
            {telco ? <TelcoBadge name={telco} /> : null}
          </span>
        </div>
      );
    },
  },
  {
    id: 'address',
    header: 'Địa chỉ nhận',
    meta: { width: 240 },
    cell: ({ row }) => (
      <div className="space-y-1">
        <span className="block max-w-60 truncate" title={row.original.addressLine ?? undefined}>
          {row.original.addressLine ?? '—'}
        </span>
        <span className="block text-xs text-muted-foreground">{row.original.province}</span>
      </div>
    ),
  },
  {
    id: 'product',
    header: 'Sản phẩm',
    meta: { width: 230 },
    cell: ({ row }) => {
      const p = row.original.product;
      if (!p) return <span className="text-muted-foreground">—</span>;
      const name = `${p.name} × ${formatQuantity(p.qty)}`;
      return (
        <div className="space-y-1">
          <span className="block max-w-56 truncate" title={name}>
            {name}
          </span>
          {p.moreCount > 0 ? (
            <span className="block text-xs text-primary">+{p.moreCount} sản phẩm khác</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'shipping',
    header: 'Vận chuyển',
    meta: { width: 200 },
    cell: ({ row }) => <ShippingCell order={row.original} carrierOf={carrierOf} />,
  },
  {
    id: 'warehouse',
    header: 'Kho',
    meta: { width: 120 },
    cell: ({ row }) => {
      const id = row.original.warehouseId;
      const name = id ? warehouseName(id) : null;
      return name ? (
        <span className="block max-w-28 truncate text-xs" title={name}>
          {name}
        </span>
      ) : (
        <span className="text-xs text-warning">Chưa chọn kho</span>
      );
    },
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    meta: { align: 'right', width: 120, sortable: true },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="space-y-1">
          <span className="block font-semibold">{formatMoney(o.total, { unit: '' })}</span>
          <span className="block text-xs text-muted-foreground">
            COD {formatMoney(o.shipment?.codAmount ?? o.total, { unit: '' })}
          </span>
        </div>
      );
    },
  },
  {
    id: 'collected',
    // Header dạng hàm để giữ tooltip giải thích (meta.title của DataTable là CHỮ tiêu đề; ô
    // chọn cột đọc meta.title).
    header: () => (
      <span
        className="block text-right"
        title="Ước tính: COD − phí VC khi giao thành công; − phí VC khi hoàn"
      >
        Thực thu ĐVVC
      </span>
    ),
    meta: { align: 'right', width: 120, title: 'Thực thu ĐVVC' },
    cell: ({ row }) => {
      const v = row.original.shipment?.collectedAmount;
      if (!v) return <span className="text-muted-foreground">—</span>;
      const negative = toDecimal(v)?.isNegative() ?? false;
      return (
        <span className={cn('font-semibold', negative && 'text-destructive')}>
          {formatMoney(v, { unit: '' })}
        </span>
      );
    },
  },
  {
    id: 'flow',
    header: 'Trạng thái',
    meta: { width: 140 },
    cell: ({ row }) => {
      const o = row.original;
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span title={o.fulfilmentStatus ? fulfilmentLabel(o.fulfilmentStatus) : undefined}>
            <FlowBadge flow={o.flow} />
          </span>
          {o.sameDayCount > 0 ? (
            <span title={`Cùng SĐT khách còn ${o.sameDayCount} đơn khác hôm đặt đơn này`}>
              <StatusBadge tone="warn">Trùng · {o.sameDayCount + 1} đơn</StatusBadge>
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    id: 'time',
    header: 'Thời gian',
    meta: { width: 130, sortable: true },
    cell: ({ row }) => (
      <div className="space-y-1 text-xs">
        <span className="block">{formatRelative(row.original.createdAt)}</span>
        <span className="block text-muted-foreground">
          TT: {formatRelative(row.original.statusChangedAt ?? row.original.updatedAt)}
        </span>
      </div>
    ),
  },
];

interface CarrierRef {
  code: string;
  name: string;
}

/**
 * Hãng (viết tắt = mã hãng: GHTK, VTP…) + phí VC + mã vận đơn; chưa có phiếu giao thì hãng chọn
 * trên đơn / "Chưa gán hãng". Có mã vận đơn → bấm mã hãng (hoặc mã vận đơn) là sao chép mã vận đơn.
 */
function ShippingCell({
  order,
  carrierOf,
}: {
  order: SalesOrderListItem;
  carrierOf: (id: string) => CarrierRef | null;
}) {
  const s = order.shipment;
  // Phiếu giao thắng; chưa có phiếu thì hãng sale chọn trên đơn (tra từ danh mục hãng).
  const picked = order.carrierId ? carrierOf(order.carrierId) : null;
  const code = s?.carrierCode ?? picked?.code ?? null;
  const fullName = s?.carrierName ?? picked?.name ?? code;
  const short = code ?? (order.carrierId ? 'Đã chọn hãng' : null);
  return (
    <div className="space-y-1 text-xs">
      {short ? (
        <span className="block whitespace-nowrap">
          {s?.trackingNo ? (
            <CopyText value={s.trackingNo} what="mã vận đơn" className="font-semibold">
              <span title={fullName ?? undefined}>{short}</span>
            </CopyText>
          ) : (
            <span className="font-semibold" title={fullName ?? undefined}>
              {short}
            </span>
          )}
          {s?.shipFee ? (
            <span className="text-muted-foreground">
              {' '}
              · phí {formatMoney(s.shipFee, { unit: '' })}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="block text-warning">Chưa gán hãng</span>
      )}
      {s?.trackingNo ? (
        <CopyText
          value={s.trackingNo}
          what="mã vận đơn"
          className="block max-w-48 truncate font-mono text-muted-foreground"
        />
      ) : (
        <WeightNote order={order} />
      )}
    </div>
  );
}

/**
 * Cân nặng gửi hãng hiệu lực (`weightKg` = đặt tay ?? Σ dòng × cân nặng SKU) khi chưa có mã vận
 * đơn — gom đơn theo cân để gán hãng. Đặt tay có dấu ✎ + tooltip Σ dòng; 0 = SKU chưa khai.
 */
function WeightNote({ order }: { order: SalesOrderListItem }) {
  const manual = order.shippingWeightKg !== null;
  if ((toDecimal(order.weightKg)?.isZero() ?? true) && !manual) return null;
  return (
    <span
      className="block tabular-nums text-muted-foreground"
      title={
        manual
          ? `Đặt tay · tính từ dòng: ${formatQuantity(order.lineWeightKg, { unit: 'kg' })}`
          : 'Tính từ cân nặng SKU'
      }
    >
      {formatQuantity(order.weightKg, { unit: 'kg' })}
      {manual ? (
        <span className="ml-1" aria-label="đặt tay">
          ✎
        </span>
      ) : null}
    </span>
  );
}

/** Tab luồng đơn + số đếm (API). Vạch dọc tách ba nhóm: ở kho / đang đi đường / đã xong. */
function FlowTabs({
  value,
  counts,
  onChange,
}: {
  value: OrderFlow | undefined;
  counts: Record<string, number> | undefined;
  onChange: (v: OrderFlow | undefined) => void;
}) {
  const tabs: Array<{ key: OrderFlow | undefined; label: string; divider: boolean }> = [
    { key: undefined, label: 'Tất cả', divider: false },
    ...ORDER_FLOW_TABS.map((t, i) => ({
      key: t.flow,
      label: t.label,
      divider: i > 0 && ORDER_FLOW_TABS[i - 1]!.group !== t.group,
    })),
  ];
  return (
    <div
      className="mb-3 flex overflow-x-auto border-b"
      role="tablist"
      aria-label="Trạng thái đơn hàng"
    >
      {tabs.map((t) => {
        const active = value === t.key;
        const n = counts?.[t.key ?? 'total'];
        return (
          <div key={t.key ?? '__all__'} className="flex flex-none items-stretch">
            {t.divider ? <span aria-hidden className="my-2.5 mx-1.5 w-px bg-border" /> : null}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cn(
                '-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {n === undefined ? '…' : n.toLocaleString('vi-VN')}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Khoảng cân nặng (kg): gõ xong rồi Enter / rời ô mới áp lên URL — không bắn request theo
 * từng phím. Cùng giá trị hai ô = lọc đúng một mức cân (vd tất cả đơn 1,2 kg).
 */
function WeightRangeFilter({
  min,
  max,
  onChange,
}: {
  min: string | undefined;
  max: string | undefined;
  onChange: (next: { weightMin: string | undefined; weightMax: string | undefined }) => void;
}) {
  const [draftMin, setDraftMin] = useState(min ?? '');
  const [draftMax, setDraftMax] = useState(max ?? '');
  useEffect(() => setDraftMin(min ?? ''), [min]);
  useEffect(() => setDraftMax(max ?? ''), [max]);
  const commit = () => {
    const norm = (s: string) => {
      const t = s.trim().replace(',', '.');
      return t === '' || !/^\d{1,8}(\.\d{1,4})?$/.test(t) ? undefined : t;
    };
    const nextMin = norm(draftMin);
    const nextMax = norm(draftMax);
    if (nextMin === min && nextMax === max) return;
    onChange({ weightMin: nextMin, weightMax: nextMax });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  };
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Cân nặng</span>
      <Input
        value={draftMin}
        onChange={(e) => setDraftMin(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="từ"
        aria-label="Cân nặng từ (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>–</span>
      <Input
        value={draftMax}
        onChange={(e) => setDraftMax(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        placeholder="đến"
        aria-label="Cân nặng đến (kg)"
        className="h-9 w-20 text-right tabular-nums"
      />
      <span>kg</span>
    </div>
  );
}

const NO_CARRIER = '__none__';
const ANY = '__all__';

/** Ô "Hãng vận chuyển": Tất cả / Chưa gán hãng / từng hãng đang bật. */
function CarrierFilter({
  value,
  carriers,
  onChange,
}: {
  value: string;
  carriers: { id: string; code: string; name: string; isActive: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? '' : v)}>
      <SelectTrigger className="h-9 w-52" aria-label="Hãng vận chuyển">
        <SelectValue placeholder="Hãng vận chuyển" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Hãng VC: tất cả</SelectItem>
        <SelectItem value={NO_CARRIER}>Chưa gán hãng</SelectItem>
        {carriers
          .filter((c) => c.isActive)
          .map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function OrderListScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const flow = parseOrderFlow(state.filters.flow);
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const weightMin = state.filters.weightMin ?? '';
  const weightMax = state.filters.weightMax ?? '';
  const noCarrier = state.filters.noCarrier === 'true';
  const carrierId = state.filters.carrierId ?? '';
  // Ô "Nguồn" gộp cả POS: `POS:<mã shop>` = đơn Pancake của đúng POS đó (URL giữ một khoá).
  const posShopId = /^POS:(\d+)$/.exec(state.filters.source ?? '')?.[1] ?? '';
  const source: 'PANCAKE' | 'ERP' | undefined =
    state.filters.source === 'PANCAKE' || posShopId
      ? 'PANCAKE'
      : state.filters.source === 'ERP'
        ? 'ERP'
        : undefined;
  const pancakeShops = usePancakeShops();
  const from = state.filters.from ?? '';
  const to = state.filters.to ?? '';
  const duplicate = state.filters.duplicate === 'true';
  const itemOrigin = parseItemOrigin(state.filters.itemOrigin);
  // Cột ẩn + sắp xếp lưu theo người dùng ở server (đăng xuất / đổi máy vẫn giữ). Sắp xếp trên URL
  // (link dán cho đồng nghiệp) thắng; URL không có thì lấy lần sắp gần nhất của người dùng.
  const prefs = useOrderListPrefs();
  const savePrefs = useSaveOrderListPrefs();
  const hidden = prefs.data?.hidden ?? DEFAULT_HIDDEN;
  const sort: SortState | null = state.sort ?? prefs.data?.sort ?? null;
  const sortBy = sort && !hidden.includes(sort.id) ? SORT_FIELD[sort.id] : undefined;
  const changeSort = (next: SortState | null) => {
    set({ sort: next });
    savePrefs.mutate({ hidden, sort: next });
  };
  const changeHidden = (next: string[]) => {
    // Ẩn cột đang sắp → bỏ sắp xếp theo cột đó (chỉ sắp theo cột đang hiện).
    const dropSort = sort !== null && next.includes(sort.id);
    if (dropSort) set({ sort: null });
    savePrefs.mutate({ hidden: next, sort: dropSort ? null : sort });
  };
  const filterParams = useMemo(
    () => ({
      q: state.q,
      duplicate,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      source,
      pancakeShopId: posShopId || undefined,
      from,
      to,
      itemOrigin,
    }),
    [
      state.q,
      duplicate,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      source,
      posShopId,
      from,
      to,
      itemOrigin,
    ],
  );
  const params = useMemo(
    () => ({
      ...filterParams,
      flow,
      sortBy,
      sortDir: sortBy ? (sort?.desc ? ('desc' as const) : ('asc' as const)) : undefined,
      ...skipTake,
    }),
    [filterParams, flow, sortBy, sort?.desc, skipTake],
  );
  const carriers = useCarriers();
  // Tên kho: kho được phép từ /auth/me — đơn ngoài kho được phép không bao giờ về tới đây.
  const { options: warehouses } = useWarehouse();
  const columns = useMemo(() => {
    const carrierById = new Map((carriers.data ?? []).map((c) => [c.id, c]));
    const whById = new Map(warehouses.map((w) => [w.id, w.name]));
    return buildColumns(
      (id) => carrierById.get(id) ?? null,
      (id) => whById.get(id) ?? null,
    );
  }, [carriers.data, warehouses]);
  const pickerColumns = useMemo(
    () =>
      columns.map((c) => ({
        id: c.id!,
        title: c.meta?.title ?? (typeof c.header === 'string' ? c.header : c.id!),
        required: c.id === 'docNumber',
      })),
    [columns],
  );
  const query = useOrders(params);
  const counts = useOrderFlowCounts(filterParams);
  useInvalidateOn(['order.created', 'order.updated'], [orderKeys.lists()]);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [peek, setPeek] = useState<SalesOrderListItem | null>(null);

  const setFilter = (patch: Partial<Record<OrderFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter =
    state.q !== '' ||
    flow !== undefined ||
    status !== undefined ||
    customerId !== '' ||
    weightMin !== '' ||
    weightMax !== '' ||
    noCarrier ||
    carrierId !== '' ||
    source !== undefined ||
    from !== '' ||
    to !== '' ||
    duplicate ||
    itemOrigin !== undefined;
  const customerName = query.data?.items[0]?.customer.name;

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description={
          query.data ? `${query.data.total} đơn khớp bộ lọc` : 'Đang đếm số đơn khớp bộ lọc…'
        }
        breadcrumb={[{ label: 'Bán hàng' }, { label: 'Đơn hàng' }]}
        actions={
          <>
            <Can I="map" a="Sync">
              <PancakeOrderResyncButton defaultShopId={posShopId} />
            </Can>
            <Can I="create" a="SalesOrder">
              <Button size="sm" asChild>
                <Link href="/crm/orders/new">
                  <Plus aria-hidden />
                  Tạo đơn
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <FlowTabs
        value={flow}
        counts={counts.data as Record<string, number> | undefined}
        onChange={(v) => setFilter({ flow: v })}
      />

      <FilterBar<OrderFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={[
          { key: 'from', label: 'Từ ngày', type: 'date' },
          { key: 'to', label: 'Đến ngày', type: 'date' },
          {
            // Một ô cho cả "chưa gán hãng" lẫn "đã gán hãng X" — hai key URL (noCarrier / carrierId)
            // loại trừ nhau.
            key: 'carrierId',
            label: 'Hãng vận chuyển',
            type: 'custom',
            render: () => (
              <CarrierFilter
                value={noCarrier ? NO_CARRIER : carrierId}
                carriers={carriers.data ?? []}
                onChange={(v) =>
                  setFilter(
                    v === NO_CARRIER
                      ? { noCarrier: 'true', carrierId: undefined }
                      : { noCarrier: undefined, carrierId: v || undefined },
                  )
                }
              />
            ),
          },
          {
            key: 'source',
            label: 'Nguồn',
            type: 'select',
            options: [
              { value: 'PANCAKE', label: 'Pancake (mọi POS)' },
              ...(pancakeShops.data ?? []).map((s) => ({
                value: `POS:${s.shopId}`,
                label: `Pancake · ${s.shopName ?? `POS ${s.shopId}`}${s.isActive ? '' : ' (đã ngắt)'}`,
              })),
              { value: 'ERP', label: 'Tạo trong ERP' },
            ],
          },
          {
            key: 'duplicate',
            label: 'Trùng trong ngày',
            type: 'select',
            options: [{ value: 'true', label: 'Chỉ đơn trùng trong ngày' }],
          },
          {
            key: 'itemOrigin',
            label: 'Sản phẩm ngoài ERP',
            type: 'select',
            options: ITEM_ORIGIN_OPTIONS,
          },
          {
            key: 'weightMin',
            label: 'Cân nặng',
            type: 'custom',
            render: () => (
              <WeightRangeFilter
                min={state.filters.weightMin}
                max={state.filters.weightMax}
                onChange={setFilter}
              />
            ),
          },
        ]}
        values={{
          flow: state.filters.flow,
          status: state.filters.status,
          customerId: state.filters.customerId,
          weightMin: state.filters.weightMin,
          weightMax: state.filters.weightMax,
          noCarrier: state.filters.noCarrier,
          carrierId: state.filters.carrierId,
          source: state.filters.source,
          from: state.filters.from,
          to: state.filters.to,
          duplicate: state.filters.duplicate,
          itemOrigin: state.filters.itemOrigin,
        }}
        onFilterChange={setFilter}
        searchPlaceholder="Mã đơn, mã Pancake, SĐT, tên khách, mã vận đơn"
        right={
          <>
            {customerId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter({ customerId: undefined })}
              >
                <X aria-hidden />
                Đang lọc theo khách {customerName ? `“${customerName}”` : 'đã chọn'}
              </Button>
            ) : null}
            <ColumnPicker columns={pickerColumns} hidden={hidden} onChange={changeHidden} />
          </>
        }
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có đơn nào khớp' : 'Chưa có đơn hàng nào'}
            description={
              hasFilter
                ? 'Thử bỏ bớt bộ lọc — hoặc đơn này thuộc khách do người khác phụ trách.'
                : 'Tạo đơn đầu tiên để bắt đầu bán.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="SalesOrder">
                  <Button asChild>
                    <Link href="/crm/orders/new">
                      <Plus aria-hidden />
                      Tạo đơn
                    </Link>
                  </Button>
                </Can>
              )
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
            sort={sortBy ? sort : null}
            hiddenColumns={hidden}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={changeSort}
            onRowClick={setPeek}
            selection={{ selected, onChange: setSelected }}
            bulkActions={(ids) => (
              <>
                <Can I="update" a="SalesOrder">
                  <SendToCarrierMenu
                    rows={data.items.filter((r) => ids.includes(r.id))}
                    onDone={() => setSelected({})}
                  />
                  <BulkShippingDialog
                    rows={data.items.filter((r) => ids.includes(r.id))}
                    onDone={() => setSelected({})}
                  />
                  <BulkMoveWarehouseDialog
                    rows={data.items.filter((r) => ids.includes(r.id))}
                    onDone={() => setSelected({})}
                  />
                </Can>
                <Can I="fulfil_manual" a="SalesOrder">
                  <BulkFulfilPrintDialog
                    rows={data.items.filter((r) => ids.includes(r.id))}
                    onDone={() => setSelected({})}
                  />
                </Can>
                <Can I="pack" a="Shipment">
                  <BulkReprintWaybillDialog rows={data.items.filter((r) => ids.includes(r.id))} />
                </Can>
                <Can I="cancel" a="SalesOrder">
                  <BulkCancelDialog
                    rows={data.items.filter((r) => ids.includes(r.id))}
                    onDone={() => setSelected({})}
                  />
                </Can>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSelected({})}
                >
                  Bỏ chọn
                </Button>
              </>
            )}
          />
        )}
      </QueryState>

      <OrderQuickView row={peek} onClose={() => setPeek(null)} />
    </>
  );
}
