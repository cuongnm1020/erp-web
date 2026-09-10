'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatQuantity, toDecimal } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import { orderKeys, useOrders, type SalesOrder } from '../api/use-orders';
import {
  ORDER_STATUSES,
  orderChannelLabel,
  orderStatusLabel,
  orderStatusTone,
  parseOrderStatus,
} from '../labels';
import { BulkShippingDialog } from './bulk-shipping-dialog';
import { SendToCarrierMenu } from './send-to-carrier-menu';

/**
 * D-03 Danh sách đơn hàng — GET /sales-orders.
 *
 * Dữ liệu đã được API scope theo khách hàng (bất biến 8): sale chỉ thấy đơn của khách
 * mình phụ trách. Frontend KHÔNG lọc lại theo quyền (luật 7).
 *
 * Tab trạng thái / tìm nhanh / lọc theo khách / cân nặng / chưa gán hãng / phân trang đều
 * nằm trên URL (luật 8). Chọn nhiều dòng → "Gửi sang ĐVVC" (SendToCarrierMenu: chọn hãng →
 * dialog hai cột như Pancake, POST /sales-orders/send-to-carrier) hoặc "Gán hãng / cân nặng"
 * (BulkShippingDialog) cho cả lô trước khi kho đóng gói.
 *
 * Cột bỏ so với bản UI-first vì `SalesOrderHeaderDto` không có trường tương ứng:
 * - "Sale": DTO chỉ có `ownerId` (UUID) và chưa có endpoint danh bạ user để đổi ra tên.
 * - "Thanh toán": không có trạng thái thu tiền trên đơn (nằm ở `fin`, chưa có mặt đọc).
 * - "Kho": không có trạng thái giữ hàng ở cấp đơn (chỉ có `reservedQty` từng dòng ở màn chi tiết).
 * - "Vận chuyển": chỉ có `carrierId` (UUID) — chưa có vận đơn trên DTO đơn hàng.
 * - Số đếm trên từng tab: API không trả facet count, đếm ở frontend sẽ chỉ đúng trang hiện tại.
 */
const DEFAULTS = {
  size: 50,
  filterKeys: ['status', 'customerId', 'weightMin', 'weightMax', 'noCarrier'] as const,
};

type OrderFilter = (typeof DEFAULTS.filterKeys)[number];

const columns: ColumnDef<SalesOrder, unknown>[] = [
  {
    id: 'docNumber',
    accessorKey: 'docNumber',
    header: 'Số đơn',
    meta: { width: 150 },
    cell: ({ row }) => (
      <Link
        href={`/crm/orders/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.docNumber}
      </Link>
    ),
  },
  {
    id: 'customer',
    header: 'Khách hàng',
    meta: { width: 280 },
    cell: ({ row }) => (
      <Link
        href={`/crm/customers/${row.original.customer.id}`}
        className="hover:underline"
        title={row.original.customer.name}
      >
        <span className="block truncate">{row.original.customer.name}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.customer.code}
        </span>
      </Link>
    ),
  },
  {
    id: 'channel',
    header: 'Kênh',
    meta: { width: 110 },
    cell: ({ row }) => orderChannelLabel(row.original.channel),
  },
  {
    id: 'orderDate',
    header: 'Ngày đặt',
    meta: { width: 110 },
    cell: ({ row }) => formatDate(row.original.orderDate),
  },
  {
    id: 'lineCount',
    accessorKey: 'lineCount',
    header: 'Số dòng',
    meta: { align: 'right', width: 90 },
  },
  {
    id: 'weight',
    header: 'Cân nặng',
    meta: { align: 'right', width: 110, title: 'Cân nặng gửi hãng (kg)' },
    cell: ({ row }) => <WeightCell order={row.original} />,
  },
  {
    id: 'discount',
    header: 'Chiết khấu',
    meta: { align: 'right', width: 130 },
    cell: ({ row }) => formatMoney(row.original.discount, { unit: '' }),
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    meta: { align: 'right', width: 150 },
    cell: ({ row }) => (
      <span className="font-semibold">
        {formatMoney(row.original.total, { unit: '' })}
        {row.original.currencyCode === 'VND' ? null : (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {row.original.currencyCode}
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    meta: { width: 120 },
    cell: ({ row }) => (
      <StatusBadge tone={orderStatusTone(row.original.status)}>
        {orderStatusLabel(row.original.status)}
      </StatusBadge>
    ),
  },
];

/**
 * Cân nặng gửi hãng hiệu lực (`weightKg` = đặt tay ?? Σ dòng × cân nặng SKU). Đặt tay có
 * dấu ✎ và tooltip nói rõ Σ dòng là bao nhiêu; 0 = SKU chưa khai cân nặng → "—".
 */
function WeightCell({ order }: { order: SalesOrder }) {
  const manual = order.shippingWeightKg !== null;
  const zero = toDecimal(order.weightKg)?.isZero() ?? true;
  if (zero && !manual) {
    return (
      <span className="text-muted-foreground" title="SKU chưa khai cân nặng">
        —
      </span>
    );
  }
  return (
    <span
      className="tabular-nums"
      title={
        manual
          ? `Đặt tay · tính từ dòng: ${formatQuantity(order.lineWeightKg, { unit: 'kg' })}`
          : 'Tính từ cân nặng SKU'
      }
    >
      {formatQuantity(order.weightKg, { unit: 'kg' })}
      {manual ? (
        <span className="ml-1 text-xs text-muted-foreground" aria-label="đặt tay">
          ✎
        </span>
      ) : null}
    </span>
  );
}

function StatusTabs({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const tabs: Array<{ key: string | undefined; label: string }> = [
    { key: undefined, label: 'Tất cả' },
    ...ORDER_STATUSES.map((s) => ({ key: s as string, label: orderStatusLabel(s) })),
  ];
  return (
    <div className="mb-3 flex border-b" role="tablist" aria-label="Trạng thái đơn hàng">
      {tabs.map((t) => (
        <button
          key={t.key ?? '__all__'}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            '-mb-px flex h-9 items-center border-b-2 px-3 text-sm',
            value === t.key
              ? 'border-primary font-semibold text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
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

export function OrderListScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const weightMin = state.filters.weightMin ?? '';
  const weightMax = state.filters.weightMax ?? '';
  const noCarrier = state.filters.noCarrier === 'true';
  const params = useMemo(
    () => ({ q: state.q, status, customerId, weightMin, weightMax, noCarrier, ...skipTake }),
    [state.q, status, customerId, weightMin, weightMax, noCarrier, skipTake],
  );
  const query = useOrders(params);
  useInvalidateOn(['order.created', 'order.updated'], [orderKeys.lists()]);
  const [selected, setSelected] = useState<RowSelectionState>({});

  const setFilter = (patch: Partial<Record<OrderFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter =
    state.q !== '' ||
    status !== undefined ||
    customerId !== '' ||
    weightMin !== '' ||
    weightMax !== '' ||
    noCarrier;
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

      <StatusTabs value={status} onChange={(v) => setFilter({ status: v })} />

      <FilterBar<OrderFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={[
          {
            key: 'noCarrier',
            label: 'Hãng vận chuyển',
            type: 'select',
            options: [{ value: 'true', label: 'Chưa gán hãng' }],
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
          status: state.filters.status,
          customerId: state.filters.customerId,
          weightMin: state.filters.weightMin,
          weightMax: state.filters.weightMax,
          noCarrier: state.filters.noCarrier,
        }}
        onFilterChange={setFilter}
        searchPlaceholder="Tìm theo số đơn, mã hoặc tên khách…"
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
    </>
  );
}
