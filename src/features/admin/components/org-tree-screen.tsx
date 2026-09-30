'use client';

import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  Network,
  Search,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useListState } from '@/lib/url-state';
import {
  useOrgTree,
  type OrgDepartmentNode,
  type OrgEmployee,
  type OrgTeamMember,
  type OrgTeamNode,
  type OrgTree,
} from '../api/use-org-tree';

/**
 * Cây nhân sự — hai trục cạnh nhau: phòng ban (cơ cấu tổ chức, mỗi người ≤ 1 phòng ban) và
 * team (đơn vị phân quyền dữ liệu, một người có thể ở nhiều team). Server (`GET /org/tree`)
 * đã lồng sẵn theo `parentId`; màn này chỉ vẽ, thu/mở node và lọc theo từ khóa.
 *
 * URL: `?q=` từ khóa (F5 / dán link giữ nguyên), `?inactive=1` hiện cả người / phòng ban /
 * team đã ngừng hoạt động (mặc định ẩn — server lọc, không lọc ở client theo quyền, luật 7).
 * Danh bạ nội bộ vài trăm người nên tải nguyên cây — không phải danh sách lớn cần phân trang.
 */
const DEFAULTS = { filterKeys: ['inactive'] as const };

const TEAM_TYPE_LABEL: Record<OrgTeamNode['type'], string> = {
  SALES: 'Kinh doanh',
  WAREHOUSE: 'Kho',
  ACCOUNTING: 'Kế toán',
  MARKETING: 'Marketing',
  OPERATION: 'Vận hành',
};

/** Id giả cho nhóm "Chưa có phòng ban" — không trùng uuid nào. */
const UNASSIGNED_ID = '__unassigned';

export function OrgTreeScreen() {
  const { state, set } = useListState<'inactive'>(DEFAULTS);
  const includeInactive = state.filters.inactive === '1';
  const tree = useOrgTree(includeInactive);

  return (
    <QueryState
      query={tree}
      skeleton={
        <>
          <PageHeader
            title="Cây nhân sự"
            breadcrumb={[{ label: 'Quản trị' }, { label: 'Cây nhân sự' }]}
          />
          <div className="grid gap-3 xl:grid-cols-2">
            <ListSkeleton rows={10} columns={2} />
            <ListSkeleton rows={10} columns={2} />
          </div>
        </>
      }
      isEmpty={(d) =>
        d.totals.employees === 0 && d.departments.length === 0 && d.teams.length === 0
      }
      empty={
        <>
          <PageHeader
            title="Cây nhân sự"
            description="Chưa có dữ liệu"
            breadcrumb={[{ label: 'Quản trị' }, { label: 'Cây nhân sự' }]}
          />
          <EmptyState
            title="Chưa có dữ liệu nhân sự"
            description="Tạo nhân viên và phòng ban trước — cây sẽ tự dựng theo phòng ban và team của từng người."
            action={
              <Button size="sm" asChild>
                <Link href="/admin/users">Đến danh sách nhân viên</Link>
              </Button>
            }
          />
        </>
      }
    >
      {(data) => (
        <OrgTreeBody
          data={data}
          q={state.q}
          onQChange={(q) => set({ q })}
          includeInactive={includeInactive}
          onIncludeInactiveChange={(on) => set({ filters: { inactive: on ? '1' : undefined } })}
        />
      )}
    </QueryState>
  );
}

function OrgTreeBody({
  data,
  q,
  onQChange,
  includeInactive,
  onIncludeInactiveChange,
}: {
  data: OrgTree;
  q: string;
  onQChange: (q: string) => void;
  includeInactive: boolean;
  onIncludeInactiveChange: (on: boolean) => void;
}) {
  // Node đang THU GỌN (mặc định mở hết — người dùng nhìn toàn cảnh rồi gấp bớt).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const needle = q.trim().toLowerCase();

  const departments = useMemo(() => {
    const roots: OrgDepartmentNode[] = [...data.departments];
    if (data.unassigned.length > 0) {
      roots.push({
        id: UNASSIGNED_ID,
        code: '—',
        name: 'Chưa có phòng ban',
        isActive: true,
        managerId: null,
        members: data.unassigned,
        memberCount: data.unassigned.length,
        children: [],
      });
    }
    return roots.map((n) => prune(n, needle)).filter(isPresent);
  }, [data.departments, data.unassigned, needle]);
  const teams = useMemo(
    () => data.teams.map((n) => prune(n, needle)).filter(isPresent),
    [data.teams, needle],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const collapseAll = () =>
    setCollapsed(new Set([...departments.flatMap(idsOf), ...teams.flatMap(idsOf)]));
  const expandAll = () => setCollapsed(new Set());
  // Đang tìm → mở hết để thấy kết quả, bỏ qua trạng thái gấp.
  const isOpen = (id: string) => needle !== '' || !collapsed.has(id);

  return (
    <>
      <PageHeader
        title="Cây nhân sự"
        description={`${data.totals.employees} nhân viên · ${data.totals.departments} phòng ban · ${data.totals.teams} team`}
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Cây nhân sự' }]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/teams">
              <Network aria-hidden />
              Quản lý phòng ban
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Tìm nhân viên"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            className="h-8 pl-8"
            placeholder="Tìm theo tên, mã, email, phòng ban, team…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={includeInactive}
            onCheckedChange={(v) => onIncludeInactiveChange(v === true)}
            aria-label="Hiện đã ngừng hoạt động"
          />
          Hiện đã ngừng hoạt động
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={expandAll} disabled={needle !== ''}>
            <ChevronsUpDown aria-hidden />
            Mở tất cả
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} disabled={needle !== ''}>
            <ChevronsDownUp aria-hidden />
            Thu gọn tất cả
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <TreePanel
          title="Theo phòng ban"
          hint="mỗi nhân viên thuộc một phòng ban"
          emptyText={needle ? 'Không có nhân viên khớp trong phòng ban nào.' : 'Chưa có phòng ban.'}
          count={departments.length}
        >
          {departments.map((node) => (
            <DepartmentItem key={node.id} node={node} depth={0} isOpen={isOpen} onToggle={toggle} />
          ))}
        </TreePanel>
        <TreePanel
          title="Theo team"
          hint="một người có thể ở nhiều team"
          emptyText={needle ? 'Không có thành viên khớp trong team nào.' : 'Chưa có team.'}
          count={teams.length}
        >
          {teams.map((node) => (
            <TeamItem key={node.id} node={node} depth={0} isOpen={isOpen} onToggle={toggle} />
          ))}
        </TreePanel>
      </div>
    </>
  );
}

function TreePanel({
  title,
  hint,
  emptyText,
  count,
  children,
}: {
  title: string;
  hint: string;
  emptyText: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card" aria-label={title}>
      <h2 className="flex items-baseline gap-2 border-b px-3 py-2 text-sm font-semibold">
        {title}
        <span className="text-xs font-normal text-muted-foreground">· {hint}</span>
      </h2>
      {count === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul role="tree" aria-label={title} className="py-1">
          {children}
        </ul>
      )}
    </section>
  );
}

interface ItemProps<N> {
  node: N;
  depth: number;
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
}

function DepartmentItem({ node, depth, isOpen, onToggle }: ItemProps<OrgDepartmentNode>) {
  const open = isOpen(node.id);
  return (
    <li role="treeitem" aria-selected={false} aria-expanded={open} aria-label={node.name}>
      <NodeRow
        depth={depth}
        open={open}
        onToggle={() => onToggle(node.id)}
        icon={<Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        name={node.name}
        code={node.id === UNASSIGNED_ID ? null : node.code}
        inactive={!node.isActive}
        count={node.memberCount}
        muted={node.id === UNASSIGNED_ID}
      />
      {open ? (
        <ul role="group">
          {node.members.map((e) => (
            <EmployeeRow
              key={e.id}
              employee={e}
              depth={depth + 1}
              badge={e.id === node.managerId ? 'Trưởng phòng' : null}
            />
          ))}
          {node.children.map((c) => (
            <DepartmentItem
              key={c.id}
              node={c}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TeamItem({ node, depth, isOpen, onToggle }: ItemProps<OrgTeamNode>) {
  const open = isOpen(node.id);
  return (
    <li role="treeitem" aria-selected={false} aria-expanded={open} aria-label={node.name}>
      <NodeRow
        depth={depth}
        open={open}
        onToggle={() => onToggle(node.id)}
        icon={<Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        name={node.name}
        code={node.code}
        inactive={!node.isActive}
        count={node.memberCount}
        extra={<StatusBadge tone="neutral">{TEAM_TYPE_LABEL[node.type]}</StatusBadge>}
      />
      {open ? (
        <ul role="group">
          {node.members.map((m) => (
            <EmployeeRow
              key={m.id}
              employee={m}
              depth={depth + 1}
              badge={m.role === 'LEADER' ? 'Leader' : null}
            />
          ))}
          {node.children.map((c) => (
            <TeamItem key={c.id} node={c} depth={depth + 1} isOpen={isOpen} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NodeRow({
  depth,
  open,
  onToggle,
  icon,
  name,
  code,
  inactive,
  count,
  extra,
  muted,
}: {
  depth: number;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  name: string;
  code: string | null;
  inactive: boolean;
  count: number;
  extra?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 items-center gap-1.5 pr-3 text-sm hover:bg-muted/60',
        (inactive || muted) && 'text-muted-foreground',
      )}
      style={{ paddingLeft: `${8 + depth * 20}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${open ? 'Thu gọn' : 'Mở'} ${name}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-90',
          )}
          aria-hidden
        />
      </button>
      {icon}
      <span className={cn('truncate font-semibold', muted && 'italic font-medium')}>{name}</span>
      {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
      {inactive ? <StatusBadge tone="neutral">Ngừng</StatusBadge> : null}
      {extra}
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {count} người
      </span>
    </div>
  );
}

function EmployeeRow({
  employee,
  depth,
  badge,
}: {
  employee: OrgEmployee | OrgTeamMember;
  depth: number;
  badge: string | null;
}) {
  return (
    <li
      role="treeitem"
      aria-selected={false}
      className={cn(
        'flex min-h-8 items-center gap-2 pr-3 text-sm hover:bg-muted/60',
        !employee.isActive && 'text-muted-foreground',
      )}
      style={{ paddingLeft: `${8 + depth * 20 + 28}px` }}
    >
      <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Link href={`/admin/users/${employee.id}`} className="truncate font-medium hover:underline">
        {employee.fullName}
      </Link>
      <span className="font-mono text-xs text-muted-foreground">{employee.code}</span>
      {badge ? <StatusBadge tone="brand">{badge}</StatusBadge> : null}
      {!employee.isActive ? <StatusBadge tone="neutral">Khóa</StatusBadge> : null}
      <span className="ml-auto hidden truncate text-xs text-muted-foreground md:inline">
        {employee.email}
      </span>
    </li>
  );
}

// ── Lọc & tiện ích cây ──────────────────────────────────────

type AnyNode<N> = N & {
  code: string;
  name: string;
  members: { fullName: string; code: string; email: string }[];
  children: AnyNode<N>[];
};

/**
 * Giữ node khi tên/mã node khớp (kèm toàn bộ nhân viên trực tiếp), hoặc có nhân viên khớp,
 * hoặc có con khớp. Không khớp gì → bỏ. `memberCount` giữ số gốc của server.
 */
function prune<N>(node: AnyNode<N>, needle: string): AnyNode<N> | null {
  if (needle === '') return node;
  const self = `${node.name} ${node.code}`.toLowerCase().includes(needle);
  const members = self
    ? node.members
    : node.members.filter((e) =>
        `${e.fullName} ${e.code} ${e.email}`.toLowerCase().includes(needle),
      );
  const children = node.children.map((c) => prune(c, needle)).filter(isPresent);
  if (!self && members.length === 0 && children.length === 0) return null;
  return { ...node, members, children };
}

function idsOf<N>(node: AnyNode<N> & { id: string }): string[] {
  return [node.id, ...node.children.flatMap((c) => idsOf(c as AnyNode<N> & { id: string }))];
}

function isPresent<T>(v: T | null): v is T {
  return v !== null;
}
