'use client';

import { Plus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import {
  DateRangePicker,
  normalizeRange,
  shiftDay,
  type DateRangePreset,
} from '@/components/data/date-range-picker';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime, formatPhone, groupVi, toLocalDateKey } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import { useTeamCustomers, type TeamCustomer } from '../api/use-team-customers';

/**
 * Khách của team CSKH (2026-10-21, docs/PLAN-cskh.md §3.7) — GET /customer-care/customers.
 * Leader và member cùng thấy (kho khách chung của team); API đã scope theo team người xem.
 *
 * Lọc "mới được gán" theo NGÀY GÁN (giờ VN): lượt chia tự động chạy 00:05 nên khách chia đêm qua
 * mang ngày gán hôm nay → mặc định "1 ngày" = hôm nay. URL (luật 8):
 * ?from=2026-10-19&to=2026-10-21 · ?all=1 (mọi lúc) · ?q=… · ?page=2
 */
const FILTER_KEYS = ['from', 'to', 'all'] as const;
type TeamFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
/** Khoảng ngày gán tối đa chọn được — chỉ chặn số liệu vô lý, API không giới hạn. */
const MAX_DAYS = 366;

const SOURCE: Record<TeamCustomer['assignedBy'], { label: string; tone: StatusTone }> = {
  AUTO: { label: 'Chia tự động', tone: 'brand' },
  ORDER: { label: 'CSKH lên đơn', tone: 'ok' },
  OTHER: { label: 'Gán tay', tone: 'neutral' },
};

export function careRangePresets(today: string): DateRangePreset[] {
  return [
    { label: '1 ngày', from: today, to: today },
    { label: '3 ngày', from: shiftDay(today, -2), to: today },
    { label: '7 ngày', from: shiftDay(today, -6), to: today },
  ];
}

const columns: ColumnDef<TeamCustomer, unknown>[] = [
  {
    id: 'code',
    header: 'Mã KH',
    meta: { width: 110 },
    cell: ({ row }) => (
      <Link
        href={`/crm/customers/${row.original.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    id: 'name',
    header: 'Tên khách',
    meta: { width: 240 },
    cell: ({ row }) => (
      <Link href={`/crm/customers/${row.original.id}`} className="font-semibold hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    id: 'phone',
    header: 'SĐT',
    meta: { width: 130 },
    cell: ({ row }) => <span className="font-mono text-xs">{formatPhone(row.original.phone)}</span>,
  },
  {
    id: 'assignedAt',
    header: 'Được gán lúc',
    meta: { width: 140 },
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDateTime(row.original.assignedAt)}</span>
    ),
  },
  {
    id: 'assignedBy',
    header: 'Nguồn gán',
    meta: { width: 130 },
    cell: ({ row }) => {
      const s = SOURCE[row.original.assignedBy];
      return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
    },
  },
  {
    id: 'createdAt',
    header: 'Ngày tạo khách',
    meta: { width: 120 },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'orderCount',
    header: 'Số đơn',
    meta: { width: 80, align: 'right' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
  },
  {
    id: 'lastOrderAt',
    header: 'Đơn gần nhất',
    meta: { width: 120 },
    cell: ({ row }) =>
      row.original.lastOrderAt ? (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(row.original.lastOrderAt)}
        </span>
      ) : (
        <span className="text-muted-foreground">Chưa có đơn</span>
      ),
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

export function TeamCustomersScreen() {
  const { state, set, skipTake } = useListState<TeamFilter>(DEFAULTS);
  const today = toLocalDateKey(new Date()) ?? '';
  const all = state.filters.all === '1';
  const range = useMemo(
    () =>
      normalizeRange(
        { from: state.filters.from, to: state.filters.to },
        { from: today, to: today },
        MAX_DAYS,
      ),
    [state.filters.from, state.filters.to, today],
  );
  const params = useMemo(
    () => ({
      q: state.q,
      ...(all ? {} : { assignedFrom: range.from, assignedTo: range.to }),
      ...skipTake,
    }),
    [state.q, all, range, skipTake],
  );
  const query = useTeamCustomers(params);
  const filtered = state.q !== '';
  const presets = careRangePresets(today);
  const rangeLabel = all
    ? 'mọi lúc'
    : range.from === range.to
      ? `ngày ${formatDate(`${range.from}T00:00:00+07:00`)}`
      : `${formatDate(`${range.from}T00:00:00+07:00`)} – ${formatDate(`${range.to}T00:00:00+07:00`)}`;

  return (
    <>
      <PageHeader
        title={query.data ? `Khách của team · ${query.data.teamName}` : 'Khách của team'}
        description={
          query.data
            ? `${groupVi(String(query.data.total))} khách được gán ${rangeLabel} · kho khách chung, ai trong team cũng chăm được`
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

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <span className="pb-1.5 text-sm font-semibold text-muted-foreground">Mới được gán</span>
        <DateRangePicker
          label="Ngày gán"
          value={range}
          today={today}
          maxDays={MAX_DAYS}
          presets={presets}
          onChange={(r) => set({ filters: { from: r.from, to: r.to } })}
        />
        <Button
          type="button"
          size="sm"
          variant={all ? 'default' : 'outline'}
          aria-pressed={all}
          onClick={() => set({ filters: all ? {} : { all: '1' } })}
        >
          Tất cả
        </Button>
      </div>

      <FilterBar<TeamFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={{}}
        onFilterChange={() => undefined}
        searchPlaceholder="Mã, tên hoặc SĐT khách"
        filters={[]}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={UsersRound}
            title={filtered ? 'Không có khách khớp' : `Chưa có khách nào được gán ${rangeLabel}`}
            description={
              filtered
                ? 'Thử từ khóa khác.'
                : 'Khách mới được chia tự động lúc 00:05 mỗi ngày. Xem khoảng dài hơn để thấy khách cũ của team.'
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={() => set({ q: '' })}>
                  Xóa lọc
                </Button>
              ) : all ? null : (
                <Button variant="outline" onClick={() => set({ filters: { all: '1' } })}>
                  Xem tất cả khách của team
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
