'use client';

import type { RowSelectionState } from '@tanstack/react-table';
import { ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState } from '@/lib/url-state';
import type { WorkItemSummary, WorkListQuery, WorkWorkloadRow } from '../api/types';
import { useWorkAction, useWorkCounts, useWorkList, useWorkWorkload } from '../api/use-work';
import { KIND_LABEL } from '../labels';
import { ReassignDialog } from './work-dialogs';
import {
  Card,
  ChecklistProgress,
  DeadlineCell,
  KindTag,
  PersonText,
  WorkStatusBadge,
  WorkTabs,
} from './work-ui';

/**
 * Việc của team (B1 — docs/screens/FE-WORK-1-work-module.md §2): trưởng phòng / cấp trên theo dõi
 * việc của nhánh mình phụ trách (API lọc theo cây phòng ban). URL: ?tab=all|mine|overdue|recurring|done
 * · ?dept= (phạm vi khối lượng) · ?q= · ?kind= · ?page=
 */
const FILTER_KEYS = ['tab', 'dept', 'kind'] as const;
type TFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 25, sort: null, filterKeys: FILTER_KEYS };

function tabQuery(tab: string): Partial<WorkListQuery> {
  switch (tab) {
    case 'mine':
      return { assignerId: 'me', kind: ['TASK'] };
    case 'overdue':
      return { due: 'overdue' };
    case 'done':
      return { state: 'closed' };
    default:
      return {};
  }
}

export function TeamWorkScreen() {
  const router = useRouter();
  const { state, set, skipTake } = useListState<TFilter>(DEFAULTS);
  const tab = state.filters.tab ?? 'all';
  const deptId = state.filters.dept;
  const counts = useWorkCounts();
  const workload = useWorkWorkload(deptId);
  const approvals = useWorkList({
    view: 'team',
    kind: ['TASK'],
    status: ['SUBMITTED'],
    take: 20,
    skip: 0,
  });
  const extensions = useWorkList({
    view: 'team',
    kind: ['TASK'],
    pendingExtension: 'true',
    take: 20,
    skip: 0,
  });
  const params = useMemo<WorkListQuery>(
    () => ({
      view: 'team',
      ...tabQuery(tab),
      ...(state.filters.kind ? { kind: [state.filters.kind as WorkItemSummary['kind']] } : {}),
      ...(state.q ? { q: state.q } : {}),
      ...skipTake,
    }),
    [tab, state.filters.kind, state.q, skipTake],
  );
  const list = useWorkList(params);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [reassign, setReassign] = useState<string[] | null>(null);
  useHotkey('F2', () => router.push('/work/new'));

  const t = counts.data?.team;
  const ids = Object.keys(selected).filter((k) => selected[k]);
  const rows = list.data?.items ?? [];
  const tasksSelected = rows
    .filter((r) => ids.includes(r.id) && r.kind === 'TASK')
    .map((r) => r.id);
  const wl = workload.data;
  const columns = useMemo(() => buildColumns(), []);

  return (
    <>
      <PageHeader
        title="Việc của team"
        description={
          wl
            ? `${wl.departments.map((d) => d.name).join(', ') || 'Phòng bạn phụ trách'} · ${wl.rows.length} người · gồm việc được giao và yêu cầu đang xử lý`
            : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Công việc', href: '/work' }, { label: 'Việc của team' }]}
        actions={
          <>
            {wl && wl.departments.length > 1 ? (
              <Select
                value={deptId ?? 'all'}
                onValueChange={(v) =>
                  set({ filters: { ...state.filters, dept: v === 'all' ? undefined : v } })
                }
              >
                <SelectTrigger className="w-64" aria-label="Phạm vi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Phạm vi: cả nhánh phụ trách</SelectItem>
                  {wl.departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Phạm vi: {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button asChild shortcut="F2">
              <Link href="/work/new">
                <Plus aria-hidden /> Giao việc
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi
            label="Đang mở"
            value={t?.open}
            sub={wl ? `${wl.unassigned} yêu cầu chưa ai nhận` : undefined}
          />
          <Kpi
            label="Quá hạn"
            value={t?.overdue}
            tone="danger"
            onClick={() => set({ filters: { ...state.filters, tab: 'overdue' } })}
          />
          <Kpi label="Đến hạn hôm nay" value={t?.dueToday} />
          <Kpi label="Chờ tôi duyệt" value={t?.awaitingMyApproval} />
          <Kpi label="Xin gia hạn" value={t?.extensionRequests} tone="warn" />
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Card title={`Chờ tôi duyệt kết quả · ${approvals.data?.total ?? 0}`}>
            <PendingList
              loading={approvals.isLoading}
              rows={approvals.data?.items ?? []}
              empty="Không có việc nào chờ bạn duyệt."
              render={(w) => <ApproveActions w={w} />}
              sub={(w) =>
                `${w.assignee?.fullName ?? ''} · báo xong ${w.submittedAt ? formatDateTime(w.submittedAt) : ''} · ${w.checklistDone}/${w.checklistTotal}`
              }
            />
          </Card>
          <Card title={`Xin gia hạn · ${extensions.data?.total ?? 0}`}>
            <PendingList
              loading={extensions.isLoading}
              rows={extensions.data?.items ?? []}
              empty="Không có đề nghị gia hạn."
              render={(w) => <ExtensionActions w={w} />}
              sub={(w) =>
                `${w.assignee?.fullName ?? ''} · ${w.dueAt ? formatDateTime(w.dueAt) : '—'} → ${w.pendingDueAt ? formatDateTime(w.pendingDueAt) : '—'}${w.pendingDueReason ? ` · “${w.pendingDueReason}”` : ''}`
              }
            />
          </Card>
        </div>

        <Card
          title="Khối lượng theo người"
          action={
            <span className="text-xs font-normal text-muted-foreground">↓ = dưới mục tiêu 90%</span>
          }
        >
          <QueryState
            query={workload}
            skeleton={<ListSkeleton rows={6} columns={8} />}
            isEmpty={(d) => d.rows.length === 0}
            empty={
              <EmptyState
                icon={ClipboardCheck}
                title="Bạn chưa phụ trách phòng nào có nhân sự"
                description="Trưởng phòng / cấp trên thấy khối lượng việc của nhân sự trong nhánh mình ở đây."
              />
            }
          >
            {(d) => (
              <WorkloadTable
                rows={d.rows}
                onAssign={(id) => router.push(`/work/new?assignee=${id}`)}
              />
            )}
          </QueryState>
        </Card>

        <section className="rounded-lg border bg-card" aria-label="Việc đã giao">
          <WorkTabs
            label="Việc của team"
            value={tab}
            onChange={(k) => {
              setSelected({});
              set({ filters: { ...state.filters, tab: k === 'all' ? undefined : k } });
            }}
            tabs={[
              { key: 'all', label: 'Đang mở', count: t?.open },
              { key: 'mine', label: 'Tôi giao' },
              { key: 'overdue', label: 'Quá hạn', count: t?.overdue, tone: 'danger' },
              { key: 'done', label: 'Đã xong' },
            ]}
          />
          {ids.length ? (
            <BulkActionBar
              count={ids.length}
              noun="việc"
              onClear={() => setSelected({})}
              note={
                tasksSelected.length < ids.length
                  ? 'Chỉ chuyển được việc được giao — yêu cầu dùng "Giao lại" ở hàng chờ.'
                  : undefined
              }
            >
              <Button
                size="sm"
                disabled={!tasksSelected.length}
                onClick={() => setReassign(tasksSelected)}
              >
                Chuyển {tasksSelected.length} việc
              </Button>
            </BulkActionBar>
          ) : (
            <div className="px-3 pt-3">
              <FilterBar<TFilter>
                q={state.q}
                onQChange={(q) => set({ q })}
                values={state.filters}
                onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
                searchPlaceholder="Tìm việc, mã"
                filters={[
                  {
                    key: 'kind',
                    label: 'Loại',
                    type: 'select',
                    options: (['TASK', 'CUSTOMER', 'INTERNAL'] as const).map((k) => ({
                      value: k,
                      label: KIND_LABEL[k],
                    })),
                  },
                ]}
              />
            </div>
          )}
          <div className="px-3 pb-3 pt-2">
            <QueryState
              query={list}
              skeleton={<ListSkeleton rows={8} columns={6} />}
              isEmpty={(d) => d.items.length === 0}
              empty={
                <EmptyState
                  icon={ClipboardCheck}
                  title={tab === 'overdue' ? 'Không có việc quá hạn' : 'Chưa có việc nào'}
                  description="Việc bạn giao và việc của nhân sự trong nhánh bạn phụ trách hiện ở đây."
                  action={
                    <Button variant="outline" asChild>
                      <Link href="/work/new">Giao việc</Link>
                    </Button>
                  }
                />
              }
            >
              {(d) => (
                <DataTable
                  columns={columns}
                  rows={d.items}
                  getRowId={(r) => r.id}
                  total={d.total}
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
      </div>

      <ReassignDialog
        ids={reassign ?? []}
        title={`Chuyển ${reassign?.length ?? 0} việc`}
        open={!!reassign}
        onOpenChange={(o) => !o && setReassign(null)}
        onDone={() => setSelected({})}
      />
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value?: number;
  sub?: string;
  tone?: 'danger' | 'warn';
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'danger' && value
            ? 'text-destructive'
            : tone === 'warn' && value
              ? 'text-warning'
              : undefined,
        )}
      >
        {value ?? '–'}
      </span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3 text-left hover:bg-muted"
    >
      {body}
    </button>
  ) : (
    <section className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3">{body}</section>
  );
}

function PendingList({
  rows,
  loading,
  empty,
  render,
  sub,
}: {
  rows: WorkItemSummary[];
  loading: boolean;
  empty: string;
  render: (w: WorkItemSummary) => React.ReactNode;
  sub: (w: WorkItemSummary) => string;
}) {
  if (loading) return <p className="p-3.5 text-sm text-muted-foreground">Đang tải…</p>;
  if (!rows.length) return <p className="p-3.5 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul>
      {rows.map((w) => (
        <li
          key={w.id}
          className="flex flex-wrap items-center gap-2 border-t px-3.5 py-2 text-sm first:border-t-0"
        >
          <div className="min-w-0 flex-1">
            <Link href={`/work/${w.id}`} className="line-clamp-1 hover:underline">
              {w.title}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              <span className="font-mono">{w.docNumber}</span> · {sub(w)}
            </span>
          </div>
          {render(w)}
        </li>
      ))}
    </ul>
  );
}

function ApproveActions({ w }: { w: WorkItemSummary }) {
  const action = useWorkAction(w.id);
  return (
    <span className="flex gap-1.5">
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/work/${w.id}`}>Làm lại</Link>
      </Button>
      <Button
        size="sm"
        loading={action.isPending}
        onClick={() =>
          action.mutate(
            { action: 'approve', body: { version: w.version } },
            {
              onSuccess: () => toast.success(`Đã duyệt ${w.docNumber}`),
              onError: (e) => toast.error(messageFor(e)),
            },
          )
        }
      >
        Duyệt
      </Button>
    </span>
  );
}

function ExtensionActions({ w }: { w: WorkItemSummary }) {
  const action = useWorkAction(w.id);
  const decide = (approve: boolean) =>
    action.mutate(
      { action: 'extension/decision', body: { approve, version: w.version } },
      {
        onSuccess: () =>
          toast.success(
            approve ? `Đã đồng ý gia hạn ${w.docNumber}` : `Đã từ chối gia hạn ${w.docNumber}`,
          ),
        onError: (e) => toast.error(messageFor(e)),
      },
    );
  return (
    <span className="flex gap-1.5">
      <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => decide(false)}>
        Từ chối
      </Button>
      <Button size="sm" loading={action.isPending} onClick={() => decide(true)}>
        Đồng ý
      </Button>
    </span>
  );
}

function WorkloadTable({
  rows,
  onAssign,
}: {
  rows: WorkWorkloadRow[];
  onAssign: (userId: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-semibold">Nhân viên</th>
            <th className="px-3 py-2 text-left font-semibold">Phòng</th>
            <th className="px-3 py-2 text-left font-semibold">Đang làm</th>
            <th className="px-3 py-2 text-right font-semibold">Quá hạn</th>
            <th className="px-3 py-2 text-right font-semibold">Hạn hôm nay</th>
            <th className="px-3 py-2 text-right font-semibold">Chờ duyệt</th>
            <th className="px-3 py-2 text-right font-semibold">Xong 7 ngày</th>
            <th className="px-3 py-2 text-right font-semibold">Đúng hạn 30 ngày</th>
            <th className="px-3 py-2">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const below = r.onTimePercent30d !== null && r.onTimePercent30d < 90;
            return (
              <tr key={r.user.id} className="border-t hover:bg-table-row-hover">
                <td className="px-3 py-2">
                  {r.user.fullName}
                  {r.isManager ? (
                    <span className="block text-xs text-muted-foreground">Trưởng phòng</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.departmentName ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((r.open / max) * 100)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{r.open}</span>
                  </span>
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    r.overdue && 'font-semibold text-destructive',
                  )}
                >
                  {r.overdue}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dueToday}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.submitted}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.done7d}</td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    below && 'font-semibold text-warning',
                  )}
                >
                  {r.onTimePercent30d === null ? '—' : `${below ? '↓ ' : ''}${r.onTimePercent30d}%`}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onAssign(r.user.id)}>
                    Giao việc
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildColumns(): ColumnDef<WorkItemSummary, unknown>[] {
  return [
    {
      id: 'title',
      header: 'Việc',
      meta: { width: 340 },
      cell: ({ row }) => {
        const w = row.original;
        return (
          <div className="min-w-0">
            <Link href={`/work/${w.id}`} className="line-clamp-1 hover:underline">
              {w.title}
            </Link>
            <KindTag w={w}>
              {' · '}
              <span className="font-mono">{w.docNumber}</span>
            </KindTag>
          </div>
        );
      },
    },
    {
      id: 'assignee',
      header: 'Người làm',
      meta: { width: 150 },
      cell: ({ row }) => <PersonText p={row.original.assignee} empty="Chưa ai nhận" />,
    },
    {
      id: 'assigner',
      header: 'Người giao',
      meta: { width: 150 },
      cell: ({ row }) =>
        row.original.kind === 'TASK' ? (
          <PersonText p={row.original.assigner} />
        ) : (
          <span className="text-muted-foreground">{row.original.ownerDeptName ?? '—'}</span>
        ),
    },
    {
      id: 'deadline',
      header: 'Hạn',
      meta: { width: 160 },
      cell: ({ row }) => <DeadlineCell w={row.original} />,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: 120 },
      cell: ({ row }) => <WorkStatusBadge w={row.original} />,
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      meta: { width: 110 },
      cell: ({ row }) => (
        <ChecklistProgress done={row.original.checklistDone} total={row.original.checklistTotal} />
      ),
    },
  ];
}
