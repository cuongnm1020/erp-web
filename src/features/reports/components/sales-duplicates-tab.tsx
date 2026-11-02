'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCsvExport } from '@/components/data/export-delivery';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import {
  useExportSalesDuplicates,
  useSalesDuplicates,
  type DuplicateSort,
  type DuplicatesParams,
  type SalesDuplicateGroup,
} from '../api/use-sales-report';
import { count, csvMoney, ExportButton, pct, Segmented } from './report-parts';
import { useSalesReportState } from './report-state';

const SORTS: ReadonlyArray<readonly [DuplicateSort, string]> = [
  ['day', 'Ngày mới nhất'],
  ['orders', 'Nhiều đơn nhất'],
  ['returned', 'Nhiều đơn hoàn nhất'],
];
const SORT_VALUES = new Set<string>(SORTS.map(([s]) => s));
const PAGE_SIZE = 50;

/**
 * Tab "Đơn trùng" (RPT-DUP, 2026-11-02): đơn cùng SĐT khách, cùng ngày, chưa hủy — như chip "Trùng"
 * ở danh sách đơn — kèm tỉ lệ hoàn, so với đơn không trùng cùng kỳ. Dữ liệu đã scope ở API
 * (luật 7). Phân trang nhóm phía server, trạng thái trên URL (dupSort, dupReturned, dupPage).
 */
export function SalesDuplicatesTab() {
  const { state, setFilters, filter, range } = useSalesReportState();
  const sort: DuplicateSort = SORT_VALUES.has(state.filters.dupSort ?? '')
    ? (state.filters.dupSort as DuplicateSort)
    : 'day';
  const onlyReturned = state.filters.dupReturned === 'true';
  const pageRaw = Number.parseInt(state.filters.dupPage ?? '', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const params: DuplicatesParams = {
    onlyReturned,
    sort,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  };
  const query = useSalesDuplicates(filter, params);
  const exporter = useExportSalesDuplicates();

  const columns = useMemo<ColumnDef<SalesDuplicateGroup, unknown>[]>(
    () => [
      {
        id: 'day',
        header: 'Ngày',
        meta: { width: 100 },
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.day)}</span>,
      },
      {
        id: 'customer',
        header: 'Khách',
        meta: { width: 200 },
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.customerName}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatPhone(row.original.phone)}
            </span>
          </span>
        ),
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.orderCount),
      },
      {
        id: 'returnedCount',
        header: 'Đơn hoàn',
        meta: { align: 'right', width: 90 },
        cell: ({ row }) => count(row.original.returnedCount),
      },
      {
        id: 'returnRate',
        header: 'Tỉ lệ hoàn',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{pct(row.original.returnRate)}</span>
        ),
      },
      {
        id: 'orders',
        header: 'Các đơn (giờ đặt · tổng tiền)',
        cell: ({ row }) => (
          <ul className="flex flex-col gap-0.5">
            {row.original.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/crm/orders/${o.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {o.docNumber}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(o.orderDate)} · {formatMoney(o.total)}
                </span>
                {o.returned ? <StatusBadge tone="err">Hoàn</StatusBadge> : null}
              </li>
            ))}
          </ul>
        ),
      },
    ],
    [],
  );

  const downloadCsv = useCsvExport('Báo cáo đơn trùng');
  const runExport = () =>
    exporter.mutate(
      { filter, params },
      {
        onSuccess: ({ items }) =>
          downloadCsv(
            `don-trung_${range.from}_${range.to}`,
            ['Ngày', 'SĐT', 'Khách', 'Số đơn trong nhóm', 'Mã đơn', 'Giờ đặt', 'Tổng tiền', 'Hoàn'],
            items.flatMap((g) =>
              g.orders.map((o) => [
                g.day,
                g.phone,
                g.customerName,
                g.orderCount,
                o.docNumber,
                formatDateTime(o.orderDate),
                csvMoney(o.total),
                o.returned ? 'Có' : '',
              ]),
            ),
          ),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Sắp xếp"
          value={sort}
          options={SORTS}
          onChange={(s) => setFilters({ dupSort: s === 'day' ? undefined : s, dupPage: undefined })}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={onlyReturned}
            onCheckedChange={(v) =>
              setFilters({ dupReturned: v === true ? 'true' : undefined, dupPage: undefined })
            }
          />
          Chỉ nhóm có đơn hoàn
        </label>
        {query.data && query.data.total > 0 ? (
          <span className="ml-auto">
            <ExportButton onClick={runExport} pending={exporter.isPending} />
          </span>
        ) : null}
      </div>
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={7} />}
        isEmpty={(d) => d.totals.duplicateOrders === 0}
        empty={
          <EmptyState
            title="Không có đơn trùng trong khoảng này"
            description="Đơn trùng = cùng SĐT khách, cùng ngày đặt, chưa hủy. Thử khoảng ngày dài hơn hoặc bỏ bớt lọc."
            action={
              onlyReturned ? (
                <Button variant="outline" onClick={() => setFilters({ dupReturned: undefined })}>
                  Xem cả nhóm không hoàn
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(d) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Nhóm trùng (SĐT × ngày)"
                value={count(d.totals.groupCount)}
                detail={`${d.totals.duplicateOrders} đơn trùng`}
              />
              <KpiCard
                label="Tỉ lệ hoàn — đơn trùng"
                value={pct(d.totals.duplicateReturnRate)}
                detail={`${d.totals.duplicateReturned}/${d.totals.duplicateOrders} đơn hoàn`}
              />
              <KpiCard
                label="Tỉ lệ hoàn — đơn không trùng"
                value={pct(d.totals.otherReturnRate)}
                detail={`${d.totals.otherReturned}/${d.totals.otherOrders} đơn hoàn`}
              />
              <KpiCard
                label="Đơn trùng / tổng đơn"
                value={pct(
                  d.totals.duplicateOrders + d.totals.otherOrders > 0
                    ? (
                        (d.totals.duplicateOrders * 100) /
                        (d.totals.duplicateOrders + d.totals.otherOrders)
                      ).toFixed(2)
                    : null,
                )}
                detail={`${d.totals.duplicateOrders + d.totals.otherOrders} đơn trong kỳ`}
              />
            </div>
            {d.items.length === 0 ? (
              <EmptyState
                title="Không có nhóm nào khớp"
                description="Bỏ lọc “Chỉ nhóm có đơn hoàn” để xem mọi nhóm đơn trùng."
                action={
                  <Button variant="outline" onClick={() => setFilters({ dupReturned: undefined })}>
                    Bỏ lọc
                  </Button>
                }
              />
            ) : (
              <DataTable
                columns={columns}
                rows={d.items}
                getRowId={(g) => `${g.phone}|${g.day}`}
                total={d.total}
                page={page}
                size={PAGE_SIZE}
                sort={null}
                onPageChange={(p) => setFilters({ dupPage: p === 1 ? undefined : String(p) })}
                onSizeChange={() => undefined}
                onSortChange={() => undefined}
              />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}
