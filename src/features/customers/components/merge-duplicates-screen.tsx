'use client';

import { GitMerge, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { DataTablePagination } from '@/components/data/data-table';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatPhone } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useListState, type ListStateDefaults } from '@/lib/url-state';
import { useDuplicateGroups, type DuplicateGroup } from '../api/use-customer-merge';
import { sourceLabel } from '../merge-labels';
import { MergeComparePanel, type MergedSummary } from './merge-compare-panel';
import { MergeHistory } from './merge-history';
import { MergeResultView } from './merge-result';

type UrlKey = 'tab' | 'phone' | 'ids' | 'keep' | 'customerId';

/** Hằng module-level: useListState memo theo tham chiếu defaults. */
const LIST_DEFAULTS: ListStateDefaults<UrlKey> = {
  size: 20,
  filterKeys: ['tab', 'phone', 'ids', 'keep', 'customerId'],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').filter((s) => UUID.test(s)))].slice(0, 2);
}

/**
 * CRM-10 — Gộp khách trùng theo SĐT (`/crm/customers/duplicates`, quyền customer.merge).
 *
 * Tab "Nhóm trùng": danh sách nhóm cùng SĐT chuẩn hoá (phân trang server theo nhóm) → chọn 2
 * hồ sơ → so sánh 2 cột, chọn bản giữ + giá trị từng trường → xác nhận → kết quả + Hoàn tác.
 * Tab "Lịch sử gộp": GET /customers/merge-logs, hoàn tác lần gộp còn hiệu lực.
 * Trạng thái tab / trang / nhóm / cặp đang chọn / bản giữ nằm trên URL (luật 8).
 */
export function MergeDuplicatesScreen() {
  const ability = useAbility();
  const { state, set } = useListState(LIST_DEFAULTS);
  const tab = state.filters.tab === 'history' ? 'history' : 'pairs';
  const canMerge = ability.can('merge', 'Customer');
  const groups = useDuplicateGroups(
    { take: state.size, skip: (state.page - 1) * state.size },
    canMerge && tab === 'pairs',
  );
  const [merged, setMerged] = useState<MergedSummary | null>(null);

  if (!canMerge) return <ForbiddenState />;

  const ids = parseIds(state.filters.ids);
  const phone = state.filters.phone;
  const activeGroup = groups.data?.items.find((g) => g.phone === phone);
  const total = groups.data?.total;

  const setTab = (t: 'pairs' | 'history') =>
    set({
      filters: t === 'history' ? { tab: 'history', customerId: state.filters.customerId } : {},
    });

  const selectPair = (patch: { phone?: string; ids?: string[]; keep?: string }) => {
    setMerged(null);
    set({
      page: state.page,
      filters: {
        phone: patch.phone,
        ids: patch.ids && patch.ids.length > 0 ? patch.ids.join(',') : undefined,
        keep: patch.keep,
      },
    });
  };

  const pickGroup = (g: DuplicateGroup) => {
    const first = g.customers.find((c) => c.id === g.suggestedSurvivorId) ?? g.customers[0];
    const second = g.customers.find((c) => c.id !== first?.id);
    selectPair({
      phone: g.phone,
      ids: [first?.id, second?.id].filter((x): x is string => Boolean(x)),
    });
  };

  const toggleCustomer = (g: DuplicateGroup, id: string) => {
    if (g.phone !== phone) {
      selectPair({ phone: g.phone, ids: [id] });
      return;
    }
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2);
    selectPair({
      phone: g.phone,
      ids: next,
      keep:
        state.filters.keep && next.includes(state.filters.keep) ? state.filters.keep : undefined,
    });
  };

  return (
    <>
      <PageHeader
        title="Gộp khách trùng theo SĐT"
        description="Khách cùng số điện thoại chuẩn hoá · chọn 2 hồ sơ để so sánh · đơn đang mở, địa chỉ, tag dồn về bản giữ; chứng từ đã chốt ở lại hồ sơ cũ"
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Gộp khách trùng' }]}
        actions={
          tab === 'pairs' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={groups.isFetching}
              onClick={() => void groups.refetch()}
            >
              <RefreshCw aria-hidden />
              Quét lại ngay
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex h-9 border-b" role="tablist" aria-label="Gộp khách trùng">
        {(
          [
            { key: 'pairs', label: 'Nhóm trùng', count: total },
            { key: 'history', label: 'Lịch sử gộp', count: undefined },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        <MergeHistory
          customerId={
            state.filters.customerId && UUID.test(state.filters.customerId)
              ? state.filters.customerId
              : undefined
          }
          page={state.page}
          size={state.size}
          onPageChange={(page) => set({ page })}
          onSizeChange={(size) => set({ size })}
          onClearCustomer={() => set({ filters: { tab: 'history' } })}
          onShowPairs={() => setTab('pairs')}
        />
      ) : (
        <QueryState
          query={groups}
          skeleton={
            <div className="grid grid-cols-[360px_1fr] items-start gap-3">
              <ListSkeleton rows={8} columns={1} />
              <ListSkeleton rows={12} columns={3} />
            </div>
          }
          isEmpty={(d) => d.items.length === 0 && d.total === 0}
          empty={
            <EmptyState
              icon={GitMerge}
              title="Không còn khách trùng số điện thoại"
              description="Khách mới trùng SĐT (tạo tay hoặc đồng bộ từ Pancake) sẽ hiện ở đây để duyệt gộp."
              action={
                <Button variant="outline" onClick={() => setTab('history')}>
                  Xem lịch sử gộp
                </Button>
              }
            />
          }
        >
          {(d) => (
            <div className="grid grid-cols-[360px_1fr] items-start gap-3">
              <div className="rounded-md border bg-card">
                <header className="border-b px-3 py-2 text-sm font-semibold">
                  Nhóm trùng ({d.total})
                </header>
                {d.items.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    Trang này không còn nhóm nào — quay lại trang trước.
                  </p>
                ) : (
                  <ul aria-label="Nhóm khách trùng">
                    {d.items.map((g) => (
                      <GroupItem
                        key={g.phone}
                        group={g}
                        active={g.phone === phone}
                        selected={g.phone === phone ? ids : []}
                        onPick={() => pickGroup(g)}
                        onToggle={(id) => toggleCustomer(g, id)}
                      />
                    ))}
                  </ul>
                )}
                <div className="border-t px-3">
                  <DataTablePagination
                    page={state.page}
                    size={state.size}
                    total={d.total}
                    onPageChange={(page) => set({ page, filters: {} })}
                    onSizeChange={(size) => set({ size, filters: {} })}
                  />
                </div>
              </div>

              {merged ? (
                <MergeResultView
                  summary={merged}
                  onDone={() => {
                    setMerged(null);
                    set({ page: state.page, filters: {} });
                  }}
                />
              ) : ids.length === 2 ? (
                <MergeComparePanel
                  ids={ids}
                  suggestedId={activeGroup?.suggestedSurvivorId}
                  keepId={state.filters.keep}
                  onKeepChange={(id) =>
                    set({
                      page: state.page,
                      filters: { ...state.filters, keep: id },
                    })
                  }
                  onClear={() => selectPair({})}
                  onMerged={(s) => {
                    setMerged(s);
                    set({ page: state.page, filters: {} });
                  }}
                />
              ) : (
                <EmptyState
                  icon={GitMerge}
                  title="Chọn 2 hồ sơ trong một nhóm để so sánh"
                  description="Bấm số điện thoại để chọn nhanh 2 hồ sơ, hoặc tick từng hồ sơ trong nhóm có nhiều hơn 2 khách."
                />
              )}
            </div>
          )}
        </QueryState>
      )}
    </>
  );
}

function GroupItem({
  group,
  active,
  selected,
  onPick,
  onToggle,
}: {
  group: DuplicateGroup;
  active: boolean;
  selected: string[];
  onPick: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <li
      className={
        active
          ? 'border-b border-l-2 border-l-primary bg-secondary px-3 py-2 last:border-b-0'
          : 'border-b px-3 py-2 last:border-b-0'
      }
    >
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center justify-between text-left"
        aria-label={`Chọn nhóm ${formatPhone(group.phone)}`}
      >
        <span className="font-mono text-xs font-semibold">{formatPhone(group.phone)}</span>
        <span className="text-xs text-muted-foreground">{group.customers.length} hồ sơ</span>
      </button>
      <ul className="mt-1 flex flex-col gap-1">
        {group.customers.map((c) => {
          const checkboxId = `dup-${group.phone}-${c.id}`;
          return (
            <li key={c.id} className="flex items-start gap-2">
              <Checkbox
                id={checkboxId}
                className="mt-0.5"
                checked={selected.includes(c.id)}
                onCheckedChange={() => onToggle(c.id)}
                aria-label={`Chọn ${c.code}`}
              />
              <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer text-xs">
                <span className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-primary">{c.code}</span>
                  <span className="truncate font-medium">{c.name}</span>
                  {c.id === group.suggestedSurvivorId ? (
                    <StatusBadge tone="ok">Gợi ý giữ</StatusBadge>
                  ) : null}
                </span>
                <span className="block text-muted-foreground tabular-nums">
                  {c.orderCount} đơn · {formatMoney(c.revenue)} · {sourceLabel(c.source)} · tạo{' '}
                  {formatDate(c.createdAt)}
                  {c.owners.length > 0 ? ` · ${c.owners.map((o) => o.name).join(', ')}` : ''}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
