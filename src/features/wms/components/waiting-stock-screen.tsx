'use client';

import { AlertTriangle, PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { FilterBar } from '@/components/data/data-table';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatQuantity, formatTime } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useWaitingStockSummary, type WaitingStockSummary } from '../api/use-waiting-stock';

const DEFAULTS = { filterKeys: [] as const };

/** "Xem đơn" của một SKU → tab Chờ hàng lọc đơn thiếu SKU đó. */
const ordersHref = (skuId?: string) =>
  `/crm/orders?flow=WAITING_STOCK${skuId ? `&shortSkuId=${skuId}` : ''}`;

const percent = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/**
 * Hàng chờ (2026-10-25, mockup duyệt): sản phẩm đang thiếu cho đơn chờ hàng — mỗi SKU bao nhiêu
 * đơn cần trên tổng số đơn chờ, SL cần, tồn khả dụng, còn thiếu, số đơn chỉ thiếu SKU đó. Số do API
 * tính (GET /waiting-stock/summary, kho theo ô chọn kho); ô tìm lọc ở server, nằm trên URL (luật 8).
 */
export function WaitingStockScreen() {
  const ability = useAbility();
  const { state, set } = useListState(DEFAULTS);
  const query = useWaitingStockSummary(state.q);
  if (!ability.can('read', 'SalesOrder')) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Hàng chờ"
        description={
          query.data
            ? `Sản phẩm đang thiếu cho đơn chờ hàng · cập nhật ${formatTime(query.data.generatedAt)}`
            : 'Đang tính hàng thiếu…'
        }
        breadcrumb={[{ label: 'Kho' }, { label: 'Hàng chờ' }]}
        actions={
          <Button asChild variant="outline">
            <Link href={ordersHref()}>Xem đơn chờ hàng</Link>
          </Button>
        }
      />
      <QueryState query={query} skeleton={<ListSkeleton rows={8} columns={7} />}>
        {(data) => (
          <div className="space-y-3">
            <Totals data={data} />
            <FilterBar
              q={state.q}
              onQChange={(q) => set({ q })}
              values={{}}
              onFilterChange={() => undefined}
              searchPlaceholder="Tìm mã SKU, tên sản phẩm"
            />
            {data.items.length === 0 ? (
              state.q ? (
                <EmptyState
                  icon={PackageSearch}
                  title="Không có sản phẩm thiếu khớp"
                  action={
                    <Button variant="outline" onClick={() => set({ q: '' })}>
                      Xóa lọc
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={PackageSearch}
                  title="Không có đơn chờ hàng"
                  description="Đơn thiếu hàng quá 24 giờ chưa gửi hãng sẽ hiện ở đây."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/crm/orders">Mở danh sách đơn</Link>
                    </Button>
                  }
                />
              )
            ) : (
              <SkuTable data={data} />
            )}
            <p className="text-xs text-muted-foreground">
              Một đơn thiếu nhiều SKU được đếm ở mỗi SKU nó thiếu — tổng cột &quot;Số đơn cần&quot;
              có thể lớn hơn số đơn chờ. &quot;Còn thiếu&quot; = SL đơn cần − tồn khả dụng (chưa giữ
              cho đơn khác).
              {data.truncated ? ' Quá nhiều đơn chờ — số liệu tính trên 20.000 đơn đầu.' : ''}
            </p>
          </div>
        )}
      </QueryState>
    </>
  );
}

function Totals({ data }: { data: WaitingStockSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href={ordersHref()} className="rounded-md hover:bg-muted">
        <KpiCard
          label="Đơn chờ hàng"
          value={<span className="text-primary">{data.waitingOrders}</span>}
          detail={`trên ${data.activeOrders} đơn đã duyệt chưa gửi hãng`}
          className="h-full"
        />
      </Link>
      <KpiCard
        label="Sản phẩm đang thiếu"
        value={`${data.items.length} SKU`}
        detail={`tổng thiếu ${formatQuantity(data.needQty)} đơn vị`}
      />
      <KpiCard
        label="Đơn chỉ thiếu 1 SKU"
        value={data.singleSkuOrders}
        detail="về đúng SKU đó là đủ hàng"
      />
      <KpiCard
        label={`Chờ quá ${data.overdueDays} ngày`}
        value={
          <span className="flex items-center gap-1.5">
            {data.overdueOrders > 0 ? <AlertTriangle className="h-4 w-4" aria-hidden /> : null}
            {data.overdueOrders} đơn
          </span>
        }
        className={cn(data.overdueOrders > 0 && 'border-warning-line bg-warning-weak text-warning')}
      />
    </div>
  );
}

function SkuTable({ data }: { data: WaitingStockSummary }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead className="text-right">Số đơn cần</TableHead>
            <TableHead className="w-56">Trên tổng {data.waitingOrders} đơn chờ</TableHead>
            <TableHead className="text-right">SL đơn cần</TableHead>
            <TableHead className="text-right">Tồn khả dụng</TableHead>
            <TableHead className="text-right">Còn thiếu</TableHead>
            <TableHead className="text-right">Đơn chỉ thiếu SKU này</TableHead>
            <TableHead>
              <span className="sr-only">Hành động</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((s) => {
            const pct = percent(s.orders, data.waitingOrders);
            return (
              <TableRow key={s.skuId}>
                <TableCell className="font-mono text-xs">{s.skuCode}</TableCell>
                <TableCell className="max-w-72 truncate" title={s.skuName}>
                  {s.skuName}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{s.orders}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      role="img"
                      aria-label={`${s.orders} trên ${data.waitingOrders} đơn chờ`}
                      className="h-2 flex-1 overflow-hidden rounded-sm bg-muted"
                    >
                      <div className="h-full bg-warning" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(s.needQty)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(s.available)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-warning">
                  {formatQuantity(s.shortQty)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.onlyThisSku}</TableCell>
                <TableCell>
                  <Link
                    href={ordersHref(s.skuId)}
                    className="whitespace-nowrap text-primary hover:underline"
                  >
                    Xem đơn
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
