'use client';

import { Filter } from 'lucide-react';
import { useMemo } from 'react';
import { BarList } from '@/components/data/charts';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { GrowthIndicator } from '@/components/data/growth-indicator';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/export-csv';
import { formatMoney, toDecimal } from '@/lib/format';
import { useSalesByStaff, type SalesByStaffItem, type StaffGroupBy } from '../api/use-sales-report';
import {
  DataAsOfNotice,
  ExportButton,
  GroupKeyLabel,
  Segmented,
  count,
  csvMoney,
  money,
  pct,
  profitCell,
} from './report-parts';
import { useSalesReportState } from './report-state';

const GROUPS: ReadonlyArray<readonly [StaffGroupBy, string]> = [
  ['owner', 'Nhân viên'],
  ['team', 'Team'],
  ['owner_shop', 'Nhân viên × POS'],
];
const GROUP_VALUES = new Set<string>(GROUPS.map(([g]) => g));

/** Một người có thể nhiều dòng (mỗi POS một dòng) → id dòng ghép người + POS. */
const rowKey = (r: SalesByStaffItem) => `${r.key.id ?? 'null'}|${r.key.shopId ?? ''}`;

/**
 * Tab "Nhân viên": doanh thu theo người phụ trách / team (snapshot lúc tạo đơn — D-CR2). Dữ liệu đã
 * được API scope (nhân viên chỉ thấy dòng mình, trưởng nhóm thấy team) — màn không lọc thêm (luật 7).
 * Bấm "Lọc" trên một dòng để xem mọi tab theo riêng người / team đó. "Nhân viên × POS": mỗi sale
 * tách một dòng cho từng POS Pancake đã bán (đơn tạo trên ERP thành dòng riêng).
 */
export function SalesStaffTab() {
  const { state, setFilters, filter, range } = useSalesReportState();
  const staffRaw = state.filters.staff;
  const groupBy: StaffGroupBy =
    staffRaw && GROUP_VALUES.has(staffRaw) ? (staffRaw as StaffGroupBy) : 'owner';
  const byShop = groupBy === 'owner_shop';
  const query = useSalesByStaff(filter, groupBy);
  const head = groupBy === 'team' ? 'Team' : 'Nhân viên phụ trách';

  const columns = useMemo<ColumnDef<SalesByStaffItem, unknown>[]>(
    () => [
      {
        id: 'key',
        header: head,
        cell: ({ row }) => <GroupKeyLabel id={row.original.key.id} name={row.original.key.name} />,
      },
      ...(byShop
        ? [
            {
              id: 'shop',
              header: 'POS',
              meta: { width: 180 },
              cell: ({ row }) => (
                <span className={row.original.key.shopId ? undefined : 'text-muted-foreground'}>
                  {row.original.key.shopName}
                </span>
              ),
            } satisfies ColumnDef<SalesByStaffItem, unknown>,
          ]
        : []),
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => count(row.original.orderCount),
      },
      {
        id: 'aov',
        header: 'TB/đơn',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) => money(row.original.aov),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'customerCount',
        header: 'Khách mua',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            {count(row.original.customerCount)}
            {row.original.newCustomerCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {row.original.newCustomerCount} mới
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'returned',
        header: 'Hàng hoàn',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            {money(row.original.returnedRevenue)}
            {row.original.returnedOrderCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {row.original.returnedOrderCount} đơn · {pct(row.original.returnRate)}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'previousRevenue',
        header: 'Doanh thu kỳ trước',
        meta: { align: 'right', width: 150 },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoney(row.original.previousRevenue)}
          </span>
        ),
      },
      {
        id: 'growthPct',
        header: 'Tăng/giảm',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <GrowthIndicator
            pct={row.original.growthPct}
            hasCurrent={!(toDecimal(row.original.revenue)?.isZero() ?? true)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { width: 70 },
        cell: ({ row }) => {
          const { id, name, shopId, shopName } = row.original.key;
          if (id === null) return null;
          const scope = byShop && shopId ? `${name} ở ${shopName}` : name;
          return (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Chỉ xem số của ${scope}`}
              title={`Chỉ xem số của ${scope} ở mọi tab`}
              onClick={() =>
                setFilters(
                  groupBy === 'team'
                    ? { teamId: id, teamName: name }
                    : {
                        ownerId: id,
                        ownerName: name,
                        ...(byShop && shopId ? { pancakeShopId: shopId } : {}),
                      },
                )
              }
            >
              <Filter aria-hidden />
              Lọc
            </Button>
          );
        },
      },
    ],
    [head, groupBy, byShop, setFilters],
  );

  const exportCsv = (items: SalesByStaffItem[]) =>
    downloadCsv(
      `doanh-thu-theo-${groupBy === 'team' ? 'team' : byShop ? 'nhan-vien-pos' : 'nhan-vien'}_${range.from}_${range.to}`,
      [
        head,
        ...(byShop ? ['POS'] : []),
        'Doanh thu',
        'Số đơn',
        'TB/đơn',
        'Lãi gộp',
        'Khách mua',
        'Khách mới',
        'Hàng hoàn',
        'Số đơn hoàn',
        'Tỷ lệ hoàn %',
        'Doanh thu kỳ trước',
        'Tăng/giảm %',
      ],
      items.map((r) => [
        r.key.name,
        ...(byShop ? [r.key.shopName ?? ''] : []),
        csvMoney(r.revenue),
        r.orderCount,
        csvMoney(r.aov),
        csvMoney(r.grossProfit),
        r.customerCount,
        r.newCustomerCount,
        csvMoney(r.returnedRevenue),
        r.returnedOrderCount,
        r.returnRate ?? '',
        csvMoney(r.previousRevenue),
        r.growthPct ?? '',
      ]),
    );

  return (
    <div className="flex flex-col gap-3">
      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={10} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="Chưa có doanh thu theo nhân viên trong khoảng này"
            description="Chỉ tính đơn đã chốt theo ngày đặt hàng. Thử khoảng ngày dài hơn."
            action={
              <Button
                variant="outline"
                onClick={() => setFilters({ staff: groupBy === 'team' ? undefined : 'team' })}
              >
                {groupBy === 'team' ? 'Xem theo nhân viên' : 'Xem theo team'}
              </Button>
            }
          />
        }
      >
        {(d) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Xem theo"
                value={groupBy}
                options={GROUPS}
                onChange={(g) => setFilters({ staff: g === 'owner' ? undefined : g })}
              />
              <p className="mr-auto text-xs text-muted-foreground">
                Tổng {formatMoney(d.totals.revenue)} · {d.totals.orderCount} đơn ·{' '}
                {d.totals.customerCount} khách · kỳ trước {formatMoney(d.totals.previousRevenue)}{' '}
                <GrowthIndicator pct={d.totals.growthPct} />
              </p>
              <ExportButton onClick={() => exportCsv(d.items)} />
            </div>
            <section className="rounded-md border bg-card p-3" aria-label="Biểu đồ doanh thu">
              <h2 className="mb-2 text-sm font-semibold">
                Doanh thu {Math.min(10, d.items.length)}{' '}
                {groupBy === 'team' ? 'team' : byShop ? 'dòng nhân viên × POS' : 'người'} cao nhất
              </h2>
              <BarList
                ariaLabel={`Doanh thu theo ${head.toLowerCase()}`}
                items={d.items.slice(0, 10).map((r) => ({
                  key: rowKey(r),
                  label: byShop ? `${r.key.name} · ${r.key.shopName ?? ''}` : r.key.name,
                  value: r.revenue,
                  display: formatMoney(r.revenue),
                  muted: r.key.id === null,
                }))}
              />
            </section>
            <DataAsOfNotice
              dataAsOf={d.dataAsOf}
              previousFrom={d.previousFrom}
              previousTo={d.previousTo}
            />
            <DataTable
              columns={columns}
              rows={d.items}
              getRowId={rowKey}
              total={d.items.length}
              page={1}
              size={Math.max(d.items.length, 1)}
              sort={null}
              onPageChange={() => undefined}
              onSizeChange={() => undefined}
              onSortChange={() => undefined}
              pagination={false}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}
