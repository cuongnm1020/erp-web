'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/data/copy-button';
import { DataTable, FilterBar, type ColumnDef, type FilterDef } from '@/components/data/data-table';
import { pancakeShopLabel } from '@/components/data/pancake-shop-select';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatQuantity } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState } from '@/lib/url-state';
import {
  useDeleteFacebookPage,
  useFacebookPages,
  useFacebookPageShops,
  type FacebookPage,
} from '../api/use-facebook-pages';
import { FacebookPageDialog } from './facebook-page-dialog';

const FILTER_KEYS = ['shop', 'origin', 'status'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, filterKeys: FILTER_KEYS };

/** Page không có đơn quá số ngày này → ngày đơn gần nhất tô vàng (page có thể đã ngừng bán). */
const STALE_DAYS = 30;

const ORIGIN_LABEL: Record<FacebookPage['origin'], string> = {
  PANCAKE: 'Tự động',
  MANUAL: 'Thêm tay',
};

/**
 * Quản trị › Page Facebook (2026-10-26, mockup canvas 3r3H9T9rT1URgjzyQuuUwV màn 1–2). Page tự vào
 * danh mục khi đơn Pancake mang page mới; admin (`facebook_page.manage`) thêm / sửa / xóa. Danh sách
 * lọc + phân trang phía server, state trên URL (luật 8).
 */
export function FacebookPagesScreen() {
  const ability = useAbility();
  const canManage = ability.can('manage', 'FacebookPage');
  const { state, set, skipTake } = useListState<FilterKey>(DEFAULTS);
  const [dialog, setDialog] = useState<{ page?: FacebookPage } | null>(null);
  const shops = useFacebookPageShops();
  const del = useDeleteFacebookPage();

  const origin: FacebookPage['origin'] | undefined =
    state.filters.origin === 'PANCAKE' || state.filters.origin === 'MANUAL'
      ? state.filters.origin
      : undefined;
  const isActive =
    state.filters.status === 'active'
      ? true
      : state.filters.status === 'inactive'
        ? false
        : undefined;
  const params = useMemo(
    () => ({ q: state.q, shopId: state.filters.shop || undefined, origin, isActive, ...skipTake }),
    [state.q, state.filters.shop, origin, isActive, skipTake],
  );
  const query = useFacebookPages(params);

  useHotkey('n', () => setDialog({}), { enabled: canManage });

  const shopName = useMemo(() => {
    const byId = new Map((shops.data ?? []).map((s) => [s.shopId, pancakeShopLabel(s)]));
    return (id: string) => byId.get(id) ?? `POS ${id}`;
  }, [shops.data]);

  const columns = useMemo<ColumnDef<FacebookPage, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Tên page',
        meta: { width: 300 },
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-semibold" title={p.name}>
                {p.name}
              </div>
              {p.externalId ? (
                <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <span>{p.externalId}</span>
                  <CopyButton value={p.externalId} label="Page ID" />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Chưa có Page ID</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'shops',
        header: 'POS kết nối',
        meta: { width: 320 },
        cell: ({ row }) => {
          const ids = row.original.shopIds;
          if (!ids.length) return <span className="text-muted-foreground">Chưa gắn POS</span>;
          const shown = ids.slice(0, 2);
          return (
            <div className="flex flex-wrap items-center gap-1" title={ids.map(shopName).join('\n')}>
              {shown.map((id) => (
                <StatusBadge key={id} tone="brand" className="max-w-56 truncate">
                  {shopName(id)}
                </StatusBadge>
              ))}
              {ids.length > shown.length ? (
                <span className="text-xs text-muted-foreground">+{ids.length - shown.length}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        meta: { width: 90, align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatQuantity(String(row.original.orderCount))}</span>
        ),
      },
      {
        id: 'lastOrderAt',
        header: 'Đơn gần nhất',
        meta: { width: 120 },
        cell: ({ row }) => {
          const v = row.original.lastOrderAt;
          if (!v) return <span className="text-muted-foreground">Chưa có đơn</span>;
          const stale = Date.now() - new Date(v).getTime() > STALE_DAYS * 86_400_000;
          return (
            <span
              className={cn('tabular-nums', stale && 'text-warning')}
              title={stale ? `Hơn ${STALE_DAYS} ngày chưa có đơn` : undefined}
            >
              {formatDate(v)}
            </span>
          );
        },
      },
      {
        id: 'origin',
        header: 'Cách thêm',
        meta: { width: 100 },
        cell: ({ row }) => (
          <StatusBadge tone={row.original.origin === 'MANUAL' ? 'brand' : 'neutral'}>
            {ORIGIN_LABEL[row.original.origin]}
          </StatusBadge>
        ),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        meta: { width: 100 },
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="ok">Đang dùng</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Ngưng</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: '',
        meta: { title: 'Thao tác', width: 80, align: 'right' },
        cell: ({ row }) =>
          canManage ? (
            <RowActions
              onEdit={() => setDialog({ page: row.original })}
              itemName={`page "${row.original.name}"`}
              deleteLabel="Xóa page"
              deleteDescription={`Page ẩn khỏi danh sách, ô chọn lúc lên đơn và bộ lọc.${
                row.original.orderCount
                  ? ` ${formatQuantity(String(row.original.orderCount))} đơn cũ vẫn giữ tên page.`
                  : ''
              }${
                row.original.externalId
                  ? ' Nếu Pancake gửi đơn mới từ page này, page sẽ hiện lại.'
                  : ''
              }`}
              onDelete={async () => {
                try {
                  await del.mutateAsync(row.original.id);
                  toast.success(`Đã xóa page ${row.original.name}`);
                } catch (err) {
                  toast.error(messageFor(err));
                }
              }}
            />
          ) : null,
      },
    ],
    [canManage, del, shopName],
  );

  const filters: FilterDef<FilterKey>[] = [
    {
      key: 'shop',
      label: 'POS',
      type: 'select',
      searchable: true,
      options: (shops.data ?? []).map((s) => ({ value: s.shopId, label: pancakeShopLabel(s) })),
    },
    {
      key: 'origin',
      label: 'Cách thêm',
      type: 'select',
      options: [
        { value: 'PANCAKE', label: 'Tự động' },
        { value: 'MANUAL', label: 'Thêm tay' },
      ],
    },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'active', label: 'Đang dùng' },
        { value: 'inactive', label: 'Ngưng' },
      ],
    },
  ];

  const hasFilter = state.q !== '' || Object.values(state.filters).some(Boolean);
  const openCreate = () => setDialog({});

  return (
    <>
      <PageHeader
        title="Page Facebook"
        description={
          query.data
            ? `${query.data.total} page · tự thêm khi đơn Pancake mang page mới`
            : 'Đang đếm…'
        }
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Page Facebook' }]}
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate} shortcut="N">
              <Plus aria-hidden />
              Thêm page
            </Button>
          ) : null
        }
      />

      <FilterBar
        q={state.q}
        onQChange={(q) => set({ q })}
        filters={filters}
        values={state.filters}
        onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
        searchPlaceholder="Tìm tên page, Page ID…"
      />

      <QueryState
        query={query}
        skeleton={<ListSkeleton rows={8} columns={7} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title={hasFilter ? 'Không có page khớp' : 'Chưa có page nào'}
            description={
              hasFilter
                ? 'Thử từ khóa hoặc bộ lọc khác.'
                : 'Page tự thêm khi đơn Pancake mang page mới; thêm tay page chưa có đơn.'
            }
            action={
              hasFilter ? (
                <Button variant="outline" onClick={() => set({ q: '', filters: {} })}>
                  Xóa lọc
                </Button>
              ) : canManage ? (
                <Button onClick={openCreate}>
                  <Plus aria-hidden />
                  Thêm page
                </Button>
              ) : undefined
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

      {dialog ? (
        <FacebookPageDialog
          key={dialog.page?.id ?? 'new'}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          page={dialog.page}
          shops={shops.data ?? []}
        />
      ) : null}
    </>
  );
}
