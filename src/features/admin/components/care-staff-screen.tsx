'use client';

import { Lock, LockOpen, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import {
  DateRangePicker,
  defaultRangePresets,
  normalizeRange,
} from '@/components/data/date-range-picker';
import { SearchSelect, type StaffSelectItem } from '@/components/data/form';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
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
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatPhone, groupVi, toLocalDateKey, toDecimal } from '@/lib/format';
import { useListState } from '@/lib/url-state';
import {
  useCareStaff,
  useStaffRevenue,
  type CarePosition,
  type CareStaff,
  type StaffRevenue,
} from '../api/use-org-tree';
import { useUpdateUser } from '../api/use-users';
import { CARE_GRANT_LABELS } from '../labels';
import { CareGrantDialog } from './care-grant-dialog';
import { OrgStaffDialog } from './org-staff-dialog';
import { UserCreateDialog } from './user-create-dialog';

const MAX_DAYS = 366;
const ALL_DEPTS = '__all__';
/** Lọc nhóm: nhân viên chưa có nhóm. */
const NO_GROUP = 'none';

type Row = CareStaff & { revenue: StaffRevenue | null; groupLeaderName: string | null };

const POSITION: Record<CarePosition, { label: string; tone: 'brand' | 'draft' | 'neutral' }> = {
  MANAGER: { label: 'Leader', tone: 'brand' },
  GROUP_LEAD: { label: 'Trưởng nhóm', tone: 'draft' },
  MEMBER: { label: 'Nhân viên', tone: 'neutral' },
};
type Filter = 'from' | 'to' | 'inactive' | 'dept' | 'pos' | 'group';

/**
 * Nhân viên của team — trưởng nhóm CSKH (2026-10-22, thay Sơ đồ nhân sự với CSKH). Danh sách
 * GET /org/care-staff (phòng CSKH mình phụ trách, API lọc phạm vi) + doanh thu kỳ chọn theo người
 * phụ trách đơn (GET /reports/sales/by-staff, đã lọc theo team). Thêm = POST /users vào phòng CSKH;
 * Sửa / Khóa / Mở khóa = PATCH /users/{id} — server kiểm lại quyền (StaffAccessService).
 * Danh sách team nhỏ (vài chục người) nên API trả đủ, không phân trang. URL: ?from&to&inactive&dept.
 */
export function CareStaffScreen() {
  const { state, set } = useListState<Filter>({
    filterKeys: ['from', 'to', 'inactive', 'dept', 'pos', 'group'],
  });
  const today = toLocalDateKey(new Date()) ?? '';
  const presets = defaultRangePresets(today);
  const monthStart = `${today.slice(0, 8)}01`;
  const range = useMemo(
    () =>
      normalizeRange(
        { from: state.filters.from, to: state.filters.to },
        { from: monthStart, to: today },
        MAX_DAYS,
      ),
    [state.filters.from, state.filters.to, monthStart, today],
  );
  const includeInactive = state.filters.inactive === '1';
  const dept = state.filters.dept ?? ALL_DEPTS;
  const pos = (state.filters.pos ?? '') as CarePosition | '';
  const group = state.filters.group ?? '';
  const setFilter = (patch: Partial<Record<Filter, string>>) =>
    set({ filters: { ...state.filters, ...patch } });

  const staff = useCareStaff(includeInactive);
  const revenue = useStaffRevenue(range.from, range.to);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CareStaff | null>(null);
  const [locking, setLocking] = useState<CareStaff | null>(null);
  const [granting, setGranting] = useState<CareStaff | null>(null);
  const viewer = staff.data?.viewer;

  const departments = staff.data?.departments ?? [];
  const createDept =
    departments.find((d) => d.id === dept) ?? (departments.length === 1 ? departments[0] : null);
  const revenueByUser = useMemo(
    () => new Map((revenue.data?.items ?? []).map((r) => [r.key.id, r])),
    [revenue.data],
  );
  const all = staff.data?.staff ?? [];
  const groupLeads = all.filter((s) => s.position === 'GROUP_LEAD');
  const nameById = new Map(all.map((s) => [s.id, s.fullName]));
  // Cột "Quyền thêm" chỉ cho người cấp được (trưởng phòng / quản trị).
  const showGrants = all.some((s) => s.position === 'GROUP_LEAD' && s.canLead);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Nhân viên',
        meta: { width: 220 },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <span className="block font-medium">{row.original.fullName}</span>
            <span className="block font-mono text-xs text-muted-foreground">
              {row.original.code}
            </span>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Liên hệ',
        meta: { width: 220 },
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <span className="block max-w-52 truncate" title={row.original.email}>
              {row.original.email}
            </span>
            <span className="block text-muted-foreground">
              {row.original.phone ? formatPhone(row.original.phone) : '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'position',
        header: 'Chức vụ',
        meta: { width: 130 },
        cell: ({ row }) => (
          <StatusBadge tone={POSITION[row.original.position].tone}>
            {POSITION[row.original.position].label}
          </StatusBadge>
        ),
      },
      {
        id: 'group',
        header: 'Nhóm',
        meta: { width: 170 },
        cell: ({ row }) => {
          const r = row.original;
          if (r.position === 'GROUP_LEAD')
            return (
              <span className="text-xs">
                {r.groupSize > 0
                  ? `${groupVi(String(r.groupSize))} nhân viên`
                  : 'Chưa có — cả phòng'}
              </span>
            );
          if (r.position === 'MANAGER') return <span className="text-muted-foreground">—</span>;
          return r.groupLeaderName ? (
            <span className="text-xs">Nhóm {r.groupLeaderName}</span>
          ) : (
            <StatusBadge tone="warn">Chưa có nhóm</StatusBadge>
          );
        },
      },
      ...(showGrants
        ? [
            {
              id: 'grants',
              header: 'Quyền thêm',
              meta: { width: 220 },
              cell: ({ row }: { row: { original: Row } }) => {
                const r = row.original;
                if (r.position !== 'GROUP_LEAD')
                  return <span className="text-muted-foreground">—</span>;
                if (r.grantedPermissions.length === 0)
                  return <span className="text-xs text-muted-foreground">Chưa cấp quyền nào</span>;
                const names = r.grantedPermissions.map((c) => CARE_GRANT_LABELS[c] ?? c);
                return (
                  <span className="line-clamp-2 text-xs" title={names.join(' · ')}>
                    {names.join(' · ')}
                  </span>
                );
              },
            } satisfies ColumnDef<Row, unknown>,
          ]
        : []),
      {
        id: 'department',
        header: 'Phòng ban',
        meta: { width: 150 },
        cell: ({ row }) => <span className="text-xs">{row.original.departmentName ?? '—'}</span>,
      },
      {
        id: 'revenue',
        header: 'Doanh số',
        meta: { align: 'right', width: 140 },
        cell: ({ row }) => {
          const r = row.original.revenue;
          if (revenue.isPending) return <span className="text-muted-foreground">…</span>;
          const returned = toDecimal(r?.returnedRevenue ?? '0');
          return (
            // Doanh số như Pancake (chưa trừ hoàn); hoàn hiện dòng dưới để tách.
            <div className="space-y-0.5">
              <span className="block font-semibold">
                {formatMoney(r?.grossRevenue ?? '0', { unit: '' })}
              </span>
              <span className="block text-xs text-muted-foreground">
                {groupVi(String(r?.orderCount ?? 0))} đơn
                {returned && !returned.isZero()
                  ? ` · hoàn ${formatMoney(returned.toString(), { unit: '' })}`
                  : ''}
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Trạng thái',
        meta: { width: 110 },
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="ok">Đang làm</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Đã khóa</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { width: 240 },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex justify-end gap-1">
              {r.position === 'GROUP_LEAD' && r.canLead ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Phân quyền ${r.code}`}
                  onClick={() => setGranting(r)}
                >
                  <ShieldCheck aria-hidden /> Phân quyền
                </Button>
              ) : null}
              {r.canEdit || r.canEditPancake ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Sửa ${r.code}`}
                  onClick={() => setEditing(r)}
                >
                  <Pencil aria-hidden /> Sửa
                </Button>
              ) : null}
              {r.canLock ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${r.isActive ? 'Khóa' : 'Mở khóa'} ${r.code}`}
                  onClick={() => setLocking(r)}
                >
                  {r.isActive ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                  {r.isActive ? 'Khóa' : 'Mở khóa'}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [revenue.isPending, showGrants],
  );

  const rows: Row[] = all
    .filter((s) => dept === ALL_DEPTS || s.departmentId === dept)
    .filter((s) => !pos || s.position === pos)
    .filter((s) =>
      !group
        ? true
        : group === NO_GROUP
          ? s.position === 'MEMBER' && !s.groupLeaderId
          : s.groupLeaderId === group || s.id === group,
    )
    .map((s) => ({
      ...s,
      revenue: revenueByUser.get(s.id) ?? null,
      groupLeaderName: s.groupLeaderId ? (nameById.get(s.groupLeaderId) ?? null) : null,
    }));
  const groupLeadItems: StaffSelectItem[] = groupLeads.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    code: g.code,
  }));
  const teamRevenue = rows.reduce(
    (acc, r) => acc.plus(toDecimal(r.revenue?.grossRevenue ?? '0') ?? 0),
    toDecimal('0')!,
  );

  return (
    <>
      <PageHeader
        title="Nhân viên của team"
        description={
          staff.data
            ? `${rows.length} nhân viên · doanh số kỳ chọn ${formatMoney(teamRevenue.toString())}`
            : 'Đang tải nhân viên của team…'
        }
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Nhân viên của team' },
        ]}
        actions={
          createDept ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Thêm nhân viên
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <span className="pb-1.5 text-sm font-semibold text-muted-foreground">Doanh số</span>
        <DateRangePicker
          label="Kỳ doanh số"
          value={range}
          today={today}
          maxDays={MAX_DAYS}
          presets={presets}
          onChange={(r) => setFilter({ from: r.from, to: r.to })}
        />
        {departments.length > 1 ? (
          <Select value={dept} onValueChange={(v) => setFilter({ dept: v === ALL_DEPTS ? '' : v })}>
            <SelectTrigger className="w-56" aria-label="Phòng ban">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DEPTS}>Mọi phòng CSKH</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {groupLeads.length > 0 ? (
          <SearchSelect
            aria-label="Nhóm"
            className="w-52"
            value={group}
            onChange={(v) => setFilter({ group: v })}
            noneLabel="Nhóm: tất cả"
            options={[
              { value: NO_GROUP, label: 'Chưa có nhóm' },
              ...groupLeads.map((g) => ({
                value: g.id,
                label: `Nhóm ${g.fullName}`,
                hint: `${g.groupSize} NV`,
              })),
            ]}
            searchPlaceholder="Tìm trưởng nhóm…"
          />
        ) : null}
        <Select
          value={pos || ALL_DEPTS}
          onValueChange={(v) => setFilter({ pos: v === ALL_DEPTS ? '' : v })}
        >
          <SelectTrigger className="w-44" aria-label="Chức vụ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPTS}>Chức vụ: tất cả</SelectItem>
            {(['MANAGER', 'GROUP_LEAD', 'MEMBER'] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {POSITION[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant={includeInactive ? 'default' : 'outline'}
          aria-pressed={includeInactive}
          onClick={() => setFilter({ inactive: includeInactive ? '' : '1' })}
        >
          Hiện cả nhân viên đã khóa
        </Button>
      </div>

      <QueryState
        query={staff}
        skeleton={<ListSkeleton rows={8} columns={7} />}
        isEmpty={(d) => d.departments.length === 0 || d.staff.length === 0}
        empty={
          <EmptyState
            title={
              staff.data?.departments.length === 0
                ? 'Bạn chưa phụ trách phòng CSKH nào'
                : 'Team chưa có nhân viên'
            }
            description={
              staff.data?.departments.length === 0
                ? 'Màn này dành cho trưởng nhóm CSKH — nhờ quản trị gán bạn làm leader CSKH.'
                : 'Thêm nhân viên đầu tiên để chia khách chăm sóc.'
            }
            action={
              createDept ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  Thêm nhân viên
                </Button>
              ) : undefined
            }
          />
        }
      >
        {() => (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            total={rows.length}
            page={1}
            size={rows.length || 1}
            sort={null}
            onPageChange={() => undefined}
            onSizeChange={() => undefined}
            onSortChange={() => undefined}
            pagination={false}
          />
        )}
      </QueryState>

      {creating && createDept ? (
        <UserCreateDialog
          open
          onOpenChange={setCreating}
          fixedDepartment={{ id: createDept.id, name: createDept.name }}
        />
      ) : null}
      {editing ? (
        <OrgStaffDialog
          employee={editing}
          departments={departments.map((d) => ({ id: d.id, name: d.name, path: '' }))}
          allowUnassign={false}
          roles={editing.canEdit ? editing.roles : undefined}
          pancakeOnly={!editing.canEdit}
          hideWorkingShops
          onOpenChange={(o) => !o && setEditing(null)}
          care={
            editing.canEdit && editing.canLead
              ? {
                  position: editing.position,
                  groupLeaderId: editing.groupLeaderId,
                  canSetManager: viewer?.canSetManager ?? false,
                  groupLeads: groupLeadItems.filter((g) => g.id !== editing.id),
                }
              : undefined
          }
        />
      ) : null}
      {granting ? <CareGrantDialog lead={granting} onClose={() => setGranting(null)} /> : null}
      {locking ? <LockDialog staff={locking} onClose={() => setLocking(null)} /> : null}
    </>
  );
}

/** Khóa = không đăng nhập được + rời team phòng ban; Mở khóa = vào lại. PATCH /users/{id}. */
function LockDialog({ staff, onClose }: { staff: CareStaff; onClose: () => void }) {
  const update = useUpdateUser(staff.id);
  const lock = staff.isActive;
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${lock ? 'Khóa' : 'Mở khóa'} ${staff.fullName}?`}
      description={
        lock
          ? 'Nhân viên không đăng nhập được nữa và rời team. Đơn, khách và doanh thu cũ giữ nguyên; mở khóa lại bất cứ lúc nào.'
          : 'Nhân viên đăng nhập lại được và vào lại team của phòng ban.'
      }
      confirmLabel={lock ? 'Khóa' : 'Mở khóa'}
      destructive={lock}
      onConfirm={async () => {
        try {
          await update.mutateAsync({ isActive: !lock });
          toast.success(lock ? 'Đã khóa' : 'Đã mở khóa', {
            description: `${staff.code} · ${staff.fullName}`,
          });
        } catch (err) {
          toast.error(messageFor(err));
        }
      }}
    />
  );
}
