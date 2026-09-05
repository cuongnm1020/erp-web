'use client';

import { ChevronDown, History } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DataTable,
  FilterBar,
  type ColumnDef,
  type RowSelectionState,
} from '@/components/data/data-table';
import { EmptyState, ForbiddenState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useInvalidateOn } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import {
  assignmentKeys,
  useAssignCustomers,
  useAssignmentHistory,
  useAssignmentTeams,
  useTeamMembers,
  type AssignCustomersResult,
  type AssignmentTeam,
  type TeamMemberLoad,
} from '../api/use-assignments';
import { customerKeys, toCustomerSort, useCustomers, type Customer } from '../api/use-customers';
import { customerTypeLabel, customerTypeTone, initialsOf } from '../labels';

/**
 * B-04 Phân công khách hàng — nối API P2-04 (`/customer-assignments`).
 *
 * Chỉ leader thấy màn này (`customer.assign`; sidebar cũng gắn ability). Leader chọn team
 * mình lead (URL `?team=`), tab Chưa phân / Đã phân trong team (URL `?tab=`), chọn nhiều
 * dòng rồi "Gán cho" một thành viên — hoặc bấm "Gán N" ngay trên bảng thành viên.
 *
 * Gán là thao tác đảo ngược được (design): làm luôn, không hỏi confirm; toast 10 giây có
 * "Hoàn tác" — gọi lại API với `previousTeamId`/`previousUserId` server trả về (ledger
 * append-only, hoàn tác là một dòng phân công mới với lý do "Hoàn tác").
 *
 * Bỏ so với artboard vì API chưa mô tả: cột Cấp độ / Tag / DT 12 tháng, bộ lọc Nguồn /
 * Quận huyện, "Nhập phân công từ CSV". Không hiện số bịa (luật 2).
 */
type Filters = 'team' | 'tab';
const DEFAULTS = {
  size: 50,
  sort: { id: 'createdAt', desc: true },
  filterKeys: ['team', 'tab'] as const satisfies readonly Filters[],
};

export function CustomerAssignmentScreen() {
  const ability = useAbility();
  const teams = useAssignmentTeams();
  if (!ability.can('assign', 'Customer')) return <ForbiddenState />;
  return (
    <QueryState
      query={teams}
      skeleton={<ListSkeleton rows={8} columns={6} />}
      isEmpty={(d) => d.length === 0}
      empty={
        <EmptyState
          title="Bạn chưa là trưởng nhóm team nào"
          description="Chỉ leader mới phân công khách. Nhờ quản trị gán bạn làm LEADER của team kinh doanh."
        />
      }
    >
      {(list) => <AssignmentBody teams={list} />}
    </QueryState>
  );
}

function AssignmentBody({ teams }: { teams: AssignmentTeam[] }) {
  const { state, set, skipTake } = useListState<Filters>(DEFAULTS);
  const team = teams.find((t) => t.teamId === state.filters.team) ?? teams[0]!;
  const tab: 'unassigned' | 'assigned' =
    state.filters.tab === 'assigned' ? 'assigned' : 'unassigned';
  const members = useTeamMembers(team.teamId);
  const [historyOpen, setHistoryOpen] = useState(false);

  useInvalidateOn(
    ['customer.created', 'customer.updated', 'customer.assigned'],
    [customerKeys.lists(), assignmentKeys.all],
  );

  const assignedCount = team.customersInTeam - team.unassigned;
  const memberCount = members.data?.length;

  return (
    <>
      <PageHeader
        title="Phân công khách hàng"
        description={`${team.name}${memberCount !== undefined ? ` · ${memberCount} thành viên` : ''} · ${team.customersInTeam} khách trong team · ${team.unassigned} chưa phân`}
        breadcrumb={[{ label: 'Khách hàng', href: '/crm/customers' }, { label: 'Phân công' }]}
        actions={
          <>
            {teams.length > 1 ? (
              <Select
                value={team.teamId}
                onValueChange={(v) => set({ filters: { ...state.filters, team: v } })}
              >
                <SelectTrigger className="h-8 w-56" aria-label="Chọn team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.teamId} value={t.teamId}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden />
              Lịch sử phân công
            </Button>
          </>
        }
      />

      <div className="flex h-9 border-b" role="tablist" aria-label="Khách trong team">
        {(
          [
            { key: 'unassigned', label: 'Chưa phân', count: team.unassigned },
            { key: 'assigned', label: 'Đã phân trong team', count: assignedCount },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => set({ filters: { ...state.filters, tab: t.key } })}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <AssignmentWorkspace
        key={`${team.teamId}:${tab}:${state.page}:${state.q}`}
        team={team}
        tab={tab}
        members={members.data ?? []}
        listState={{ state, set, skipTake }}
      />

      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Gán là thao tác đảo ngược được — làm luôn rồi cho Hoàn tác 10 giây, không hỏi confirm.
        Member chỉ thấy khách mình được gán; khách chưa phân chỉ leader thấy.
      </p>

      <HistoryDialog teamId={team.teamId} open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}

/** Bảng + panel thành viên dùng chung selection; remount (key) khi đổi team/tab/trang → bỏ chọn. */
function AssignmentWorkspace({
  team,
  tab,
  members,
  listState,
}: {
  team: AssignmentTeam;
  tab: 'unassigned' | 'assigned';
  members: TeamMemberLoad[];
  listState: ReturnType<typeof useListState<Filters>>;
}) {
  const { state, set, skipTake } = listState;
  const [selected, setSelected] = useState<RowSelectionState>({});
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const assign = useAssignCustomers();

  const params = useMemo(
    () => ({
      q: state.q,
      teamId: team.teamId,
      unassigned: tab === 'unassigned',
      isActive: true,
      ...toCustomerSort(state.sort),
      ...skipTake,
    }),
    [state.q, state.sort, team.teamId, tab, skipTake],
  );
  const query = useCustomers(params);

  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.fullName])), [members]);

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
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
        meta: { width: 260, sortable: true },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'SĐT',
        meta: { width: 130 },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{formatPhone(getValue() as string | null)}</span>
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Loại khách',
        meta: { width: 140, sortable: true },
        cell: ({ row }) => (
          <StatusBadge tone={customerTypeTone(row.original.type)}>
            {customerTypeLabel(row.original.type)}
          </StatusBadge>
        ),
      },
      ...(tab === 'assigned'
        ? [
            {
              id: 'owner',
              header: 'Phụ trách',
              meta: { width: 180 },
              cell: ({ row }) => {
                const names = row.original.ownerIds.map((id) => memberName.get(id) ?? 'Ngoài team');
                return names.length > 0 ? names.join(', ') : '—';
              },
            } satisfies ColumnDef<Customer, unknown>,
          ]
        : []),
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Tạo lúc',
        meta: { width: 120, sortable: true },
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
    ],
    [tab, memberName],
  );

  /** Hoàn tác = gán ngược về trạng thái trước — nhóm theo (team, owner) cũ để gọi ít request. */
  const undo = async (res: AssignCustomersResult) => {
    const groups = new Map<string, { teamId: string; userId: string | null; ids: string[] }>();
    for (const it of res.items) {
      if (!it.changed || !it.previousTeamId) continue;
      const key = `${it.previousTeamId}:${it.previousUserId ?? ''}`;
      const g = groups.get(key) ?? {
        teamId: it.previousTeamId,
        userId: it.previousUserId,
        ids: [],
      };
      g.ids.push(it.customerId);
      groups.set(key, g);
    }
    try {
      for (const g of groups.values()) {
        await assign.mutateAsync({
          customerIds: g.ids,
          teamId: g.teamId,
          userId: g.userId,
          reason: 'Hoàn tác',
        });
      }
      toast.success('Đã hoàn tác phân công');
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  const doAssign = async (ids: string[], member: TeamMemberLoad | null) => {
    try {
      const res = await assign.mutateAsync({
        customerIds: ids,
        teamId: team.teamId,
        userId: member?.userId ?? null,
      });
      setSelected({});
      toast.success(
        member
          ? `Đã gán ${res.assigned} khách cho ${member.fullName}`
          : `Đã trả ${res.assigned} khách về chưa phân`,
        {
          description:
            res.unchanged > 0 ? `${res.unchanged} khách đã ở đúng chỗ, không đổi` : undefined,
          duration: 10_000,
          action:
            res.assigned > 0 ? { label: 'Hoàn tác', onClick: () => void undo(res) } : undefined,
        },
      );
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  const maxHolding = Math.max(1, ...members.map((m) => m.holding));
  const busiest = members.reduce<TeamMemberLoad | null>(
    (acc, m) => (acc === null || m.holding > acc.holding ? m : acc),
    null,
  );
  const lightest = members
    .filter((m) => m.role === 'MEMBER')
    .reduce<TeamMemberLoad | null>(
      (acc, m) => (acc === null || m.holding < acc.holding ? m : acc),
      null,
    );

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-2">
        <FilterBar
          q={state.q}
          onQChange={(q) => set({ q })}
          values={{}}
          onFilterChange={() => undefined}
          searchPlaceholder="Tìm theo tên, mã KH, SĐT…"
        />
        <QueryState
          query={query}
          skeleton={<ListSkeleton rows={10} columns={6} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            tab === 'unassigned' ? (
              <EmptyState
                title={
                  state.q ? 'Không có khách chưa phân khớp từ khóa' : 'Không còn khách chưa phân'
                }
                description={
                  state.q
                    ? 'Thử từ khóa khác hoặc xem tab Đã phân trong team.'
                    : 'Mọi khách trong team đã có người phụ trách. Khách mới tạo bởi leader sẽ xuất hiện ở đây.'
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => set({ filters: { ...state.filters, tab: 'assigned' }, q: '' })}
                  >
                    Xem khách đã phân
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={
                  state.q ? 'Không có khách đã phân khớp từ khóa' : 'Chưa gán khách nào trong team'
                }
                description="Chọn khách ở tab Chưa phân rồi gán cho thành viên."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => set({ filters: { ...state.filters, tab: 'unassigned' }, q: '' })}
                  >
                    Về tab Chưa phân
                  </Button>
                }
              />
            )
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
              sort={state.sort}
              onPageChange={(page) => set({ page })}
              onSizeChange={(size) => set({ size })}
              onSortChange={(sort) => set({ sort })}
              selection={{ selected, onChange: setSelected }}
              stickyFirstColumn
              bulkActions={(ids) => (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-7 px-2 text-xs" disabled={assign.isPending}>
                        Gán cho <ChevronDown aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Thành viên {team.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {members.map((m) => (
                        <DropdownMenuItem key={m.userId} onSelect={() => void doAssign(ids, m)}>
                          {m.fullName}
                          <span className="ml-auto pl-4 text-xs text-muted-foreground">
                            {m.holding}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {tab === 'assigned' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={assign.isPending}
                      onClick={() => void doAssign(ids, null)}
                    >
                      Trả về chưa phân
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => setSelected({})}
                  >
                    Bỏ chọn
                  </button>
                </>
              )}
            />
          )}
        </QueryState>
      </div>

      <div className="rounded-md border bg-card">
        <header className="flex items-center justify-between border-b px-3 py-2 text-sm">
          <span className="font-semibold">Thành viên {team.name}</span>
          <span className="text-xs text-muted-foreground">KH đang giữ</span>
        </header>
        {members.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Team chưa có thành viên nào.</p>
        ) : (
          <ul>
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5 border-b px-3 py-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    m.holding === 0
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-secondary text-primary',
                  )}
                  aria-hidden
                >
                  {initialsOf(m.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{m.fullName}</span>
                    {m.role === 'LEADER' ? <StatusBadge tone="brand">Leader</StatusBadge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={maxHolding}
                      aria-valuenow={m.holding}
                      aria-label={`${m.fullName} đang giữ ${m.holding} khách`}
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((m.holding / maxHolding) * 100)}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {m.holding}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={selectedIds.length === 0 || assign.isPending}
                  onClick={() => void doAssign(selectedIds, m)}
                  aria-label={`Gán ${selectedIds.length} khách cho ${m.fullName}`}
                >
                  Gán {selectedIds.length}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {busiest && lightest && busiest.userId !== lightest.userId ? (
          <p className="px-3 py-2.5 text-xs text-muted-foreground">
            Thanh tải = số KH đang giữ so với người nhiều nhất ({busiest.holding}). Cân nhắc dồn
            khách mới cho {lightest.fullName}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HistoryDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const history = useAssignmentHistory({ teamId, take: 50, skip: 0 }, { enabled: open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lịch sử phân công</DialogTitle>
          <DialogDescription>
            50 lần phân công gần nhất của team — mỗi dòng là một lần gán, không sửa được.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <QueryState
            query={history}
            skeleton={<ListSkeleton rows={6} columns={4} />}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState title="Chưa có lần phân công nào" className="min-h-40" />}
          >
            {(d) => (
              <ul className="divide-y text-sm">
                {d.items.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
                    <span className="w-32 shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(r.startAt)}
                    </span>
                    <span className="font-mono text-xs">{r.customerCode}</span>
                    <span className="truncate">{r.customerName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{r.userName ?? 'chưa chia'}</span>
                    <span className="text-xs text-muted-foreground">bởi {r.assignedByName}</span>
                    {r.reason ? (
                      <span className="text-xs text-muted-foreground">· {r.reason}</span>
                    ) : null}
                    <span className="ml-auto">
                      {r.endAt === null ? (
                        <StatusBadge tone="ok">đang hiệu lực</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">đã thay</StatusBadge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </DialogContent>
    </Dialog>
  );
}
