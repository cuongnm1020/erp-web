'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import { MessageSquareText, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
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
  formatMoney,
  formatPhone,
  formatQuantity,
  formatRelative,
  phoneCarrier,
  toDecimal,
} from '@/lib/format';
import { Can } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import { useCarriers } from '@/features/wms/api/use-shipping';
import { useWarehouses } from '@/features/wms/api/use-warehouses';
import {
  orderKeys,
  useOrderFlowCounts,
  useOrders,
  type OrderFlow,
  type SalesOrderListItem,
} from '../api/use-orders';
import {
  fulfilmentLabel,
  ORDER_FLOW_TABS,
  orderFlowLabel,
  orderFlowTone,
  parseOrderFlow,
  parseOrderStatus,
} from '../labels';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { OrderQuickView, TelcoBadge } from './order-quick-view';
import { SendToCarrierMenu } from './send-to-carrier-menu';

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
 * "Gửi sang ĐVVC" / "Gán hãng / cân nặng".
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
    'warehouseId',
    'source',
    'from',
    'to',
  ] as const,
};

type OrderFilter = (typeof DEFAULTS.filterKeys)[number];

/** Cột của bảng — `carrierName` tra tên hãng chọn trên đơn khi kho chưa tạo phiếu giao. */
const buildColumns = (
  carrierName: (id: string) => string | null,
): ColumnDef<SalesOrderListItem, unknown>[] => [
  {
    id: 'docNumber',
    header: 'Mã đơn',
    meta: { width: 170 },
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-sm bg-muted px-1.5 font-medium">
              {o.pancakeOrderId ? `Pancake #${o.pancakeOrderId}` : 'ERP'}
            </span>
            {o.ownerName ? <span className="truncate">{o.ownerName}</span> : null}
          </div>
        </div>
      );
    },
  },
  {
    id: 'customer',
    header: 'Khách hàng',
    meta: { width: 200 },
    cell: ({ row }) => {
      const o = row.original;
      const telco = phoneCarrier(o.phone);
      return (
        <div className="space-y-1">
          <span className="block max-w-48 truncate font-medium" title={o.customer.name}>
            {o.recipientName ?? o.customer.name}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-mono text-xs">{formatPhone(o.phone)}</span>
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
    cell: ({ row }) => <ShippingCell order={row.original} carrierName={carrierName} />,
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    meta: { align: 'right', width: 120 },
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
    // Header dạng hàm để giữ tooltip giải thích (meta.title của DataTable là CHỮ tiêu đề).
    header: () => (
      <span
        className="block text-right"
        title="Ước tính: COD − phí VC khi giao thành công; − phí VC khi hoàn"
      >
        Thực thu ĐVVC
      </span>
    ),
    meta: { align: 'right', width: 120 },
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
        <span title={o.fulfilmentStatus ? fulfilmentLabel(o.fulfilmentStatus) : undefined}>
          <StatusBadge tone={orderFlowTone(o.flow)}>{orderFlowLabel(o.flow)}</StatusBadge>
        </span>
      );
    },
  },
  {
    id: 'time',
    header: 'Thời gian',
    meta: { width: 130 },
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

/** Hãng + phí VC + mã vận đơn; chưa có phiếu giao thì hãng chọn trên đơn / "Chưa gán hãng". */
function ShippingCell({
  order,
  carrierName,
}: {
  order: SalesOrderListItem;
  carrierName: (id: string) => string | null;
}) {
  const s = order.shipment;
  // Phiếu giao thắng; chưa có phiếu thì hãng sale chọn trên đơn (tên tra từ danh mục hãng).
  const name =
    s?.carrierName ??
    s?.carrierCode ??
    (order.carrierId ? (carrierName(order.carrierId) ?? 'Đã chọn hãng') : null);
  return (
    <div className="space-y-1 text-xs">
      {name ? (
        <span className="block whitespace-nowrap">
          <span className="font-semibold">{name}</span>
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
        <span
          className="block max-w-48 truncate font-mono text-muted-foreground"
          title={s.trackingNo}
        >
          {s.trackingNo}
        </span>
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
  const warehouseId = state.filters.warehouseId ?? '';
  const source: 'PANCAKE' | 'ERP' | undefined =
    state.filters.source === 'PANCAKE'
      ? 'PANCAKE'
      : state.filters.source === 'ERP'
        ? 'ERP'
        : undefined;
  const from = state.filters.from ?? '';
  const to = state.filters.to ?? '';
  const filterParams = useMemo(
    () => ({
      q: state.q,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      warehouseId,
      source,
      from,
      to,
    }),
    [
      state.q,
      status,
      customerId,
      weightMin,
      weightMax,
      noCarrier,
      carrierId,
      warehouseId,
      source,
      from,
      to,
    ],
  );
  const params = useMemo(
    () => ({ ...filterParams, flow, ...skipTake }),
    [filterParams, flow, skipTake],
  );
  const carriers = useCarriers();
  const columns = useMemo(() => {
    const byId = new Map((carriers.data ?? []).map((c) => [c.id, c.name]));
    return buildColumns((id) => byId.get(id) ?? null);
  }, [carriers.data]);
  const warehouses = useWarehouses();
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
    warehouseId !== '' ||
    source !== undefined ||
    from !== '' ||
    to !== '';
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
          <Can I="create" a="SalesOrder">
            <Button size="sm" asChild>
              <Link href="/crm/orders/new">
                <Plus aria-hidden />
                Tạo đơn
              </Link>
            </Button>
          </Can>
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
            key: 'warehouseId',
            label: 'Kho',
            type: 'select',
            options: (warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name })),
          },
          {
            key: 'source',
            label: 'Nguồn',
            type: 'select',
            options: [
              { value: 'PANCAKE', label: 'Pancake' },
              { value: 'ERP', label: 'Tạo trong ERP' },
            ],
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
          warehouseId: state.filters.warehouseId,
          source: state.filters.source,
          from: state.filters.from,
          to: state.filters.to,
        }}
        onFilterChange={setFilter}
        searchPlaceholder="Mã đơn, mã Pancake, SĐT, tên khách, mã vận đơn"
        right={
          customerId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter({ customerId: undefined })}
            >
              <X aria-hidden />
              Đang lọc theo khách {customerName ? `“${customerName}”` : 'đã chọn'}
            </Button>
          ) : null
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
            sort={state.sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(sort) => set({ sort })}
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
