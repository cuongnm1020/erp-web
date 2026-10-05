'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import {
  customerKeys,
  toCustomerSort,
  useCustomers,
  useDeleteCustomer,
  type Customer,
  type CustomerListItem,
  type CustomerListParams,
} from '../api/use-customers';
import { useCustomerGroups, useCustomerTiers } from '../api/use-segments';
import { CUSTOMER_TYPE_OPTIONS, customerTypeLabel, customerTypeTone } from '../labels';
import { CUSTOMER_TYPE_VALUES } from '../schema';
import { CustomerTagFilter, MAX_TAG_FILTER } from './customer-tag-filter';
import { TagChip } from './tag-chip';

/** Bộ lọc trên URL (luật 8): ?group=&tier=&tags=a,b&tagMatch=all&province=&type=&from=&to= */
const FILTER_KEYS = [
  'group',
  'tier',
  'tags',
  'tagMatch',
  'province',
  'type',
  'from',
  'to',
] as const;
type CustomerFilter = (typeof FILTER_KEYS)[number];

/** Mặc định khớp mặc định của API: sắp theo tên tăng dần. */
const DEFAULTS = { size: 50, sort: { id: 'name', desc: false }, filterKeys: FILTER_KEYS };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** Tag hiện tối đa trên một dòng; còn lại gom "+n". */
const ROW_TAGS = 2;

/** Filter trên URL → tham số GET /customers. Giá trị lạ (dán link tay) bị bỏ, không gửi lên. */
export function toCustomerFilterParams(
  f: Partial<Record<CustomerFilter, string>>,
): Omit<CustomerListParams, 'take' | 'skip'> {
  const tagIds = (f.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAG_FILTER);
  const type = (CUSTOMER_TYPE_VALUES as readonly string[]).includes(f.type ?? '')
    ? (f.type as Customer['type'])
    : undefined;
  return {
    groupId: f.group || undefined,
    tierId: f.tier || undefined,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    tagMatch: tagIds.length > 0 ? (f.tagMatch === 'all' ? 'all' : 'any') : undefined,
    province: f.province?.trim() || undefined,
    type,
    createdFrom: f.from && DATE_KEY.test(f.from) ? f.from : undefined,
    createdTo: f.to && DATE_KEY.test(f.to) ? f.to : undefined,
  };
}

/** Ô tỉnh/thành: API so khớp NGUYÊN tên → chờ gõ xong (debounce 400ms / Enter) mới lọc. */
function ProvinceInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    if (draft.trim() === (value ?? '')) return;
    const t = setTimeout(() => onChange(draft.trim() || undefined), 400);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onChange(draft.trim() || undefined);
      }}
      placeholder="Tỉnh/thành (đúng tên)"
      aria-label="Tỉnh/thành"
      className="h-9 w-44"
    />
  );
}

/**
 * B-01 Danh sách khách hàng — GET /customers.
 * Danh sách đã được API scope (bất biến 8): sale chỉ nhận về khách của mình / của team mình
 * làm leader. Frontend KHÔNG lọc lại theo quyền (luật 7); thấy bản ghi lạ là bug backend.
 *
 * Phân trang / tìm nhanh / sắp xếp nằm trên URL (luật 8) — F5 và dán link cho đồng nghiệp ra
 * đúng kết quả. Sắp xếp chạy PHÍA SERVER qua `sortBy`/`sortDir`; chỉ những cột API nhận mới
 * được đánh `sortable` (name, code, type, creditLimit, createdAt) để không hứa hão.
 * CRM-04: lọc nhóm / cấp / tag (nhiều, khớp có-một / có-đủ) / tỉnh / loại / ngày tạo — tất cả
 * chạy phía server và nằm trên URL. Chưa có lọc công nợ (API chưa hỗ trợ).
 */
const columns: ColumnDef<CustomerListItem, unknown>[] = [
  {
    id: 'code',
    accessorKey: 'code',
    header: 'Mã KH',
    meta: { width: 120, sortable: true },
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
    accessorKey: 'name',
    header: 'Tên khách hàng',
    meta: { width: 280, sortable: true },
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: 'Điện thoại',
    meta: { width: 130 },
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{formatPhone(getValue() as string | null)}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Loại khách',
    meta: { width: 150, sortable: true },
    cell: ({ row }) => (
      <StatusBadge tone={customerTypeTone(row.original.type)}>
        {customerTypeLabel(row.original.type)}
      </StatusBadge>
    ),
  },
  {
    id: 'segment',
    header: 'Nhóm · cấp độ',
    meta: { width: 170 },
    cell: ({ row }) => {
      const { group, tier } = row.original;
      if (!group && !tier) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap items-center gap-1">
          {group ? <span className="truncate">{group.name}</span> : null}
          {tier ? <StatusBadge tone="brand">{tier.name}</StatusBadge> : null}
        </div>
      );
    },
  },
  {
    id: 'tags',
    header: 'Tag',
    meta: { width: 200 },
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap items-center gap-1">
          {tags.slice(0, ROW_TAGS).map((t) => (
            <TagChip key={t.id} name={t.name} color={t.color} />
          ))}
          {tags.length > ROW_TAGS ? (
            <span
              className="text-xs text-muted-foreground"
              title={tags
                .slice(ROW_TAGS)
                .map((t) => t.name)
                .join(', ')}
            >
              +{tags.length - ROW_TAGS}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: 'creditLimit',
    accessorKey: 'creditLimit',
    header: 'Hạn mức công nợ',
    meta: { align: 'right', width: 150, sortable: true },
    cell: ({ getValue }) => formatMoney(getValue() as string | null, { unit: '' }),
  },
  {
    id: 'paymentTerm',
    accessorKey: 'paymentTerm',
    header: 'Hạn thanh toán',
    meta: { align: 'right', width: 130 },
    cell: ({ getValue }) => {
      const d = getValue() as number | null;
      return d === null ? '—' : `${d} ngày`;
    },
  },
  {
    id: 'isActive',
    accessorKey: 'isActive',
    header: 'Trạng thái',
    meta: { width: 120 },
    cell: ({ getValue }) =>
      (getValue() as boolean) ? (
        <StatusBadge tone="ok">Hoạt động</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Ngừng</StatusBadge>
      ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Khách từ',
    meta: { width: 120, sortable: true },
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
  {
    id: 'actions',
    header: '',
    meta: { title: 'Thao tác', width: 90, align: 'right' },
    cell: ({ row }) => <CustomerRowActions customer={row.original} />,
  },
];

/** Xóa = soft delete phía API (KH chuyển Ngừng hợp tác, giữ lịch sử) — không optimistic (luật 5). */
function CustomerRowActions({ customer }: { customer: CustomerListItem }) {
  const ability = useAbility();
  const del = useDeleteCustomer();
  const canUpdate = ability.can('update', 'Customer');
  const canDelete = ability.can('delete', 'Customer');
  if (!canUpdate && !canDelete) return null;
  return (
    <RowActions
      editHref={canUpdate ? `/crm/customers/${customer.id}/edit` : undefined}
      onDelete={
        canDelete
          ? () =>
              del.mutateAsync(customer.id).then(
                () => toast.success(`Đã xóa khách hàng ${customer.code}`),
                (err) => toast.error(messageFor(err)),
              )
          : undefined
      }
      itemName={`khách hàng ${customer.code}`}
      deleteDescription="Khách chuyển sang Ngừng hợp tác — dữ liệu và lịch sử đơn / công nợ giữ nguyên."
    />
  );
}

export function CustomerListScreen() {
  const { state, set, skipTake } = useListState<CustomerFilter>(DEFAULTS);
  const filterParams = useMemo(() => toCustomerFilterParams(state.filters), [state.filters]);
  const params = useMemo(
    () => ({ q: state.q, ...toCustomerSort(state.sort), ...filterParams, ...skipTake }),
    [state.q, state.sort, filterParams, skipTake],
  );
  const query = useCustomers(params);
  const groups = useCustomerGroups({ includeInactive: true });
  const tiers = useCustomerTiers();
  useInvalidateOn(['customer.created', 'customer.updated'], [customerKeys.lists()]);
  const filtered = state.q !== '' || Object.keys(state.filters).length > 0;
  const setFilters = (patch: Partial<Record<CustomerFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });
  const clearAll = () => set({ q: '', filters: {} });

  return (
    <>
      <PageHeader
        title="Khách hàng của tôi"
        description={
          query.data
            ? filtered
              ? `${query.data.total} khách khớp bộ lọc`
              : `${query.data.total} khách được phân cho tôi`
            : 'Đang đếm số khách…'
        }
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Danh sách' }]}
        actions={
          <Can I="create" a="Customer">
            <Button size="sm" asChild>
              <Link href="/crm/customers/new">
                <Plus aria-hidden />
                Tạo khách hàng
              </Link>
            </Button>
          </Can>
        }
      />

      <FilterBar<CustomerFilter>
        q={state.q}
        onQChange={(q) => set({ q })}
        values={state.filters}
        onFilterChange={setFilters}
        searchPlaceholder="Tìm theo tên, mã KH, SĐT…"
        filters={[
          {
            key: 'group',
            label: 'Nhóm',
            type: 'select',
            options: (groups.data ?? []).map((g) => ({
              value: g.id,
              label: g.isActive ? g.name : `${g.name} (ngừng dùng)`,
            })),
          },
          {
            key: 'tier',
            label: 'Cấp độ',
            type: 'select',
            options: [...(tiers.data ?? [])]
              .sort((a, b) => b.sortOrder - a.sortOrder)
              .map((t) => ({ value: t.id, label: t.name })),
          },
          {
            key: 'tags',
            label: 'Tag',
            type: 'custom',
            render: () => (
              <CustomerTagFilter
                value={filterParams.tagIds ?? []}
                match={filterParams.tagMatch ?? 'any'}
                onChange={({ tagIds, match }) =>
                  setFilters({
                    tags: tagIds.length > 0 ? tagIds.join(',') : undefined,
                    tagMatch: tagIds.length > 0 && match === 'all' ? 'all' : undefined,
                  })
                }
              />
            ),
          },
          {
            key: 'type',
            label: 'Loại khách',
            type: 'select',
            options: CUSTOMER_TYPE_OPTIONS,
          },
          {
            key: 'province',
            label: 'Tỉnh/thành',
            type: 'custom',
            render: ({ value, onChange }) => <ProvinceInput value={value} onChange={onChange} />,
          },
          { key: 'from', label: 'Tạo từ ngày', type: 'date' },
          { key: 'to', label: 'Tạo đến ngày', type: 'date' },
        ]}
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={12} columns={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={filtered ? 'Không có khách hàng khớp' : 'Chưa có khách hàng nào được phân'}
            description={
              filtered
                ? 'Thử bỏ bớt bộ lọc hoặc từ khóa khác — hoặc khách này đang do người khác phụ trách.'
                : 'Tạo khách hàng đầu tiên để bắt đầu bán.'
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={clearAll}>
                  Xóa lọc
                </Button>
              ) : (
                <Can I="create" a="Customer">
                  <Button asChild>
                    <Link href="/crm/customers/new">
                      <Plus aria-hidden />
                      Tạo khách hàng
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
