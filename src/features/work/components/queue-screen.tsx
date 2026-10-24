'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import { Inbox, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime, formatPhone, formatRelative } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState } from '@/lib/url-state';
import type { WorkItemSummary, WorkListQuery, WorkPriority } from '../api/types';
import {
  useBulkAssignWork,
  useWorkAction,
  useWorkAssignees,
  useWorkCategories,
  useWorkConfig,
  useWorkCounts,
  useWorkList,
} from '../api/use-work';
import { PRIORITIES, PRIORITY_LABEL } from '../labels';
import { PeoplePicker } from './work-dialogs';
import {
  DeadlineCell,
  KindTag,
  PersonText,
  PriorityText,
  WorkStatusBadge,
  WorkTabs,
} from './work-ui';

/**
 * Hàng chờ yêu cầu (C1 — docs/screens/FE-WORK-1-work-module.md §3): yêu cầu của khách + nội bộ gửi
 * tới phòng mình / phòng mình phụ trách (API lọc). URL: ?tab=mine|unassigned|team|soon|overdue|resolved|all
 * · ?source=CUSTOMER|INTERNAL · ?dept= · ?category= · ?priority= · ?q= · ?page=
 */
const FILTER_KEYS = ['tab', 'source', 'dept', 'category', 'priority'] as const;
type QFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };

function tabQuery(tab: string): Partial<WorkListQuery> {
  switch (tab) {
    case 'mine':
      return { assigneeId: 'me' };
    case 'unassigned':
      return { assigneeId: 'none', status: ['OPEN', 'IN_PROGRESS'] };
    case 'soon':
      return { due: 'soon' };
    case 'overdue':
      return { due: 'overdue' };
    case 'resolved':
      return { status: ['RESOLVED'] };
    case 'all':
      return { state: 'all' };
    default:
      return {};
  }
}

export function QueueScreen() {
  const router = useRouter();
  const { state, set, skipTake } = useListState<QFilter>(DEFAULTS);
  const tab = state.filters.tab ?? 'team';
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const counts = useWorkCounts();
  const config = useWorkConfig();
  const cats = useWorkCategories();
  const params = useMemo<WorkListQuery>(
    () => ({
      view: 'queue',
      ...tabQuery(tab),
      ...(state.filters.source ? { kind: [state.filters.source as 'CUSTOMER' | 'INTERNAL'] } : {}),
      ...(state.filters.dept ? { ownerDeptId: state.filters.dept } : {}),
      ...(state.filters.category ? { categoryId: state.filters.category } : {}),
      ...(state.filters.priority ? { priority: state.filters.priority as WorkPriority } : {}),
      ...(state.q ? { q: state.q } : {}),
      ...skipTake,
    }),
    [tab, state.filters, state.q, skipTake],
  );
  const query = useWorkList(params);
  const c = counts.data?.queue;
  useHotkey('F2', () => router.push('/work/new?kind=INTERNAL'));

  const ids = Object.keys(selected).filter((k) => selected[k]);
  const rows = query.data?.items ?? [];
  const chosen = rows.filter((r) => ids.includes(r.id));
  const depts = [...new Set(chosen.map((r) => r.ownerDeptId))];
  const filtered = !!(
    state.q ||
    state.filters.source ||
    state.filters.category ||
    state.filters.priority ||
    state.filters.dept
  );
  const columns = useMemo(() => buildColumns(), []);

  return (
    <>
      <PageHeader
        title="Hàng chờ yêu cầu"
        description={
          c
            ? `${c.open} yêu cầu đang mở · ${c.unassigned} chưa nhận · ${c.overdue} quá hạn — yêu cầu của khách và yêu cầu nội bộ gửi tới phòng bạn`
            : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Công việc', href: '/work' }, { label: 'Hàng chờ yêu cầu' }]}
        actions={
          <Can I="create" a="Work">
            <Button variant="outline" asChild>
              <Link href="/reports/work">Báo cáo SLA</Link>
            </Button>
            <Button asChild shortcut="F2">
              <Link href="/work/new?kind=INTERNAL">
                <Plus aria-hidden /> Tạo yêu cầu
              </Link>
            </Button>
          </Can>
        }
      />
      <section className="rounded-lg border bg-card" aria-label="Danh sách yêu cầu">
        <WorkTabs
          label="Hàng chờ"
          value={tab}
          onChange={(k) => {
            setSelected({});
            set({ filters: { ...state.filters, tab: k === 'team' ? undefined : k } });
          }}
          tabs={[
            { key: 'mine', label: 'Của tôi' },
            { key: 'unassigned', label: 'Chưa nhận', count: c?.unassigned, tone: 'brand' },
            { key: 'team', label: 'Đang mở', count: c?.open },
            { key: 'soon', label: 'Sắp quá hạn', count: c?.dueSoon, tone: 'warn' },
            { key: 'overdue', label: 'Quá hạn', count: c?.overdue, tone: 'danger' },
            { key: 'resolved', label: 'Đã xử lý · chờ đóng' },
            { key: 'all', label: 'Tất cả' },
          ]}
        />
        {ids.length ? (
          <BulkActionBar count={ids.length} noun="yêu cầu" onClear={() => setSelected({})}>
            <Button size="sm" onClick={() => setAssignOpen(true)} disabled={depts.length !== 1}>
              Giao cho…
            </Button>
            <BulkPriority ids={ids} onDone={() => setSelected({})} />
            {depts.length !== 1 ? (
              <span className="text-xs text-muted-foreground">
                Chọn yêu cầu cùng một phòng nhận để giao.
              </span>
            ) : null}
          </BulkActionBar>
        ) : (
          <div className="px-3 pt-3">
            <FilterBar<QFilter>
              q={state.q}
              onQChange={(q) => set({ q })}
              values={state.filters}
              onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
              searchPlaceholder="Mã yêu cầu, SĐT, tên khách, tiêu đề"
              filters={[
                {
                  key: 'source',
                  label: 'Nguồn',
                  type: 'select',
                  options: [
                    { value: 'CUSTOMER', label: 'Của khách' },
                    { value: 'INTERNAL', label: 'Nội bộ' },
                  ],
                },
                {
                  key: 'dept',
                  label: 'Phòng nhận',
                  type: 'select',
                  searchable: true,
                  options: (config.data?.departments ?? []).map((d) => ({
                    value: d.id,
                    label: d.name,
                  })),
                },
                {
                  key: 'category',
                  label: 'Loại',
                  type: 'select',
                  searchable: true,
                  options: (cats.data ?? []).map((x) => ({ value: x.id, label: x.name })),
                },
                {
                  key: 'priority',
                  label: 'Ưu tiên',
                  type: 'select',
                  options: [...PRIORITIES]
                    .reverse()
                    .map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
                },
              ]}
            />
          </div>
        )}
        <div className="px-3 pb-3 pt-2">
          <QueryState
            query={query}
            skeleton={<ListSkeleton rows={12} columns={9} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                icon={Inbox}
                title={
                  filtered
                    ? 'Không có yêu cầu khớp'
                    : tab === 'overdue'
                      ? 'Không có yêu cầu quá hạn'
                      : tab === 'unassigned'
                        ? 'Không còn yêu cầu chưa nhận'
                        : 'Hàng chờ đang trống'
                }
                description={
                  filtered
                    ? 'Thử bỏ bớt điều kiện lọc hoặc đổi tab.'
                    : tab === 'overdue'
                      ? 'Phòng đang đúng hạn. Xử lý trước các yêu cầu sắp quá hạn.'
                      : 'Yêu cầu gửi tới phòng bạn sẽ hiện ở đây.'
                }
                action={
                  filtered ? (
                    <Button
                      variant="outline"
                      onClick={() => set({ q: '', filters: { tab: state.filters.tab } })}
                    >
                      Xóa lọc
                    </Button>
                  ) : tab === 'overdue' ? (
                    <Button
                      variant="outline"
                      onClick={() => set({ filters: { ...state.filters, tab: 'soon' } })}
                    >
                      Xem Sắp quá hạn
                    </Button>
                  ) : null
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
                selection={{ selected, onChange: setSelected }}
                onPageChange={(page) => set({ page })}
                onSizeChange={(size) => set({ size })}
                onSortChange={() => undefined}
              />
            )}
          </QueryState>
        </div>
      </section>
      <BulkAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        ids={ids}
        deptId={depts.length === 1 ? (depts[0] ?? undefined) : undefined}
        onDone={() => setSelected({})}
      />
    </>
  );
}

function BulkPriority({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const bulk = useBulkAssignWork();
  return (
    <Select
      value=""
      onValueChange={(v) =>
        bulk.mutate(
          { ids, priority: v as WorkPriority },
          {
            onSuccess: (r) => {
              toast.success(`Đã đổi ưu tiên ${r.updated} yêu cầu`);
              onDone();
            },
            onError: (e) => toast.error(messageFor(e)),
          },
        )
      }
    >
      <SelectTrigger className="h-button-sm w-36" aria-label="Đổi ưu tiên">
        <SelectValue placeholder="Đổi ưu tiên" />
      </SelectTrigger>
      <SelectContent>
        {[...PRIORITIES].reverse().map((p) => (
          <SelectItem key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BulkAssignDialog({
  open,
  onOpenChange,
  ids,
  deptId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  deptId?: string;
  onDone: () => void;
}) {
  const people = useWorkAssignees(deptId, open && !!deptId);
  const bulk = useBulkAssignWork();
  const [assigneeId, setAssigneeId] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !bulk.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giao {ids.length} yêu cầu</DialogTitle>
          <DialogDescription>
            Người xử lý thuộc phòng nhận. Yêu cầu không giao được sẽ báo lại từng mã.
          </DialogDescription>
        </DialogHeader>
        <PeoplePicker
          loading={people.isLoading}
          people={people.data ?? []}
          value={assigneeId}
          onChange={setAssigneeId}
        />
        <DialogFooter>
          <Button variant="outline" disabled={bulk.isPending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            loading={bulk.isPending}
            disabled={!assigneeId}
            onClick={() =>
              bulk.mutate(
                { ids, assigneeId },
                {
                  onSuccess: (r) => {
                    if (r.failed.length) {
                      toast.error(
                        `Đã giao ${r.updated}; ${r.failed.length} yêu cầu không giao được (${r.failed.map((f) => f.docNumber ?? f.id).join(', ')}).`,
                      );
                    } else toast.success(`Đã giao ${r.updated} yêu cầu`);
                    onOpenChange(false);
                    setAssigneeId('');
                    onDone();
                  },
                  onError: (e) => toast.error(messageFor(e)),
                },
              )
            }
          >
            Giao {ids.length} yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimButton({ w }: { w: WorkItemSummary }) {
  const action = useWorkAction(w.id);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={action.isPending}
      onClick={() =>
        action.mutate(
          { action: 'claim', body: { version: w.version } },
          {
            onSuccess: () => toast.success(`Đã nhận ${w.docNumber}`),
            onError: (e) => toast.error(messageFor(e)),
          },
        )
      }
    >
      Nhận
    </Button>
  );
}

function buildColumns(): ColumnDef<WorkItemSummary, unknown>[] {
  return [
    {
      id: 'doc',
      header: 'Mã',
      meta: { width: 120 },
      cell: ({ row }) => (
        <Link
          href={`/work/${row.original.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.original.docNumber}
        </Link>
      ),
    },
    {
      id: 'who',
      header: 'Khách / người yêu cầu',
      meta: { width: 180 },
      cell: ({ row }) => {
        const w = row.original;
        if (w.kind === 'INTERNAL' && !w.customer) {
          return (
            <div className="min-w-0">
              <PersonText p={w.requester} />
              <div className="text-xs text-muted-foreground">Nội bộ</div>
            </div>
          );
        }
        return (
          <div className="min-w-0">
            <span className="block truncate">{w.customer?.name ?? w.contactName ?? '—'}</span>
            <span className="text-xs text-muted-foreground">
              {formatPhone(w.customer?.phone ?? w.contactPhone)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'title',
      header: 'Yêu cầu',
      meta: { width: 320 },
      cell: ({ row }) => {
        const w = row.original;
        return (
          <div className="min-w-0">
            <Link href={`/work/${w.id}`} className="line-clamp-1 hover:underline">
              {w.title}
            </Link>
            <KindTag w={w}>
              {w.categoryName ? ` · ${w.categoryName}` : ''}
              {w.orderDocNumber ? ` · Đơn ${w.orderDocNumber}` : ''}
              {w.ownerDeptName ? ` · ${w.ownerDeptName}` : ''}
            </KindTag>
          </div>
        );
      },
    },
    {
      id: 'priority',
      header: 'Ưu tiên',
      meta: { width: 80 },
      cell: ({ row }) => <PriorityText p={row.original.priority} />,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: 120 },
      cell: ({ row }) => <WorkStatusBadge w={row.original} />,
    },
    {
      id: 'assignee',
      header: 'Người xử lý',
      meta: { width: 150 },
      cell: ({ row }) => {
        const w = row.original;
        if (w.assignee) return <PersonText p={w.assignee} />;
        return w.status === 'OPEN' || w.status === 'IN_PROGRESS' ? (
          <ClaimButton w={w} />
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'sla',
      header: 'SLA',
      meta: { width: 160 },
      cell: ({ row }) => <DeadlineCell w={row.original} />,
    },
    {
      id: 'updated',
      header: 'Cập nhật',
      meta: { width: 100 },
      cell: ({ row }) => (
        <span className="text-muted-foreground" title={formatDateTime(row.original.updatedAt)}>
          {formatRelative(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { width: 56 },
      cell: ({ row }) => (
        <RowActions
          primary={undefined}
          items={[
            { label: 'Mở chi tiết', href: `/work/${row.original.id}` },
            ...(row.original.kind === 'CUSTOMER'
              ? [
                  {
                    label: 'Nhờ phòng khác',
                    href: `/work/new?kind=INTERNAL&parentId=${row.original.id}`,
                  },
                ]
              : []),
          ]}
          itemName={`yêu cầu ${row.original.docNumber}`}
        />
      ),
    },
  ];
}
