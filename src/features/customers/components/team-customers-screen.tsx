'use client';

import { Plus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef, type FilterDef } from '@/components/data/data-table';
import { normalizeRange, shiftDay } from '@/components/data/date-range-picker';
import { EntityPicker } from '@/components/data/form/entity-picker';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatPhone, groupVi, toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import { usePurposes } from '../api/use-care';
import { useTeamCustomers, useTeamSkuSearch, type TeamCustomer } from '../api/use-team-customers';

/**
 * Khách của team CSKH (2026-10-21 docs/PLAN-cskh.md §3.7; 2026-10-26 biên bản họp CSKH, mockup
 * canvas SVf5Yc5pCBTzezpd4rru9Z màn 1) — GET /customer-care/customers.
 *
 * Mặc định xếp theo đơn gần nhất; "Doanh thu cao → thấp" xếp hạng theo doanh thu kỳ (chỉ đơn nhân
 * viên trong team lên) + Top 10 / 50 / 100 / gõ số. Lọc mục đích sử dụng, sản phẩm đã mua, ngày
 * gán. URL (luật 8): ?from&to (kỳ doanh thu, mặc định tháng này) · ?order=revenue · ?top=50 ·
 * ?purposes=id,id · ?sku=id&skuLabel=… · ?assigned=1|3|7 · ?q · ?page
 */
const FILTER_KEYS = [
  'from',
  'to',
  'order',
  'top',
  'purposes',
  'sku',
  'skuLabel',
  'assigned',
] as const;
type TeamFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const MAX_DAYS = 366;
const TOPS = [10, 50, 100];

const columns: ColumnDef<TeamCustomer, unknown>[] = [
  {
    id: 'rank',
    header: '#',
    meta: { width: 48, align: 'right' },
    cell: ({ row }) => (
      <span className="tabular-nums text-subtle-foreground">{row.original.rank}</span>
    ),
  },
  {
    id: 'name',
    header: 'Khách',
    meta: { width: 240 },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/crm/customers/${row.original.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {row.original.name}
        </Link>
        <div className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{row.original.code}</span> · {formatPhone(row.original.phone)}
        </div>
      </div>
    ),
  },
  {
    id: 'purposes',
    header: 'Mục đích sử dụng',
    meta: { width: 220 },
    cell: ({ row }) =>
      row.original.purposes.length ? (
        <div className="flex flex-wrap gap-1">
          {row.original.purposes.map((p) => (
            <span
              key={p.id}
              className="inline-flex h-chip items-center rounded-chip bg-success-weak px-2 text-xs font-semibold text-success"
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-subtle-foreground">—</span>
      ),
  },
  {
    id: 'revenue',
    header: 'Doanh thu kỳ',
    meta: { width: 130, align: 'right' },
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{formatMoney(row.original.revenue)}</span>
    ),
  },
  {
    id: 'orderCount',
    header: 'Số đơn',
    meta: { width: 72, align: 'right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
  },
  {
    id: 'lastOrderAt',
    header: 'Đơn gần nhất',
    meta: { width: 150 },
    cell: ({ row }) =>
      row.original.lastOrderAt ? (
        <span className="tabular-nums">
          {formatDate(row.original.lastOrderAt)}
          {row.original.lastOrderOwnerName ? (
            <span className="text-muted-foreground"> · {row.original.lastOrderOwnerName}</span>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground">Chưa có đơn</span>
      ),
  },
  {
    id: 'latestNote',
    header: 'Chăm sóc gần nhất',
    meta: { width: 280 },
    cell: ({ row }) => {
      const n = row.original.latestNote;
      if (!n) return <span className="text-subtle-foreground">—</span>;
      const text = `${formatDate(n.createdAt)} ${n.authorName}: ${n.body}`;
      return (
        <span className="line-clamp-2 text-muted-foreground" title={text}>
          {text}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    meta: { width: 96 },
    cell: ({ row }) => (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/crm/orders/new?customerId=${row.original.id}`}>Lên đơn</Link>
      </Button>
    ),
  },
];

/** Tất cả / Top 10 / 50 / 100 + ô gõ số — một bộ lọc `top` trên URL. */
function TopPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const current = value ? Number(value) : undefined;
  const [typed, setTyped] = useState(current && !TOPS.includes(current) ? String(current) : '');
  const commit = () => {
    const n = Number(typed);
    onChange(Number.isInteger(n) && n > 0 ? String(n) : undefined);
  };
  const opts: { label: string; v?: number }[] = [
    { label: 'Tất cả' },
    ...TOPS.map((v) => ({ label: `Top ${v}`, v })),
  ];
  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Top theo doanh thu" className="flex">
        {opts.map((o, i) => {
          const on = current === o.v;
          return (
            <Button
              key={o.label}
              type="button"
              size="sm"
              variant={on ? 'default' : 'outline'}
              aria-pressed={on}
              className={cn(
                i > 0 && '-ml-px',
                i > 0 && i < opts.length - 1 && 'rounded-none',
                i === 0 && 'rounded-r-none',
                i === opts.length - 1 && 'rounded-l-none',
              )}
              onClick={() => {
                setTyped('');
                onChange(o.v ? String(o.v) : undefined);
              }}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        aria-label="Số khách top tự nhập"
        placeholder="Số"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        className="h-7 w-20"
      />
    </div>
  );
}

export function TeamCustomersScreen() {
  const { state, set, skipTake } = useListState<TeamFilter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const monthStart = `${today.slice(0, 8)}01`;
  const f = state.filters;
  const range = useMemo(
    () => normalizeRange({ from: f.from, to: f.to }, { from: monthStart, to: today }, MAX_DAYS),
    [f.from, f.to, monthStart, today],
  );
  const byRevenue = f.order === 'revenue' || !!f.top;
  const purposeIds = f.purposes ? f.purposes.split(',') : [];
  const assignedDays = f.assigned ? Number(f.assigned) : undefined;
  const params = useMemo(
    () => ({
      q: state.q,
      from: range.from,
      to: range.to,
      sort: byRevenue ? ('revenue' as const) : ('lastOrder' as const),
      top: f.top ? Number(f.top) : undefined,
      purposeIds,
      skuIds: f.sku ? [f.sku] : undefined,
      ...(assignedDays
        ? { assignedFrom: shiftDay(today, -(assignedDays - 1)), assignedTo: today }
        : {}),
      ...skipTake,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.q, range, byRevenue, f.top, f.purposes, f.sku, assignedDays, today, skipTake],
  );
  const query = useTeamCustomers(params);
  const purposes = usePurposes();
  const filtered = state.q !== '' || purposeIds.length > 0 || !!f.sku || !!assignedDays || !!f.top;

  const filters: FilterDef<TeamFilter>[] = [
    { key: 'from', toKey: 'to', label: 'Doanh thu', type: 'dateRange', maxDays: MAX_DAYS },
    {
      key: 'order',
      label: 'Sắp xếp',
      type: 'select',
      options: [
        { value: 'lastOrder', label: 'Đơn gần nhất' },
        { value: 'revenue', label: 'Doanh thu cao → thấp' },
      ],
    },
    {
      key: 'top',
      label: 'Top',
      type: 'custom',
      render: ({ value, onChange }) => <TopPicker value={value} onChange={onChange} />,
    },
    {
      key: 'purposes',
      label: 'Mục đích',
      type: 'multiSelect',
      unit: 'mục đích',
      options: (purposes.data ?? []).map((p) => ({
        value: p.id,
        label: p.name,
        hint: `${groupVi(String(p.customerCount))} khách`,
      })),
    },
    {
      key: 'sku',
      label: 'Đã mua sản phẩm',
      type: 'custom',
      render: ({ value }) => (
        <EntityPicker
          value={value ?? ''}
          onChange={(id, option) =>
            set({ filters: { sku: id || undefined, skuLabel: option?.label || undefined } })
          }
          useSearch={useTeamSkuSearch}
          selectedLabel={f.skuLabel}
          placeholder="Đã mua sản phẩm…"
          searchPlaceholder="Mã / tên sản phẩm…"
          clearable
          className="w-56"
        />
      ),
    },
    {
      key: 'assigned',
      label: 'Được gán',
      type: 'select',
      options: [
        { value: '1', label: 'Gán hôm nay' },
        { value: '3', label: 'Gán 3 ngày' },
        { value: '7', label: 'Gán 7 ngày' },
      ],
    },
  ];

  const rangeLabel =
    range.from === range.to
      ? `ngày ${formatDate(`${range.from}T00:00:00+07:00`)}`
      : `${formatDate(`${range.from}T00:00:00+07:00`)} – ${formatDate(`${range.to}T00:00:00+07:00`)}`;

  return (
    <>
      <PageHeader
        title={query.data ? `Khách của team · ${query.data.teamName}` : 'Khách của team'}
        description={
          query.data
            ? `${groupVi(String(query.data.total))} khách · doanh thu tính theo đơn nhân viên trong team lên, ${rangeLabel}`
            : 'Đang tải khách của team…'
        }
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Khách của team' }]}
        actions={
          <Button asChild>
            <Link href="/crm/orders/new">
              <Plus aria-hidden />
              Tạo đơn
            </Link>
          </Button>
        }
      />

      <FilterBar<TeamFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{
          ...f,
          from: range.from,
          to: range.to,
          order: byRevenue ? 'revenue' : 'lastOrder',
        }}
        onFilterChange={(patch) => {
          // Chọn Top là xếp theo doanh thu; về "Đơn gần nhất" thì bỏ Top.
          if ('order' in patch && patch.order !== 'revenue') patch = { ...patch, top: undefined };
          if ('order' in patch && patch.order === 'lastOrder')
            patch = { ...patch, order: undefined };
          set({ filters: patch });
        }}
        searchPlaceholder="Mã, tên hoặc SĐT khách"
        filters={filters}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={UsersRound}
            title={filtered ? 'Không có khách khớp' : 'Team chưa có khách nào'}
            description={
              filtered
                ? 'Thử bỏ bớt mục đích, sản phẩm hoặc Top.'
                : 'Khách mới được chia tự động lúc 00:05 mỗi ngày, hoặc về team khi nhân viên lên đơn.'
            }
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    set({
                      q: '',
                      filters: {
                        purposes: undefined,
                        sku: undefined,
                        skuLabel: undefined,
                        assigned: undefined,
                        top: undefined,
                      },
                    })
                  }
                >
                  Xóa lọc
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/crm/orders/new">Tạo đơn</Link>
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
            sort={null}
            onPageChange={(page) => set({ page })}
            onSizeChange={(size) => set({ size })}
            onSortChange={() => undefined}
          />
        )}
      </QueryState>
    </>
  );
}
