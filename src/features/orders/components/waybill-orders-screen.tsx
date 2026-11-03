'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { CopyText } from '@/components/data/copy-text';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatQuantity, groupVi } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useListState, type SortState } from '@/lib/url-state';
import {
  usePancakeShops,
  useOrders,
  useTeamFilterOptions,
  type OrderPickupStatus,
  type OrderPrintStatus,
  type SalesOrderListItem,
} from '../api/use-orders';
import { BulkReprintWaybillDialog } from './bulk-reprint-waybill-dialog';
import { CarrierFilter, ProductFilter } from './order-list-screen';

const FILTER_KEYS = [
  'from',
  'to',
  'pos',
  'team',
  'skuId',
  'carrierId',
  'carrierAccountId',
  'pickup',
  'printStatus',
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/** Hãng đã lấy hàng chưa (2026-11-03) — "Chưa lấy" = đã gán ĐVVC nhưng hãng chưa tới bắn mã. */
const PICKUP_OPTIONS: { value: OrderPickupStatus; label: string }[] = [
  { value: 'AWAITING', label: 'Hãng chưa lấy hàng' },
  { value: 'PICKED_UP', label: 'Hãng đã lấy hàng' },
];
const PRINT_OPTIONS: { value: OrderPrintStatus; label: string }[] = [
  { value: 'NOT_PRINTED', label: 'Chưa in tem' },
  { value: 'PRINTED', label: 'Đã in tem' },
  { value: 'ERROR', label: 'Lỗi, không in được' },
];
const pick = <T extends string>(opts: { value: T }[], v: string | undefined): T | undefined =>
  opts.find((o) => o.value === v)?.value;

/** Trạng thái kho sau khi hãng đã lấy hàng (báo lấy → giao / hoàn). */
const PICKED_UP_STATUSES: ReadonlySet<string> = new Set([
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'FAILED',
  'DELIVERED',
  'RETURNED',
]);

/** Mặc định: mới gán trước (user 2026-11-03 — sắp theo thời gian gán). */
const DEFAULT_SORT: SortState = { id: 'sentAt', desc: true };
const LIST_DEFAULTS = { filterKeys: FILTER_KEYS, sort: DEFAULT_SORT };

/**
 * Theo dõi đơn (2026-11-03, trước tên "Đơn đã gán vận chuyển"): mọi đơn đã Gửi sang ĐVVC (`sentToCarrierAt`) — tìm theo ngày
 * gán, sắp theo giờ gán, lọc POS / phòng ban / sản phẩm / hãng, chọn nhiều để in lại tem vận đơn.
 * Dữ liệu = GET /sales-orders?sentToCarrier=true, scope theo người xem ở API (luật 7).
 */
export function WaybillOrdersScreen() {
  const { state, set, skipTake } = useListState<FilterKey>(LIST_DEFAULTS);
  const ability = useAbility();
  const canFilterTeam = ability.can('filter_team', 'SalesOrder');
  const canReprint = ability.can('pack', 'Shipment');
  const shops = usePancakeShops();
  const teamOptions = useTeamFilterOptions(canFilterTeam);
  const f = state.filters;
  const team = canFilterTeam ? (f.team ?? '') : '';
  const sort = state.sort ?? DEFAULT_SORT;

  const query = useOrders({
    q: state.q,
    sentToCarrier: true,
    from: f.from,
    to: f.to,
    dateField: 'sentToCarrierAt',
    pancakeShopId: f.pos || undefined,
    teamIds: team || undefined,
    skuId: f.skuId,
    carrierId: f.carrierId,
    carrierAccountId: f.carrierAccountId,
    pickupStatus: pick(PICKUP_OPTIONS, f.pickup),
    printStatus: pick(PRINT_OPTIONS, f.printStatus),
    sortBy: 'sentToCarrierAt',
    sortDir: sort.desc ? 'desc' : 'asc',
    ...skipTake,
  });

  const shopName = useMemo(() => {
    const byId = new Map((shops.data ?? []).map((s) => [s.shopId, pancakeShopLabel(s)]));
    return (id: string | null) => (id ? (byId.get(id) ?? `POS ${id}`) : null);
  }, [shops.data]);
  const columns = useMemo(() => buildColumns(shopName), [shopName]);

  const [selected, setSelected] = useState<RowSelectionState>({});
  const selectedRows = (query.data?.items ?? []).filter((r) => selected[r.id]);
  const setFilter = (patch: Partial<Record<FilterKey, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });
  const hasFilter = !!(
    state.q ||
    f.from ||
    f.to ||
    f.pos ||
    team ||
    f.skuId ||
    f.carrierId ||
    f.carrierAccountId ||
    f.pickup ||
    f.printStatus
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Kho' }, { label: 'Theo dõi đơn' }]}
        title="Theo dõi đơn"
        description={
          query.data
            ? `${groupVi(String(query.data.total))} đơn đã gửi sang đơn vị vận chuyển`
            : 'Đang đếm đơn đã gửi sang đơn vị vận chuyển…'
        }
        actions={
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden />
            Làm mới
          </Button>
        }
      />

      {selectedRows.length > 0 ? (
        <div className="mb-3">
          <BulkActionBar
            count={selectedRows.length}
            noun="đơn"
            onClear={() => setSelected({})}
            className="min-h-8 rounded-md border-b-0 py-0"
          >
            <span className="ml-auto" />
            {canReprint ? <BulkReprintWaybillDialog rows={selectedRows} /> : null}
          </BulkActionBar>
        </div>
      ) : (
        <FilterBar<FilterKey>
          q={state.q}
          onQChange={(q) => set({ q })}
          searchPlaceholder="Mã đơn, SĐT, tên khách, mã vận đơn"
          filters={[
            {
              key: 'from',
              toKey: 'to',
              label: 'Ngày gán',
              type: 'dateRange',
              rememberKey: 'date.waybills',
            },
            { key: 'pickup', label: 'Hãng lấy hàng', type: 'select', options: PICKUP_OPTIONS },
            { key: 'printStatus', label: 'In tem', type: 'select', options: PRINT_OPTIONS },
            {
              key: 'pos',
              label: 'POS',
              type: 'select',
              searchable: true,
              options: (shops.data ?? []).map((s) => ({
                value: s.shopId,
                label: pancakeShopLabel(s),
              })),
            },
            ...(canFilterTeam
              ? [
                  {
                    key: 'team' as const,
                    label: 'Phòng ban',
                    type: 'multiSelect' as const,
                    unit: 'phòng',
                    options: (teamOptions.data ?? []).map((t) => ({
                      value: t.teamId,
                      label: t.isActive ? t.name : `${t.name} (ngừng hoạt động)`,
                      hint: t.group === 'CSKH' ? 'CSKH' : 'Sale/MKT',
                    })),
                  },
                ]
              : []),
            {
              key: 'skuId',
              label: 'Sản phẩm',
              type: 'custom',
              render: () => (
                <ProductFilter
                  skuId={f.skuId ?? ''}
                  onChange={(v) => setFilter({ skuId: v || undefined })}
                />
              ),
            },
            {
              key: 'carrierId',
              label: 'Hãng vận chuyển',
              type: 'custom',
              render: () => (
                <CarrierFilter
                  withNone={false}
                  noCarrier={false}
                  carrierId={f.carrierId ?? ''}
                  carrierAccountId={f.carrierAccountId ?? ''}
                  onChange={(patch) =>
                    setFilter({
                      carrierId: patch.carrierId,
                      carrierAccountId: patch.carrierAccountId,
                    })
                  }
                />
              ),
            },
          ]}
          values={{ ...f, team }}
          onFilterChange={(patch) => setFilter(patch)}
        />
      )}

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={
              hasFilter ? 'Không có đơn nào khớp' : 'Chưa có đơn nào gửi sang đơn vị vận chuyển'
            }
            description={
              hasFilter
                ? 'Thử bỏ bớt bộ lọc hoặc đổi khoảng ngày gán.'
                : 'Đơn hiện ở đây sau khi kho Gửi sang ĐVVC.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/crm/orders">Mở danh sách đơn</Link>
                </Button>
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
            sort={sort}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={(next) => set({ sort: next ?? { ...DEFAULT_SORT, desc: !sort.desc } })}
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </QueryState>
    </>
  );
}

function buildColumns(
  shopName: (id: string | null) => string | null,
): ColumnDef<SalesOrderListItem, unknown>[] {
  const muted = <span className="text-muted-foreground">—</span>;
  return [
    {
      id: 'doc',
      header: 'Đơn',
      meta: { width: 170 },
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <Link
            href={`/crm/orders/${row.original.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.docNumber}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">
            {row.original.recipientName ?? row.original.customer.name}
          </span>
        </div>
      ),
    },
    {
      id: 'pos',
      header: 'POS',
      meta: { width: 150 },
      cell: ({ row }) => shopName(row.original.posShopId) ?? muted,
    },
    {
      id: 'team',
      header: 'Phòng ban',
      meta: { width: 150 },
      cell: ({ row }) => row.original.teamName ?? muted,
    },
    {
      id: 'product',
      header: 'Sản phẩm',
      meta: { width: 220 },
      cell: ({ row }) => {
        const p = row.original.product;
        if (!p) return muted;
        return (
          <span className="block truncate" title={p.name}>
            {p.name} × {formatQuantity(p.qty)}
            {p.moreCount > 0 ? (
              <span className="text-muted-foreground"> +{p.moreCount} SP</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'carrier',
      header: 'Hãng / mã vận đơn',
      meta: { width: 190 },
      cell: ({ row }) => {
        const s = row.original.shipment;
        return (
          <div className="space-y-0.5">
            <span className="block">{s?.carrierName ?? s?.carrierCode ?? 'Đã chọn hãng'}</span>
            {s?.trackingNo ? (
              <CopyText value={s.trackingNo} what="mã vận đơn" className="font-mono text-xs">
                {s.trackingNo}
              </CopyText>
            ) : (
              <span className="text-xs text-muted-foreground">Chưa có mã</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'pickup',
      header: 'Hãng lấy hàng',
      meta: { width: 170 },
      cell: ({ row }) => {
        const o = row.original;
        const st = o.fulfilmentStatus;
        const text = o.carrierStatusText ? (
          <span
            className="block truncate text-xs text-muted-foreground"
            title={o.carrierStatusText}
          >
            {o.carrierStatusText}
          </span>
        ) : null;
        if (o.status === 'CANCELLED' || st === 'CANCELLED') {
          return <StatusBadge tone="neutral">Đơn đã hủy</StatusBadge>;
        }
        if (st === 'CARRIER_CANCELLED') {
          return (
            <div className="space-y-0.5">
              <StatusBadge tone="err">Hãng hủy mã</StatusBadge>
              {text}
            </div>
          );
        }
        const picked = st !== null && PICKED_UP_STATUSES.has(st);
        return (
          <div className="space-y-0.5">
            <StatusBadge tone={picked ? 'ok' : 'warn'}>
              {picked ? 'Đã lấy hàng' : 'Chưa lấy hàng'}
            </StatusBadge>
            {text}
          </div>
        );
      },
    },
    {
      id: 'sentAt',
      header: 'Thời gian gán',
      meta: { width: 140, sortable: true },
      cell: ({ row }) =>
        row.original.sentToCarrierAt ? (
          <span className="tabular-nums">{formatDateTime(row.original.sentToCarrierAt)}</span>
        ) : (
          muted
        ),
    },
    {
      id: 'printed',
      header: 'In tem',
      meta: { width: 130 },
      cell: ({ row }) =>
        row.original.labelPrintedAt ? (
          <StatusBadge tone="ok">Đã in {formatDateTime(row.original.labelPrintedAt)}</StatusBadge>
        ) : (
          <StatusBadge tone="warn">Chưa in</StatusBadge>
        ),
    },
  ];
}
