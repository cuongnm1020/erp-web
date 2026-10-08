'use client';

import { Plus, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { DateRangePicker } from '@/components/data/form';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toDecimal, formatDate, formatMoney, formatQuantity, groupVi } from '@/lib/format';
import { Can } from '@/lib/permission';
import {
  useCustomerOrders,
  useCustomerStats,
  type CustomerOrderItem,
  type CustomerOrderStatus,
  type CustomerSalesStats,
} from '../api/use-customer-sales';
import {
  CUSTOMER_ORDER_STATUSES,
  customerOrderChannelLabel,
  customerOrderStatusLabel,
  customerOrderStatusTone,
  parseCustomerOrderStatus,
} from '../labels';

/**
 * CRM-06 — "Lịch sử mua hàng" trên hồ sơ 360: chỉ số mọi thời điểm + top 5 SKU
 * (GET /customers/{id}/stats) và bảng đơn phân trang phía server (GET /customers/{id}/orders).
 *
 * Bộ lọc / trang của bảng đơn nằm trên URL với tiền tố `ord` (luật 8) để không đụng tham số
 * khác của trang hồ sơ: ?ordStatus=POSTED&ordFrom=2026-09-01&ordTo=2026-09-30&ordPage=2&ordSize=50.
 */
const DEFAULT_SIZE = 20;
const SIZES = [20, 50, 100, 200];
const ALL = '__all__';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const URL_KEYS = ['ordStatus', 'ordFrom', 'ordTo', 'ordPage', 'ordSize'] as const;

interface OrderFilterState {
  status?: CustomerOrderStatus;
  from?: string;
  to?: string;
  page: number;
  size: number;
}

function parseDateKey(v: string | null): string | undefined {
  return v !== null && DATE_KEY.test(v) ? v : undefined;
}

function parsePositive(v: string | null, def: number): number {
  const n = v === null ? Number.NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : def;
}

/** Đọc / ghi bộ lọc bảng đơn trên URL; giá trị lạ (dán tay) bị bỏ, không gửi lên API. */
function useOrderFilterState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.toString();

  const state = useMemo<OrderFilterState>(() => {
    const p = new URLSearchParams(key);
    const size = parsePositive(p.get('ordSize'), DEFAULT_SIZE);
    return {
      status: parseCustomerOrderStatus(p.get('ordStatus')),
      from: parseDateKey(p.get('ordFrom')),
      to: parseDateKey(p.get('ordTo')),
      page: parsePositive(p.get('ordPage'), 1),
      size: SIZES.includes(size) ? size : DEFAULT_SIZE,
    };
  }, [key]);

  const set = useCallback(
    (patch: Partial<OrderFilterState>) => {
      // Đổi bộ lọc / cỡ trang → về trang 1, trừ khi patch ghi rõ page.
      const next: OrderFilterState = { ...state, ...patch };
      if (patch.page === undefined) next.page = 1;
      const merged = new URLSearchParams(key);
      for (const k of URL_KEYS) merged.delete(k);
      if (next.status) merged.set('ordStatus', next.status);
      if (next.from) merged.set('ordFrom', next.from);
      if (next.to) merged.set('ordTo', next.to);
      if (next.page > 1) merged.set('ordPage', String(next.page));
      if (next.size !== DEFAULT_SIZE) merged.set('ordSize', String(next.size));
      const qs = merged.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, key, pathname, router],
  );

  return { state, set };
}

function formatPercent(v: string | null): string {
  return v === null ? '—' : `${formatQuantity(v, { maxDp: 2 })} %`;
}

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Đang tải chỉ số mua hàng" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

function StatsView({ s }: { s: CustomerSalesStats }) {
  const returned = toDecimal(s.returnedRevenue);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Số đơn"
          value={groupVi(String(s.orderCount))}
          detail="đơn đã duyệt / đã chốt"
        />
        <KpiCard
          label="Doanh thu thuần"
          value={formatMoney(s.revenue)}
          detail={
            returned && !returned.isZero()
              ? `đã trừ ${formatMoney(s.returnedRevenue)} hàng hoàn`
              : 'trừ KM cấp đơn, không gồm thuế / phí ship'
          }
        />
        <KpiCard
          label="Giá trị TB / đơn"
          value={formatMoney(s.aov)}
          detail="doanh thu thuần ÷ số đơn"
        />
        <KpiCard
          label="Đơn gần nhất"
          value={formatDate(s.lastOrderAt)}
          detail={`đơn đầu tiên ${formatDate(s.firstOrderAt)}`}
        />
        <KpiCard
          label="Tỷ lệ hoàn"
          value={formatPercent(s.returnRate)}
          detail={`${groupVi(String(s.returnedOrderCount))} đơn có hàng hoàn`}
        />
      </div>

      <section className="rounded-md border bg-card">
        <header className="border-b px-3 py-2 text-sm font-semibold">
          Top {s.topSkus.length} SKU mua nhiều nhất
        </header>
        {s.topSkus.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            Chưa có SKU nào có doanh thu thuần (đơn đã hoàn hết).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-1.5 text-left font-medium">SKU</th>
                <th className="px-3 py-1.5 text-left font-medium">Tên hàng</th>
                <th className="px-3 py-1.5 text-right font-medium">Số lượng</th>
                <th className="px-3 py-1.5 text-right font-medium">Doanh thu thuần</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s.topSkus.map((k) => (
                <tr key={k.skuId}>
                  <td className="px-3 py-1.5 font-mono text-xs">{k.skuCode}</td>
                  <td className="px-3 py-1.5">{k.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatQuantity(k.qty)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(k.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const columns: ColumnDef<CustomerOrderItem, unknown>[] = [
  {
    id: 'code',
    header: 'Mã đơn',
    cell: ({ row }) => (
      <Link
        href={`/crm/orders/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'orderDate',
    header: 'Ngày đặt',
    cell: ({ row }) => formatDate(row.original.orderDate),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <StatusBadge tone={customerOrderStatusTone(row.original.status)}>
        {customerOrderStatusLabel(row.original.status)}
      </StatusBadge>
    ),
  },
  {
    id: 'channel',
    header: 'Kênh',
    cell: ({ row }) => customerOrderChannelLabel(row.original.channel),
  },
  {
    id: 'itemCount',
    header: 'Số dòng',
    meta: { align: 'right' },
    cell: ({ row }) => groupVi(String(row.original.itemCount)),
  },
  {
    id: 'total',
    header: 'Tổng tiền',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.total)}</span>,
  },
  {
    id: 'netRevenue',
    header: 'Doanh thu thuần',
    meta: { align: 'right' },
    cell: ({ row }) => {
      const o = row.original;
      if (o.netRevenue === null) {
        return (
          <span className="text-muted-foreground" title="Chưa tính — đơn chưa duyệt hoặc đã hủy">
            —
          </span>
        );
      }
      const returned = toDecimal(o.returnedRevenue);
      return (
        <span className="flex flex-col items-end tabular-nums">
          {formatMoney(o.netRevenue)}
          {returned && !returned.isZero() ? (
            <span className="text-xs text-muted-foreground">
              hoàn {formatMoney(o.returnedRevenue)}
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    id: 'owner',
    header: 'Phụ trách',
    cell: ({ row }) =>
      row.original.owner ? (
        row.original.owner.name
      ) : (
        <span className="text-muted-foreground">chưa chia</span>
      ),
  },
];

function OrdersTable({ customerId }: { customerId: string }) {
  const { state, set } = useOrderFilterState();
  const query = useCustomerOrders(customerId, {
    status: state.status,
    from: state.from,
    to: state.to,
    take: state.size,
    skip: (state.page - 1) * state.size,
  });
  const filtered = Boolean(state.status || state.from || state.to);

  return (
    <section className="rounded-md border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Đơn hàng</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={state.status ?? ALL}
            onValueChange={(v) =>
              set({ status: v === ALL ? undefined : parseCustomerOrderStatus(v) })
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Lọc trạng thái đơn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
              {CUSTOMER_ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {customerOrderStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker
            value={{ from: state.from ?? '', to: state.to ?? '' }}
            onChange={(r) => set({ from: r.from || undefined, to: r.to || undefined })}
            placeholder="Ngày đặt"
          />
        </div>
      </header>
      <div className="px-3 py-2">
        <QueryState
          query={query}
          skeleton={<ListSkeleton rows={5} columns={8} />}
          isEmpty={(d) => d.total === 0}
          empty={
            filtered ? (
              <EmptyState
                title="Không có đơn nào khớp bộ lọc"
                description="Thử bỏ lọc trạng thái hoặc mở rộng khoảng ngày."
                action={
                  <Button
                    variant="outline"
                    onClick={() => set({ status: undefined, from: undefined, to: undefined })}
                  >
                    Xóa lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title="Khách chưa có đơn nào"
                description="Đơn tạo cho khách này sẽ hiện ở đây."
                action={
                  <Can I="create" a="SalesOrder">
                    <Button asChild>
                      <Link href={`/crm/orders/new?customerId=${customerId}`}>
                        <Plus aria-hidden />
                        Tạo đơn
                      </Link>
                    </Button>
                  </Can>
                }
              />
            )
          }
        >
          {(d) => (
            <>
              <DataTable
                columns={columns}
                rows={d.items}
                getRowId={(o) => o.id}
                total={d.total}
                page={state.page}
                size={state.size}
                sort={null}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={() => undefined}
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Doanh thu thuần chỉ tính cho đơn đã duyệt / đã chốt: trừ khuyến mãi cấp đơn và hàng
                hoàn, không gồm thuế và phí ship. Đơn nháp, chờ duyệt hoặc đã hủy hiện “—”.
              </p>
            </>
          )}
        </QueryState>
      </div>
    </section>
  );
}

export function CustomerPurchaseHistory({ customerId }: { customerId: string }) {
  const stats = useCustomerStats(customerId);
  return (
    <section aria-labelledby="purchase-history" className="flex flex-col gap-3">
      <h2 id="purchase-history" className="text-base font-semibold">
        Lịch sử mua hàng
      </h2>
      <QueryState
        query={stats}
        skeleton={<StatsSkeleton />}
        isEmpty={(s) => s.orderCount === 0}
        empty={
          <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Chưa có đơn đã duyệt / đã chốt — chỉ số doanh thu sẽ có khi đơn đầu tiên được duyệt.
          </p>
        }
      >
        {(s) => <StatsView s={s} />}
      </QueryState>
      <OrdersTable customerId={customerId} />
    </section>
  );
}
