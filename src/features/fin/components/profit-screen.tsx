'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { KpiCard } from '@/components/data/kpi-card';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatQuantity, toLocalDateKey } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import {
  useProfitBackfill,
  useProfitReport,
  type ProfitCostStatus,
  type ProfitOrderRow,
  type ProfitSkuRow,
} from '../api/use-profit';

/**
 * Lợi nhuận (2026-10-01) — GET /reports/profit. Giá nhập thay đổi theo từng phiếu nhập kho;
 * giá vốn của mỗi đơn là đúng giá các lô FIFO đã xuất cho nó, chốt lúc đóng gói. Đơn chưa đóng
 * gói: tạm tính theo lô đang mở (nhãn "Tạm tính"). Khoảng ngày + cách xem + tìm kiếm nằm trên
 * URL (luật 8). Chỉ đơn đã chốt (APPROVED / POSTED), theo ngày đặt hàng giờ VN.
 *
 * 2026-10-02: thêm lợi nhuận sau vận chuyển (lãi gộp + phí ship thu khách − cước hãng), đơn hoàn
 * (loại doanh thu + giá vốn, vẫn chịu cước) và thuế trên đơn (thu hộ, ngoài doanh thu). Mọi con số
 * do API tính — màn chỉ hiển thị (luật 10).
 */
const DEFAULTS = { filterKeys: ['from', 'to', 'view'] as const };
type Filter = (typeof DEFAULTS.filterKeys)[number];
/** Trần của API (MAX_RANGE_DAYS = 93) — chặn trước ở màn để không bắn 422. */
const MAX_DAYS = 93;

const COST_STATUS: Record<ProfitCostStatus, { tone: StatusTone; label: string; hint: string }> = {
  ACTUAL: { tone: 'ok', label: 'Đã chốt', hint: 'Giá vốn FIFO thật, chốt lúc đóng gói' },
  ESTIMATED: {
    tone: 'warn',
    label: 'Tạm tính',
    hint: 'Còn hàng chưa đóng gói — tạm tính theo lô nhập đang mở',
  },
  MISSING: {
    tone: 'err',
    label: 'Thiếu giá vốn',
    hint: 'Có SKU chưa từng nhập kho — giá vốn phần đó tính 0, lợi nhuận đang cao hơn thực tế',
  },
};

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const pct = (v: string | null) => (v === null ? '—' : `${v.replace('.', ',')}%`);
const negative = (v: string) => v.startsWith('-');

/** Nhãn hoàn hàng trên dòng đơn — NONE không hiện gì. */
const RETURN_STATUS: Partial<
  Record<ProfitOrderRow['returnStatus'], { tone: StatusTone; label: string; hint: string }>
> = {
  PARTIAL: {
    tone: 'warn',
    label: 'Hoàn một phần',
    hint: 'Đã trừ doanh thu + giá vốn phần nhập lại kho theo phiếu nhập hàng hoàn',
  },
  FULL: {
    tone: 'err',
    label: 'Hoàn hết',
    hint: 'Không tính doanh thu; phần hàng hủy / thiếu (nếu có) tính vào giá vốn; vẫn chịu cước',
  },
  AWAITING_RECEIPT: {
    tone: 'err',
    label: 'Hoàn · chờ nhập kho',
    hint: 'ĐVVC đã hoàn nhưng kho chưa post phiếu nhập hàng hoàn — tạm coi hàng về đủ',
  },
};

function CostStatusBadge({ status }: { status: ProfitCostStatus }) {
  const s = COST_STATUS[status];
  return (
    <span title={s.hint}>
      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
    </span>
  );
}

const money = (v: string) => <span className="tabular-nums">{formatMoney(v)}</span>;
const isZero = (v: string) => /^-?0(\.0+)?$/.test(v);
const profitCell = (v: string) => (
  <span className={cn('font-semibold tabular-nums', negative(v) && 'text-destructive')}>
    {formatMoney(v)}
  </span>
);

export function ProfitScreen() {
  const ability = useAbility();
  const canView = ability.can('profit', 'Report');
  const { state, set } = useListState<Filter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const monthStart = `${today.slice(0, 8)}01`;
  const from = state.filters.from ?? monthStart;
  const to = state.filters.to ?? today;
  const view: 'order' | 'sku' = state.filters.view === 'sku' ? 'sku' : 'order';
  const params = useMemo(
    () => ({
      from,
      to,
      groupBy: view,
      q: state.q,
      take: state.size,
      skip: (state.page - 1) * state.size,
    }),
    [from, to, view, state.q, state.size, state.page],
  );
  const query = useProfitReport(params, canView);
  const backfill = useProfitBackfill();

  const setRange = useCallback(
    (f: string, t: string) => set({ filters: { ...state.filters, from: f, to: t } }),
    [set, state.filters],
  );
  const onFrom = (v: string) => {
    if (!v) return;
    const t = v > to ? v : daysBetween(v, to) >= MAX_DAYS ? shiftDay(v, MAX_DAYS - 1) : to;
    setRange(v, t);
  };
  const onTo = (v: string) => {
    if (!v) return;
    const f = v < from ? v : daysBetween(from, v) >= MAX_DAYS ? shiftDay(v, -(MAX_DAYS - 1)) : from;
    setRange(f, v);
  };
  const presets = [
    { label: 'Hôm nay', from: today, to: today },
    { label: '7 ngày', from: shiftDay(today, -6), to: today },
    { label: 'Tháng này', from: monthStart, to: today },
    {
      label: 'Tháng trước',
      from: `${shiftDay(monthStart, -1).slice(0, 8)}01`,
      to: shiftDay(monthStart, -1),
    },
  ];
  const rangeLabel = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;

  const orderColumns = useMemo<ColumnDef<ProfitOrderRow, unknown>[]>(
    () => [
      {
        id: 'docNumber',
        header: 'Số đơn',
        meta: { width: 150 },
        cell: ({ row }) => (
          <Link
            href={`/crm/orders/${row.original.orderId}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
        ),
      },
      {
        id: 'orderDate',
        header: 'Ngày đặt',
        meta: { width: 100 },
        cell: ({ row }) => formatDate(row.original.orderDate),
      },
      {
        id: 'customer',
        header: 'Khách hàng',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.customerName}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.customerCode}
            </span>
          </span>
        ),
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: 'cogs',
        header: 'Giá vốn',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.cogs),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'marginPct',
        header: '% lãi',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.marginPct)}</span>,
      },
      {
        id: 'shipping',
        header: 'Cước ĐVVC',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="flex flex-col items-end">
              {r.shippingCostMissing ? (
                <span title="Phiếu đã rời kho nhưng hãng chưa báo cước — lợi nhuận đang cao hơn thực tế">
                  <StatusBadge tone="warn">Chưa có cước</StatusBadge>
                </span>
              ) : (
                money(r.shippingCost)
              )}
              {isZero(r.shippingCharged) ? null : (
                <span className="text-xs text-muted-foreground">
                  thu khách {formatMoney(r.shippingCharged)}
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: 'netProfit',
        header: 'Lãi sau VC',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.netProfit),
      },
      {
        id: 'costStatus',
        header: 'Giá vốn',
        meta: { width: 120 },
        cell: ({ row }) => {
          const r = RETURN_STATUS[row.original.returnStatus];
          return (
            <span className="flex flex-col items-start gap-0.5">
              {r ? (
                <span title={r.hint}>
                  <StatusBadge tone={r.tone}>{r.label}</StatusBadge>
                </span>
              ) : null}
              {row.original.returnStatus === 'FULL' ||
              row.original.returnStatus === 'AWAITING_RECEIPT' ? null : (
                <CostStatusBadge status={row.original.costStatus} />
              )}
              {isZero(row.original.returnedRevenue) ? null : (
                <span className="text-xs text-muted-foreground">
                  −{formatMoney(row.original.returnedRevenue)} hoàn
                </span>
              )}
            </span>
          );
        },
      },
    ],
    [],
  );

  const skuColumns = useMemo<ColumnDef<ProfitSkuRow, unknown>[]>(
    () => [
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.skuName}</span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.skuCode}</span>
          </span>
        ),
      },
      {
        id: 'qtyBase',
        header: 'SL bán',
        meta: { align: 'right', width: 100 },
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            <span className="tabular-nums">{formatQuantity(row.original.qtyBase)}</span>
            {isZero(row.original.returnedQtyBase) ? null : (
              <span className="text-xs tabular-nums text-muted-foreground">
                hoàn {formatQuantity(row.original.returnedQtyBase)}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: 'avgUnitCost',
        header: 'Giá vốn BQ',
        meta: { align: 'right', width: 120 },
        cell: ({ row }) =>
          row.original.avgUnitCost === null ? '—' : money(row.original.avgUnitCost),
      },
      {
        id: 'cogs',
        header: 'Giá vốn',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => money(row.original.cogs),
      },
      {
        id: 'grossProfit',
        header: 'Lãi gộp',
        meta: { align: 'right', width: 130 },
        cell: ({ row }) => profitCell(row.original.grossProfit),
      },
      {
        id: 'marginPct',
        header: '% lãi',
        meta: { align: 'right', width: 80 },
        cell: ({ row }) => <span className="tabular-nums">{pct(row.original.marginPct)}</span>,
      },
      {
        id: 'costStatus',
        header: 'Giá vốn',
        meta: { width: 120 },
        cell: ({ row }) => <CostStatusBadge status={row.original.costStatus} />,
      },
    ],
    [],
  );

  if (!canView) return <ForbiddenState className="m-4" />;

  const runBackfill = () =>
    backfill.mutate(
      { from, to },
      {
        onSuccess: (r) =>
          toast.success('Đã chốt số liệu cho đơn cũ', {
            description: `Quét ${r.scanned} đơn · chốt giá vốn ${r.costed} đơn · cập nhật cước ${r.shippingRefreshed} đơn`,
          }),
        onError: (err) => toast.error(messageFor(err)),
      },
    );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Lợi nhuận"
        description={`Doanh thu − giá vốn FIFO theo từng lô nhập − cước vận chuyển · đơn đã chốt · ${rangeLabel}`}
        breadcrumb={[{ label: 'Tài chính' }, { label: 'Lợi nhuận' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={runBackfill}
            disabled={backfill.isPending}
            title="Đơn đóng gói / giao trước khi có báo cáo này chưa có giá vốn, cước, trạng thái hoàn — chạy một lần cho khoảng ngày đang xem"
          >
            {backfill.isPending ? 'Đang chốt…' : 'Chốt giá vốn đơn cũ'}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card px-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Chọn nhanh khoảng ngày">
          {presets.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={p.from === from && p.to === to ? 'default' : 'outline'}
              onClick={() => setRange(p.from, p.to)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Từ ngày
          <Input
            type="date"
            className="h-8 w-40"
            value={from}
            max={today}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Từ ngày"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          Đến ngày
          <Input
            type="date"
            className="h-8 w-40"
            value={to}
            max={today}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Đến ngày"
          />
        </label>
        <div className="flex gap-1" role="group" aria-label="Xem theo">
          {(
            [
              ['order', 'Theo đơn'],
              ['sku', 'Theo SKU'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={view === key ? 'default' : 'outline'}
              onClick={() =>
                set({ filters: { ...state.filters, view: key === 'order' ? undefined : key } })
              }
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="ml-auto flex flex-col gap-0.5 text-xs text-muted-foreground">
          Tìm
          <Input
            key={view}
            className="h-8 w-56"
            defaultValue={state.q}
            placeholder={view === 'order' ? 'Số đơn, mã / tên khách' : 'Mã / tên SKU'}
            aria-label="Tìm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') set({ q: e.currentTarget.value.trim() });
            }}
            onBlur={(e) => {
              if (e.currentTarget.value.trim() !== state.q)
                set({ q: e.currentTarget.value.trim() });
            }}
          />
        </label>
      </div>

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={10} />}
        isEmpty={(d) => d.summary.orderCount === 0}
        empty={
          <EmptyState
            title="Chưa có đơn đã chốt trong khoảng này"
            description="Lợi nhuận tính trên đơn đã chốt theo ngày đặt hàng — chọn khoảng ngày khác hoặc xem danh sách đơn."
            action={
              <Button variant="outline" asChild>
                <Link href="/crm/orders">Mở danh sách đơn</Link>
              </Button>
            }
          />
        }
      >
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                label="Doanh thu"
                value={formatMoney(data.summary.revenue)}
                detail={`${data.summary.orderCount} đơn · KM cấp đơn ${formatMoney(data.summary.orderDiscount)}`}
              />
              <KpiCard
                label="Giá vốn"
                value={formatMoney(data.summary.cogs)}
                detail={`Đã chốt ${formatMoney(data.summary.actualCogs)} · tạm tính ${formatMoney(data.summary.estimatedCogs)}`}
              />
              <KpiCard
                label="Lãi gộp"
                value={formatMoney(data.summary.grossProfit)}
                detail="Doanh thu − giá vốn"
              />
              <KpiCard
                label="% lãi gộp"
                value={pct(data.summary.marginPct)}
                detail="trên doanh thu"
              />
              <KpiCard
                label="Cước vận chuyển"
                value={formatMoney(data.summary.shippingCost)}
                detail={
                  data.summary.shippingCostMissingCount > 0
                    ? `Thu khách ${formatMoney(data.summary.shippingCharged)} · ${data.summary.shippingCostMissingCount} đơn chưa có cước`
                    : `Thu khách ${formatMoney(data.summary.shippingCharged)}`
                }
              />
              <KpiCard
                label="Lãi sau vận chuyển"
                value={
                  <span className={cn(negative(data.summary.netProfit) && 'text-destructive')}>
                    {formatMoney(data.summary.netProfit)}
                  </span>
                }
                detail={`${pct(data.summary.netMarginPct)} · lãi gộp + phí ship thu − cước`}
              />
            </div>
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {data.summary.returnedOrderCount > 0 ? (
                <li>
                  <span className="font-semibold text-foreground">
                    {data.summary.returnedOrderCount} đơn có hàng hoàn
                  </span>{' '}
                  — đã loại {formatMoney(data.summary.returnedRevenue)} doanh thu và{' '}
                  {formatMoney(data.summary.returnedCogs)} giá vốn (hàng nhập lại kho); hàng hủy vẫn
                  tính giá vốn, cước vẫn tính.
                </li>
              ) : null}
              {data.summary.awaitingReturnReceiptCount > 0 ? (
                <li className="text-warning">
                  {data.summary.awaitingReturnReceiptCount} đơn ĐVVC đã hoàn nhưng kho chưa post
                  phiếu nhập hàng hoàn — đang tạm coi hàng về đủ.{' '}
                  <Link href="/wms/returns/new" className="underline">
                    Lập phiếu
                  </Link>
                </li>
              ) : null}
              <li>
                Thuế trên đơn {formatMoney(data.summary.taxAmount)} — tiền thu hộ, không tính vào
                doanh thu và lợi nhuận.
              </li>
              {data.summary.missingCostSkuCount > 0 ? (
                <li className="text-destructive">
                  {data.summary.missingCostSkuCount} SKU chưa từng nhập kho — giá vốn phần đó tính
                  0, lãi đang cao hơn thực tế.
                </li>
              ) : null}
            </ul>
            {view === 'sku' ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Doanh thu theo SKU là thành tiền dòng đã trừ phần hoàn, chưa trừ khuyến mãi cấp
                  đơn; không gồm đơn ĐVVC hoàn. Phí ship, cước, thuế là cấp đơn nên không phân bổ về
                  từng SKU.
                </p>
                <DataTable
                  columns={skuColumns}
                  rows={data.skus}
                  getRowId={(r) => r.skuId}
                  total={data.total}
                  page={state.page}
                  size={state.size}
                  sort={null}
                  onPageChange={(page) => set({ page })}
                  onSizeChange={(size) => set({ size })}
                  onSortChange={() => undefined}
                />
              </>
            ) : (
              <DataTable
                columns={orderColumns}
                rows={data.orders}
                getRowId={(r) => r.orderId}
                total={data.total}
                page={state.page}
                size={state.size}
                sort={null}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={() => undefined}
              />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}
