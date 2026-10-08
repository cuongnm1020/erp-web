'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatPhone, groupVi } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import { useConsents, type ConsentListParams, type ConsentStateItem } from '../api/use-consents';
import {
  CONSENT_CHANNELS,
  consentChannelLabel,
  consentPurposeLabel,
  consentSourceLabel,
  consentStateLabel,
  consentStateTone,
} from '../consent-labels';

/**
 * B-05 Đồng ý nhận marketing (PDPD) — GET /consents (CRM-11).
 * Mỗi dòng = trạng thái MỚI NHẤT của một (khách, kênh), mục đích MARKETING, đã được API scope
 * theo khách người xem phụ trách (luật 7 — không lọc lại ở đây). Khách chưa từng được hỏi không
 * có dòng nào: họ coi như không nhận tin.
 *
 * Bộ lọc trên URL (luật 8): ?channel=SMS&granted=true&from=2026-10-01&to=2026-10-31&q=...&page=2
 */
const FILTER_KEYS = ['channel', 'granted', 'from', 'to'] as const;
type ConsentFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Filter trên URL → tham số API. Giá trị lạ (dán link tay) bị bỏ, không gửi lên. */
export function toConsentFilterParams(
  f: Partial<Record<ConsentFilter, string>>,
): Omit<ConsentListParams, 'take' | 'skip' | 'q'> {
  const channel = (CONSENT_CHANNELS as readonly string[]).includes(f.channel ?? '')
    ? (f.channel as ConsentListParams['channel'])
    : undefined;
  return {
    channel,
    granted: f.granted === 'true' ? true : f.granted === 'false' ? false : undefined,
    from: f.from && DATE_KEY.test(f.from) ? f.from : undefined,
    to: f.to && DATE_KEY.test(f.to) ? f.to : undefined,
  };
}

const columns: ColumnDef<ConsentStateItem, unknown>[] = [
  {
    id: 'code',
    header: 'Mã KH',
    meta: { width: 120 },
    cell: ({ row }) => (
      <Link
        href={`/crm/customers/${row.original.customer.id}`}
        className="font-mono text-xs text-primary hover:underline"
      >
        {row.original.customer.code}
      </Link>
    ),
  },
  {
    id: 'name',
    header: 'Khách hàng',
    meta: { width: 260 },
    cell: ({ row }) => (
      <Link href={`/crm/customers/${row.original.customer.id}`} className="hover:underline">
        {row.original.customer.name}
      </Link>
    ),
  },
  {
    id: 'phone',
    header: 'Điện thoại',
    meta: { width: 130 },
    cell: ({ row }) => (
      <span className="font-mono text-xs">{formatPhone(row.original.customer.phone)}</span>
    ),
  },
  {
    id: 'channel',
    header: 'Kênh',
    meta: { width: 100 },
    cell: ({ row }) => consentChannelLabel(row.original.channel),
  },
  {
    id: 'granted',
    header: 'Trạng thái',
    meta: { width: 110 },
    cell: ({ row }) => (
      <StatusBadge tone={consentStateTone(row.original.granted)}>
        {consentStateLabel(row.original.granted)}
      </StatusBadge>
    ),
  },
  {
    id: 'source',
    header: 'Nguồn',
    meta: { width: 150 },
    cell: ({ row }) => consentSourceLabel(row.original.source),
  },
  {
    id: 'purpose',
    header: 'Mục đích',
    meta: { width: 110 },
    cell: ({ row }) => consentPurposeLabel(row.original.purpose),
  },
  {
    id: 'recordedAt',
    header: 'Cập nhật',
    meta: { width: 140 },
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDateTime(row.original.recordedAt)}</span>
    ),
  },
  {
    id: 'recordedBy',
    header: 'Người ghi',
    meta: { width: 160 },
    cell: ({ row }) =>
      row.original.recordedBy ? (
        row.original.recordedBy.name
      ) : (
        <span className="text-muted-foreground">Khách tự thao tác</span>
      ),
  },
];

export function MarketingConsentScreen() {
  const { state, set, skipTake } = useListState<ConsentFilter>(DEFAULTS);
  const filterParams = useMemo(() => toConsentFilterParams(state.filters), [state.filters]);
  const params = useMemo(
    () => ({ q: state.q, ...filterParams, ...skipTake }),
    [state.q, filterParams, skipTake],
  );
  const query = useConsents(params);
  const filtered = state.q !== '' || Object.keys(state.filters).length > 0;
  const clearAll = () => set({ q: '', filters: {} });

  return (
    <>
      <PageHeader
        title="Đồng ý nhận marketing (PDPD)"
        description={
          query.data
            ? `${groupVi(String(query.data.total))} trạng thái ${filtered ? 'khớp bộ lọc' : 'trong phạm vi bạn phụ trách'} · chỉ gửi chiến dịch tới kênh “Đồng ý”`
            : 'Đang tải trạng thái đồng ý…'
        }
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Đồng ý marketing' },
        ]}
      />

      <FilterBar<ConsentFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm theo tên, SĐT, mã KH…"
        filters={[
          {
            key: 'channel',
            label: 'Kênh',
            type: 'select',
            options: CONSENT_CHANNELS.map((c) => ({ value: c, label: consentChannelLabel(c) })),
          },
          {
            key: 'granted',
            label: 'Trạng thái',
            type: 'select',
            options: [
              { value: 'true', label: 'Đồng ý' },
              { value: 'false', label: 'Từ chối' },
            ],
          },
          { key: 'from', label: 'Cập nhật từ ngày', type: 'date' },
          { key: 'to', label: 'Cập nhật đến ngày', type: 'date' },
        ]}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={9} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={MailCheck}
            title={filtered ? 'Không có trạng thái nào khớp' : 'Chưa ghi nhận đồng ý nào'}
            description={
              filtered
                ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa.'
                : 'Mở hồ sơ khách và bấm “Ghi nhận thay đổi” ở thẻ Đồng ý nhận tin.'
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={clearAll}>
                  Xóa lọc
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/crm/customers">Về danh sách khách hàng</Link>
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

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Mỗi dòng là trạng thái mới nhất của một khách trên một kênh. Khách chưa từng được hỏi không
        có dòng nào và coi như không nhận tin — chiến dịch không bao giờ chạm tới “Từ chối” hoặc
        chưa ghi nhận. Đổi trạng thái ở hồ sơ khách, kèm nguồn + ghi chú bằng chứng; lịch sử giữ
        nguyên, không sửa được.
      </p>
    </>
  );
}
