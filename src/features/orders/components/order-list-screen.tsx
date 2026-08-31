'use client';

import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney } from '@/lib/format';
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

/**
 * D-03 Danh sách đơn hàng — GET /sales-orders.
 *
 * Dữ liệu đã được API scope theo khách hàng (bất biến 8): sale chỉ thấy đơn của khách
 * mình phụ trách. Frontend KHÔNG lọc lại theo quyền (luật 7).
 *
 * Tab trạng thái / tìm nhanh / lọc theo khách / phân trang đều nằm trên URL (luật 8).
 *
 * Cột bỏ so với bản UI-first vì `SalesOrderHeaderDto` không có trường tương ứng:
 * - "Sale": DTO chỉ có `ownerId` (UUID) và chưa có endpoint danh bạ user để đổi ra tên.
 * - "Thanh toán": không có trạng thái thu tiền trên đơn (nằm ở `fin`, chưa có mặt đọc).
 * - "Kho": không có trạng thái giữ hàng ở cấp đơn (chỉ có `reservedQty` từng dòng ở màn chi tiết).
 * - "Vận chuyển": không có thông tin vận đơn trên DTO đơn hàng.
 * - Số đếm trên từng tab: API không trả facet count, đếm ở frontend sẽ chỉ đúng trang hiện tại.
 */
const DEFAULTS = { size: 50, filterKeys: ['status', 'customerId'] as const };

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

export function OrderListScreen() {
  const { state, set, skipTake } = useListState<OrderFilter>(DEFAULTS);
  const status = parseOrderStatus(state.filters.status);
  const customerId = state.filters.customerId ?? '';
  const params = useMemo(
    () => ({ q: state.q, status, customerId, ...skipTake }),
    [state.q, status, customerId, skipTake],
  );
  const query = useOrders(params);
  useInvalidateOn(['order.created', 'order.updated'], [orderKeys.lists()]);

  const setFilter = (patch: Partial<Record<OrderFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const hasFilter = state.q !== '' || status !== undefined || customerId !== '';
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
        values={{ status: state.filters.status, customerId: state.filters.customerId }}
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
        skeleton={<ListSkeleton rows={12} columns={8} />}
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
          />
        )}
      </QueryState>
    </>
  );
}
