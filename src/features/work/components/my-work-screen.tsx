'use client';

import { Building2, Check, ListTodo, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DataTable, FilterBar, type ColumnDef } from '@/components/data/data-table';
import { shiftDay } from '@/components/data/date-range-picker';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { messageFor } from '@/lib/error-messages';
import { toLocalDateKey } from '@/lib/format';
import { Can } from '@/lib/permission';
import { useHotkey } from '@/lib/use-hotkey';
import { useListState } from '@/lib/url-state';
import type { WorkItemSummary, WorkListQuery, WorkView } from '../api/types';
import { useCreateWork, useWorkAction, useWorkCounts, useWorkList } from '../api/use-work';
import { KIND_LABEL, PRIORITY_LABEL } from '../labels';
import {
  ChecklistProgress,
  DeadlineCell,
  KindTag,
  MainAside,
  PersonText,
  PriorityText,
  WorkStatusBadge,
  WorkTabs,
} from './work-ui';

/**
 * Việc của tôi (A1 — docs/screens/FE-WORK-1-work-module.md §1). Một danh sách gộp yêu cầu khách,
 * yêu cầu nội bộ và việc được giao; mặc định sắp theo hạn đang chạy (API). URL (luật 8):
 * ?tab=mine|requested|watching|done · ?q= · ?kind= · ?priority= · ?page=
 */
const FILTER_KEYS = ['tab', 'kind', 'priority'] as const;
type MyFilter = (typeof FILTER_KEYS)[number];
const DEFAULTS = { size: 50, sort: null, filterKeys: FILTER_KEYS };

const TAB_VIEW: Record<string, WorkView> = {
  mine: 'mine',
  requested: 'requested',
  watching: 'watching',
  done: 'done',
};

type QuickDue = 'today' | 'tomorrow' | 'none';

function quickDueIso(due: QuickDue): string | undefined {
  const today = toLocalDateKey(new Date()) ?? '';
  if (due === 'none' || !today) return undefined;
  const day = due === 'today' ? today : shiftDay(today, 1);
  return new Date(`${day}T17:30:00+07:00`).toISOString();
}

export function MyWorkScreen() {
  const router = useRouter();
  const { state, set, skipTake } = useListState<MyFilter>(DEFAULTS);
  const tab = state.filters.tab && TAB_VIEW[state.filters.tab] ? state.filters.tab : 'mine';
  const params = useMemo<WorkListQuery>(
    () => ({
      view: TAB_VIEW[tab]!,
      ...(state.q ? { q: state.q } : {}),
      ...(state.filters.kind ? { kind: [state.filters.kind as WorkItemSummary['kind']] } : {}),
      ...(state.filters.priority
        ? { priority: state.filters.priority as WorkItemSummary['priority'] }
        : {}),
      ...skipTake,
    }),
    [tab, state.q, state.filters.kind, state.filters.priority, skipTake],
  );
  const query = useWorkList(params);
  const counts = useWorkCounts();
  const requested = useWorkList({ view: 'requested', take: 3, skip: 0, sort: 'updated' });
  const c = counts.data;

  useHotkey('F2', () => router.push('/work/new'));

  const filtered = state.q !== '' || !!state.filters.kind || !!state.filters.priority;
  const columns = useMemo(() => buildColumns(tab === 'mine'), [tab]);

  return (
    <>
      <PageHeader
        title="Việc của tôi"
        description={
          c
            ? `${c.mine.open} việc đang mở · ${c.mine.overdue} quá hạn · ${c.mine.dueToday} đến hạn hôm nay — gồm yêu cầu khách, yêu cầu nội bộ và việc được giao`
            : 'Đang tải…'
        }
        breadcrumb={[{ label: 'Công việc' }, { label: 'Việc của tôi' }]}
        actions={
          <Can I="create" a="Work">
            <Button variant="outline" asChild>
              <Link href="/work/new?kind=INTERNAL">
                <Building2 aria-hidden />
                Yêu cầu nội bộ
              </Link>
            </Button>
            <Button asChild shortcut="F2">
              <Link href="/work/new">
                <Plus aria-hidden />
                Tạo việc
              </Link>
            </Button>
          </Can>
        }
      />

      <MainAside
        asideLabel="Tóm tắt"
        main={
          <section className="min-w-0 rounded-lg border bg-card" aria-label="Danh sách việc">
            <WorkTabs
              label="Nhóm việc"
              value={tab}
              onChange={(k) =>
                set({ filters: { ...state.filters, tab: k === 'mine' ? undefined : k } })
              }
              tabs={[
                { key: 'mine', label: 'Giao cho tôi', count: c?.mine.open },
                { key: 'requested', label: 'Tôi yêu cầu', count: c?.requested.open },
                { key: 'watching', label: 'Tôi theo dõi', count: c?.watching.open },
                { key: 'done', label: 'Đã xong' },
              ]}
            />
            <div className="p-3">
              {tab === 'mine' ? <QuickAdd /> : null}
              <FilterBar<MyFilter>
                q={state.q}
                onQChange={(q) => set({ q })}
                values={state.filters}
                onFilterChange={(patch) => set({ filters: { ...state.filters, ...patch } })}
                searchPlaceholder="Tìm việc, mã, khách"
                filters={[
                  {
                    key: 'kind',
                    label: 'Loại',
                    type: 'select',
                    options: (['CUSTOMER', 'INTERNAL', 'TASK'] as const).map((k) => ({
                      value: k,
                      label: KIND_LABEL[k],
                    })),
                  },
                  {
                    key: 'priority',
                    label: 'Ưu tiên',
                    type: 'select',
                    options: (['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((p) => ({
                      value: p,
                      label: PRIORITY_LABEL[p],
                    })),
                  },
                ]}
              />
              <QueryState
                query={query}
                skeleton={<ListSkeleton rows={10} columns={6} />}
                isEmpty={(d) => d.items.length === 0}
                empty={
                  <EmptyState
                    icon={ListTodo}
                    title={
                      filtered
                        ? 'Không có việc khớp'
                        : tab === 'mine'
                          ? 'Bạn chưa có việc nào đang mở'
                          : tab === 'requested'
                            ? 'Bạn chưa gửi yêu cầu nào đang mở'
                            : tab === 'watching'
                              ? 'Bạn chưa theo dõi việc nào'
                              : 'Chưa có việc đã xong'
                    }
                    description={
                      filtered
                        ? 'Thử bỏ bớt điều kiện lọc.'
                        : 'Việc người khác giao, yêu cầu bạn nhận và việc tự tạo hiện ở đây.'
                    }
                    action={
                      filtered ? (
                        <Button
                          variant="outline"
                          onClick={() => set({ q: '', filters: { tab: state.filters.tab } })}
                        >
                          Xóa lọc
                        </Button>
                      ) : (
                        <Can I="create" a="Work">
                          <Button variant="outline" asChild>
                            <Link href="/work/new">Tạo việc</Link>
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
                    sort={null}
                    onPageChange={(page) => set({ page })}
                    onSizeChange={(size) => set({ size })}
                    onSortChange={() => undefined}
                  />
                )}
              </QueryState>
            </div>
          </section>
        }
        aside={
          <>
            <section className="rounded-lg border bg-card">
              <h2 className="flex min-h-card-header items-center border-b px-3.5 text-sm font-semibold">
                Hôm nay của tôi
              </h2>
              <div className="grid grid-cols-2 gap-2 p-3.5">
                <Stat label="Quá hạn" value={c?.mine.overdue} tone="danger" />
                <Stat label="Đến hạn hôm nay" value={c?.mine.dueToday} />
                <Stat label="Xong hôm nay" value={c?.mine.doneToday} tone="ok" />
                <Stat label="Chờ người giao duyệt" value={c?.mine.submitted} />
              </div>
            </section>
            <section className="rounded-lg border bg-card">
              <h2 className="flex min-h-card-header items-center justify-between border-b px-3.5 text-sm font-semibold">
                Tôi đang chờ người khác
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline"
                  onClick={() => set({ filters: { tab: 'requested' } })}
                >
                  Xem {c?.requested.open ?? ''}
                </button>
              </h2>
              {requested.data?.items.length ? (
                <ul>
                  {requested.data.items.map((w) => (
                    <WaitingRow key={w.id} w={w} />
                  ))}
                </ul>
              ) : (
                <p className="px-3.5 py-3 text-sm text-muted-foreground">
                  {requested.isLoading ? 'Đang tải…' : 'Không có yêu cầu nào bạn đang chờ.'}
                </p>
              )}
            </section>
            <Can I="create" a="Work">
              <section className="rounded-lg border bg-card">
                <h2 className="flex min-h-card-header items-center border-b px-3.5 text-sm font-semibold">
                  Nhờ phòng khác
                </h2>
                <div className="p-3.5">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Kho, kế toán, mua hàng, quản trị… nhận vào hàng chờ của phòng đó và tính SLA.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/work/new?kind=INTERNAL">Gửi yêu cầu nội bộ</Link>
                  </Button>
                </div>
              </section>
            </Can>
          </>
        }
      />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: 'danger' | 'ok' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <b
        className={
          tone === 'danger' && value
            ? 'text-xl text-destructive'
            : tone === 'ok' && value
              ? 'text-xl text-success'
              : 'text-xl'
        }
      >
        {value ?? '–'}
      </b>
    </div>
  );
}

function WaitingRow({ w }: { w: WorkItemSummary }) {
  const action = useWorkAction(w.id);
  const awaitingMe = w.kind === 'INTERNAL' && w.status === 'RESOLVED';
  return (
    <li className="flex flex-col gap-1 border-t px-3.5 py-2.5 text-sm first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/work/${w.id}`} className="font-mono text-xs text-primary hover:underline">
          {w.docNumber}
        </Link>
        <WorkStatusBadge w={w} />
      </div>
      <span className="line-clamp-2">
        {w.ownerDeptName ? `${w.ownerDeptName} · ` : ''}
        {w.title}
      </span>
      {awaitingMe ? (
        <>
          <span className="text-xs text-muted-foreground">
            Bên nhận báo đã xong — bạn xác nhận giúp
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              loading={action.isPending}
              onClick={() =>
                action.mutate(
                  { action: 'confirm', body: { version: w.version } },
                  {
                    onSuccess: () => toast.success(`Đã xác nhận xong ${w.docNumber}`),
                    onError: (e) => toast.error(messageFor(e)),
                  },
                )
              }
            >
              Đã xong
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/work/${w.id}`}>Chưa xong</Link>
            </Button>
          </div>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          {w.assignee ? w.assignee.fullName : 'Chưa ai nhận'}
        </span>
      )}
    </li>
  );
}

/** Ô "Thêm việc cho mình — gõ rồi Enter" (giao việc tự giao, Idempotency-Key sinh lúc Enter). */
function QuickAdd() {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<QuickDue>('today');
  const [key, setKey] = useState<string | null>(null);
  const create = useCreateWork();

  const submit = () => {
    const t = title.trim();
    if (!t || create.isPending) return;
    const k = key ?? newIdempotencyKey();
    setKey(k);
    const dueAt = quickDueIso(due);
    create.mutate(
      { body: { kind: 'TASK', title: t, ...(dueAt ? { dueAt } : {}) }, key: k },
      {
        onSuccess: () => {
          toast.success('Đã thêm việc');
          setTitle('');
          setKey(null);
        },
        onError: (e) => toast.error(messageFor(e)),
      },
    );
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
      <Plus aria-hidden className="h-4 w-4 text-muted-foreground" />
      <Input
        aria-label="Thêm việc cho mình"
        placeholder="Thêm việc cho mình — gõ rồi Enter"
        className="min-w-0 flex-1 border-transparent shadow-none focus-visible:border-input"
        value={title}
        maxLength={200}
        onChange={(e) => {
          setTitle(e.target.value);
          setKey(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Select value={due} onValueChange={(v) => setDue(v as QuickDue)}>
        <SelectTrigger className="w-40" aria-label="Hạn">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hạn: hôm nay 17:30</SelectItem>
          <SelectItem value="tomorrow">Hạn: ngày mai 17:30</SelectItem>
          <SelectItem value="none">Không có hạn</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={submit} loading={create.isPending} disabled={!title.trim()}>
        Thêm
      </Button>
    </div>
  );
}

function DoneButton({ w }: { w: WorkItemSummary }) {
  const action = useWorkAction(w.id);
  return (
    <button
      type="button"
      aria-label={`Báo xong ${w.docNumber}`}
      title="Báo xong"
      disabled={action.isPending}
      onClick={() =>
        action.mutate(
          { action: 'submit', body: { version: w.version } },
          {
            onSuccess: (d) =>
              toast.success(
                d.status === 'SUBMITTED'
                  ? `Đã báo xong ${w.docNumber} — chờ người giao duyệt`
                  : `Đã xong ${w.docNumber}`,
              ),
            onError: (e) => toast.error(messageFor(e)),
          },
        )
      }
      className="flex h-5 w-5 items-center justify-center rounded-full border border-input text-transparent hover:border-success hover:text-success focus-visible:text-success"
    >
      <Check aria-hidden className="h-3.5 w-3.5" />
    </button>
  );
}

function buildColumns(mine: boolean): ColumnDef<WorkItemSummary, unknown>[] {
  return [
    {
      id: 'done',
      header: '',
      meta: { width: 40 },
      cell: ({ row }) => {
        const w = row.original;
        return mine && w.kind === 'TASK' && (w.status === 'OPEN' || w.status === 'IN_PROGRESS') ? (
          <DoneButton w={w} />
        ) : null;
      },
    },
    {
      id: 'title',
      header: 'Việc',
      meta: { width: 360 },
      cell: ({ row }) => {
        const w = row.original;
        return (
          <div className="min-w-0">
            <Link href={`/work/${w.id}`} className="line-clamp-2 font-semibold hover:underline">
              {w.title}
            </Link>
            <KindTag w={w}>
              {' · '}
              <span className="font-mono">{w.docNumber}</span>
              {w.customer ? ` · ${w.customer.name}` : w.contactName ? ` · ${w.contactName}` : ''}
              {w.orderDocNumber ? ` · ${w.orderDocNumber}` : ''}
            </KindTag>
          </div>
        );
      },
    },
    {
      id: 'deadline',
      header: 'Hạn',
      meta: { width: 150 },
      cell: ({ row }) => <DeadlineCell w={row.original} />,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: 120 },
      cell: ({ row }) => <WorkStatusBadge w={row.original} />,
    },
    {
      id: 'priority',
      header: 'Ưu tiên',
      meta: { width: 80 },
      cell: ({ row }) => <PriorityText p={row.original.priority} />,
    },
    {
      id: 'source',
      header: 'Nguồn',
      meta: { width: 170 },
      cell: ({ row }) => {
        const w = row.original;
        if (w.kind === 'TASK') {
          return w.assigner && w.assigner.id === w.assignee?.id ? (
            <span className="text-muted-foreground">Tự tạo</span>
          ) : (
            <PersonText p={w.assigner} />
          );
        }
        return (
          <div className="min-w-0">
            <PersonText p={w.requester} />
            {w.ownerDeptName ? (
              <div className="truncate text-xs text-muted-foreground">→ {w.ownerDeptName}</div>
            ) : null}
          </div>
        );
      },
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
