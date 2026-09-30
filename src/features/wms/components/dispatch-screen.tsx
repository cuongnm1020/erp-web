'use client';

import { AlertTriangle, ChevronDown, ChevronRight, Layers, Printer } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/data/data-table';
import { ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { usePrint } from '@/lib/print';
import { useInvalidateOn, useRealtime } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { useAbility } from '@/lib/permission';
import {
  taskKeys,
  useAssignTask,
  useAssignTasksBulk,
  useTasks,
  useUnassignTask,
  useWarehouseStaff,
  type Task,
  type WarehouseStaff,
} from '../api/use-tasks';
import { useWarehouses } from '../api/use-warehouses';
import {
  useAssignWave,
  useCreateWave,
  useMergeWaveSuggestion,
  useUnassignWave,
  useWaveDetail,
  useWaveSuggestions,
  useWaves,
  waveKeys,
  type Wave,
  type WavePackLevel,
  type WaveSuggestion,
} from '../api/use-waves';
import {
  TASK_TYPE_OPTIONS,
  formatMinutes,
  parseTaskType,
  taskStatusLabel,
  taskTypeLabel,
  taskTypeTone,
} from '../labels';
import { WavePrintSheet } from './wave-print-sheet';

/**
 * G-06 Bảng điều phối kho — GET /tasks. Từ 2026-09-22: MỘT bảng phân trang thay cho bốn làn
 * thẻ; trạng thái điều phối là TAB trên URL (`?status=`), chỉ tab đang mở mới gọi API — vào màn
 * mặc định chỉ tải "Chưa gán" (việc cần chia), ba tab kia tải khi bấm. Trang / cỡ trang cũng nằm
 * trên URL (luật 8) nên dán link cho đồng nghiệp ra đúng tab, đúng trang.
 *
 * KHÔNG CÓ CỜ "QUÁ HẠN SLA". `wms.Task` không có cột hạn chót nào, nên không có cách
 * trung thực nào để nói một việc đã trễ. API trả `ageMinutes` (tuổi việc kể từ lúc tạo)
 * và `idleMinutes` (nằm im ở trạng thái hiện tại) — màn hình hiển thị đúng hai con số đó.
 * Muốn cảnh báo trễ thật thì phải thêm cột hạn chót ở schema, không phải bịa ở frontend.
 *
 * Luật 9: socket chỉ được `invalidateQueries` theo prefix ['wms','tasks'] — cấm
 * `setQueryData` bằng payload socket vì payload chưa đi qua lớp quyền của user hiện tại.
 *
 * Bỏ so với bản UI-first vì `TaskRowDto` không có trường tương ứng:
 * - Làn "Hoàn thành hôm nay": `GET /tasks` không lọc theo ngày.
 * - Bảng nhân viên (tên, ca trực, tiến độ từng người): chỉ có `assigneeId` (UUID).
 * - Số chứng từ nguồn (SO-…/GRN-…): DTO trả `refType` + `refId` (UUID); hiện link "Đơn bán".
 * - "Ưu tiên Cao/TB/Thấp": `priority` là số nguyên, không có thang bậc; hiện đúng con số.
 *
 * Gán việc: dòng PENDING có ô "Gán cho…" (POST /tasks/:id/assign), dòng ASSIGNED có
 * "Trả về hàng đợi" (POST /tasks/:id/unassign) — chỉ hiện khi có task.assign; danh bạ
 * người nhận lấy từ GET /tasks/assignees. Tick nhiều dòng (cả ở tab khác — lô chọn giữ khi
 * đổi tab) → gán một người / gộp thành lượt ở thanh công cụ.
 *
 * Gợi ý gộp theo cấp đóng gói (PLAN-packaging-hierarchy §12, 2026-09-22): hai tab "Đủ gộp thùng"
 * / "Đủ gộp pallet" (`?merge=CARTON|PALLET`) đọc GET /waves/suggestions — server CHỈ gợi ý nhóm
 * đơn một SKU cộng đúng N thùng / một pallet, không tự tạo lượt. Số nhóm hiện trên tab kể cả khi
 * chưa mở; mỗi nhóm bung ra thấy đơn con; "Gộp và gán" → POST /waves/merge, server kiểm lại từng
 * đơn — 409 thì tải lại gợi ý, không gộp phần còn lại. Đơn lẻ / nhiều SKU vẫn ở "Chưa gán".
 */
const PAGE_SIZE = 20;
const DEFAULTS = {
  size: PAGE_SIZE,
  filterKeys: ['status', 'type', 'warehouseId', 'assignedTo', 'lines', 'merge'] as const,
};
const ALL_TYPES = '__all__';

type DispatchFilter = (typeof DEFAULTS.filterKeys)[number];
type TabStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'EXCEPTION';

const TABS: Array<{ status: TabStatus; title: string; hint: string }> = [
  { status: 'PENDING', title: 'Chưa gán', hint: 'chờ người nhận' },
  { status: 'ASSIGNED', title: 'Đã giao', hint: 'đã có người, chưa bắt đầu' },
  { status: 'IN_PROGRESS', title: 'Đang làm', hint: 'đang quét trên PDA' },
  { status: 'EXCEPTION', title: 'Ngoại lệ', hint: 'thiếu hàng · sai lô · hỏng' },
];

function parseStatus(v: string | undefined): TabStatus {
  return TABS.some((t) => t.status === v) ? (v as TabStatus) : 'PENDING';
}

/** Tab gợi ý gộp theo cấp đóng gói (`?merge=`) — đứng sau bốn tab trạng thái. */
const MERGE_TABS: Array<{ level: WavePackLevel; title: string; hint: string }> = [
  { level: 'CARTON', title: 'Đủ gộp thùng', hint: 'đơn một SKU cộng đúng N thùng — gộp rồi gán' },
  {
    level: 'PALLET',
    title: 'Đủ gộp pallet',
    hint: 'đơn một SKU cộng đúng một pallet — gộp rồi gán',
  },
];

function parseMerge(v: string | undefined): WavePackLevel | null {
  return MERGE_TABS.some((t) => t.level === v) ? (v as WavePackLevel) : null;
}

/** Nhãn cấp đóng gói của nhóm gợi ý / lượt: "Trọn thùng × 3", "Trọn pallet". */
function mergeLabel(level: WavePackLevel, count: number | null | undefined): string {
  if (level === 'PALLET') return count && count > 1 ? `Trọn pallet × ${count}` : 'Trọn pallet';
  return count ? `Trọn thùng × ${count}` : 'Trọn thùng';
}

/**
 * Lọc theo số dòng SKU của việc (URL `?lines=`): "1".."4" = đúng N dòng (`lineCount`),
 * "5+" = từ 5 dòng (`lineCountMin`). Điều phối gom đơn 1 SKU để gộp lượt đi nhanh.
 */
const LINE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: '1 SKU' },
  { value: '2', label: '2 SKU' },
  { value: '3', label: '3 SKU' },
  { value: '4', label: '4 SKU' },
  { value: '5+', label: '5+ SKU' },
];
const LINE_VALUES = new Set(LINE_OPTIONS.map((o) => o.value));

function lineFilter(lines: string): { lineCount?: number; lineCountMin?: number } {
  if (!LINE_VALUES.has(lines)) return {};
  return lines.endsWith('+')
    ? { lineCountMin: Number(lines.slice(0, -1)) }
    : { lineCount: Number(lines) };
}

interface Selection {
  ids: Set<string>;
  toggle: (task: Task) => void;
  /** Tick / bỏ tick cả trang đang hiện (ô "Chọn tất cả" ở đầu bảng). */
  setMany: (tasks: Task[], on: boolean) => void;
}

/**
 * Dòng tick được để gán / gộp: chưa gán hoặc đã gán (đổi người). Đang làm thì không. Việc đã
 * thuộc lượt gộp cũng không — server chặn gán lẻ ("đổi người trên lượt, không gán lẻ"), phải gán
 * cả lượt ở bảng "Lượt lấy hàng gộp".
 */
function selectable(task: Task): boolean {
  return (task.status === 'PENDING' || task.status === 'ASSIGNED') && task.waveId === null;
}

/** Gợi ý vai trò cạnh tên trong ô "Gán cho…" — danh bạ giờ gồm cả nhân viên lấy / đóng hàng. */
const ROLE_HINT: Record<string, string> = {
  WAREHOUSE: 'kho',
  PICKER: 'lấy hàng',
  PACKER: 'đóng hàng',
};

export function staffLabel(s: WarehouseStaff): string {
  const hints = s.roles.map((r) => ROLE_HINT[r]).filter((h): h is string => Boolean(h));
  return hints.length > 0 ? `${s.fullName} · ${hints.join(', ')}` : s.fullName;
}

/** Thẻ gộp được thành lượt: PICK chưa gán, chưa thuộc lượt (server cũng chặn — INVALID_WAVE_INPUT). */
function waveable(t: Task): boolean {
  return t.type === 'PICK' && t.status === 'PENDING' && t.waveId === null;
}

/** Ô "Gán cho…" / "Trả về hàng đợi" của một dòng — chỉ khi có task.assign và việc không thuộc lượt. */
function RowActions({ task, staff }: { task: Task; staff: WarehouseStaff[] }) {
  const assign = useAssignTask();
  const unassign = useUnassignTask();
  if (task.waveId && (task.status === 'PENDING' || task.status === 'ASSIGNED')) {
    return (
      <span className="text-xs text-muted-foreground">
        <Layers className="inline h-3.5 w-3.5" aria-hidden /> Gán / đổi người cả lượt ở bảng
        &ldquo;Lượt lấy hàng gộp&rdquo; — không gán lẻ.
      </span>
    );
  }
  if (task.status === 'PENDING') {
    return (
      <Select
        value=""
        onValueChange={(userId) =>
          assign
            .mutateAsync({ taskId: task.id, userId })
            .then(() => toast.success(`Đã gán ${task.docNumber}`))
            .catch((err) => toast.error(messageFor(err)))
        }
        disabled={assign.isPending}
      >
        <SelectTrigger className="h-7 w-44 text-xs" aria-label={`Gán ${task.docNumber}`}>
          <SelectValue placeholder={assign.isPending ? 'Đang gán…' : 'Gán cho…'} />
        </SelectTrigger>
        <SelectContent>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {staffLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (task.status === 'ASSIGNED') {
    return (
      <button
        type="button"
        className="text-xs text-primary hover:underline disabled:opacity-50"
        disabled={unassign.isPending}
        onClick={() =>
          unassign
            .mutateAsync(task.id)
            .then(() => toast.success(`Đã trả ${task.docNumber} về hàng đợi`))
            .catch((err) => toast.error(messageFor(err)))
        }
      >
        {unassign.isPending ? 'Đang trả…' : 'Trả về hàng đợi'}
      </button>
    );
  }
  return null;
}

function buildColumns(
  tab: (typeof TABS)[number],
  staff: WarehouseStaff[] | null,
  selection: Selection | null,
  pageRows: Task[],
): ColumnDef<Task, unknown>[] {
  const pickable = selection ? pageRows.filter(selectable) : [];
  const pickedCount = pickable.filter((t) => selection!.ids.has(t.id)).length;
  const allChecked: boolean | 'indeterminate' =
    pickable.length > 0 && pickedCount === pickable.length
      ? true
      : pickedCount > 0
        ? 'indeterminate'
        : false;
  const selectCol: ColumnDef<Task, unknown>[] =
    selection && (tab.status === 'PENDING' || tab.status === 'ASSIGNED')
      ? [
          {
            id: 'select',
            meta: { width: 36 },
            header: () =>
              pickable.length > 0 ? (
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => selection.setMany(pickable, v === true)}
                  aria-label={`Chọn tất cả ${tab.title}`}
                />
              ) : null,
            cell: ({ row }) =>
              selectable(row.original) ? (
                <Checkbox
                  checked={selection.ids.has(row.original.id)}
                  onCheckedChange={() => selection.toggle(row.original)}
                  aria-label={`Chọn ${row.original.docNumber}`}
                />
              ) : null,
          },
        ]
      : [];
  return [
    ...selectCol,
    {
      id: 'docNumber',
      header: 'Việc',
      meta: { width: 170 },
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold">{row.original.docNumber}</span>
          {row.original.waveId ? (
            <Layers
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-label="Thuộc lượt pick gộp"
            />
          ) : null}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Loại',
      meta: { width: 110 },
      cell: ({ row }) => (
        <StatusBadge tone={taskTypeTone(row.original.type)}>
          {taskTypeLabel(row.original.type)}
        </StatusBadge>
      ),
    },
    {
      id: 'ref',
      header: 'Chứng từ',
      meta: { width: 100 },
      cell: ({ row }) =>
        row.original.refType === 'SalesOrder' && row.original.refId ? (
          <Link href={`/crm/orders/${row.original.refId}`} className="text-primary hover:underline">
            Đơn bán
          </Link>
        ) : (
          <span className="text-muted-foreground">{row.original.refType ?? '—'}</span>
        ),
    },
    {
      id: 'warehouse',
      header: 'Kho',
      meta: { width: 90 },
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.warehouseCode}</span>,
    },
    {
      id: 'lines',
      header: 'Dòng',
      meta: { align: 'right', width: 70 },
      cell: ({ row }) => row.original.lineCount,
    },
    {
      id: 'progress',
      header: 'Đã làm',
      meta: { align: 'right', width: 120 },
      cell: ({ row }) =>
        `${formatQuantity(row.original.qtyDone)}/${formatQuantity(row.original.qtyPlanned)}`,
    },
    {
      id: 'priority',
      header: 'Ưu tiên',
      meta: { align: 'right', width: 80 },
      cell: ({ row }) => row.original.priority,
    },
    {
      id: 'age',
      header: 'Chờ · tuổi',
      meta: { width: 150 },
      cell: ({ row }) => (
        <span
          className="text-xs text-muted-foreground"
          title={`Tạo lúc ${formatDateTime(row.original.createdAt)}`}
        >
          {row.original.status === 'PENDING' ? 'chờ' : 'đứng yên'}{' '}
          {formatMinutes(row.original.idleMinutes)} · tuổi {formatMinutes(row.original.ageMinutes)}
        </span>
      ),
    },
    {
      id: 'assignee',
      header: 'Người nhận',
      meta: { width: 150 },
      cell: ({ row }) => {
        const name = row.original.assigneeId
          ? (staff?.find((s) => s.id === row.original.assigneeId)?.fullName ?? null)
          : null;
        return name ?? <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'exception',
      header: 'Cảnh báo',
      meta: { width: 130 },
      cell: ({ row }) =>
        row.original.exceptionLineCount > 0 ? (
          <span
            className="flex items-center gap-1 rounded-sm bg-warning/15 px-1.5 text-xs font-semibold text-warning-foreground"
            title="Nhân viên báo thiếu hàng khi lấy — phần thiếu không sang đóng gói"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
            thiếu {row.original.exceptionLineCount} dòng
          </span>
        ) : row.original.status === 'EXCEPTION' ? (
          <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Ngoại lệ" />
        ) : null,
    },
    ...(staff
      ? [
          {
            id: 'actions',
            header: '',
            meta: { width: 200 },
            cell: ({ row }) => <RowActions task={row.original} staff={staff} />,
          } satisfies ColumnDef<Task, unknown>,
        ]
      : []),
  ];
}

/** Bảng của tab đang mở: 4 trạng thái (luật 13) + phân trang phía server (luật 8). */
function TaskTable({
  tab,
  query,
  staff,
  selection,
  page,
  size,
  onPage,
  onSize,
}: {
  tab: (typeof TABS)[number];
  query: ReturnType<typeof useTasks>;
  staff: WarehouseStaff[] | null;
  selection: Selection | null;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const columns = useMemo(
    () => buildColumns(tab, staff, selection, rows),
    [tab, staff, selection, rows],
  );
  return (
    <QueryState
      query={query}
      skeleton={
        <div role="status" aria-label="Đang tải việc">
          <ListSkeleton rows={8} columns={9} />
        </div>
      }
      isEmpty={(d) => d.items.length === 0}
      empty={
        <p className="rounded-md border px-3 py-8 text-center text-sm text-muted-foreground">
          Không có việc nào ở trạng thái này.
        </p>
      }
    >
      {(data) => (
        <DataTable
          columns={columns}
          rows={data.items}
          getRowId={(t) => t.id}
          total={data.total}
          page={page}
          size={size}
          sort={null}
          onPageChange={onPage}
          onSizeChange={onSize}
          onSortChange={() => undefined}
          stickyFirstColumn={false}
        />
      )}
    </QueryState>
  );
}

export function DispatchScreen() {
  const { state, set, skipTake } = useListState<DispatchFilter>(DEFAULTS);
  const status = parseStatus(state.filters.status);
  const merge = parseMerge(state.filters.merge);
  const tab = TABS.find((t) => t.status === status)!;
  const mergeTab = merge ? MERGE_TABS.find((t) => t.level === merge)! : null;
  const type = parseTaskType(state.filters.type);
  const warehouseId = state.filters.warehouseId ?? '';
  const assignedTo = state.filters.assignedTo ?? '';
  const lines = LINE_VALUES.has(state.filters.lines ?? '') ? state.filters.lines! : '';
  const ability = useAbility();
  const canAssign = ability.can('assign', 'Task');
  const staffQuery = useWarehouseStaff(canAssign);
  const staff = canAssign ? (staffQuery.data ?? null) : null;
  const warehouses = useWarehouses();

  // Chỉ tab đang mở gọi API — đổi tab mới gọi tab đó (không tải sẵn bốn trạng thái).
  const query = useTasks({
    status,
    type,
    warehouseId,
    assignedTo,
    ...lineFilter(lines),
    ...skipTake,
  });
  // Gợi ý gộp: luôn gọi (không lọc cấp) để hai tab hiện số nhóm; mở tab nào thì lọc đúng cấp đó.
  const suggestions = useWaveSuggestions({ warehouseId, packLevel: merge ?? undefined });

  // Giữ cả dòng (không chỉ id) để thanh công cụ biết lô đang chọn gộp lượt được hay chỉ gán;
  // lô chọn giữ khi đổi tab / đổi trang.
  const [selected, setSelected] = useState<Map<string, Task>>(new Map());
  const selection = useMemo<Selection | null>(
    () =>
      canAssign
        ? {
            ids: new Set(selected.keys()),
            toggle: (task) =>
              setSelected((cur) => {
                const next = new Map(cur);
                if (next.has(task.id)) next.delete(task.id);
                else next.set(task.id, task);
                return next;
              }),
            setMany: (tasks, on) =>
              setSelected((cur) => {
                const next = new Map(cur);
                for (const t of tasks) {
                  if (on) next.set(t.id, t);
                  else next.delete(t.id);
                }
                return next;
              }),
          }
        : null,
    [canAssign, selected],
  );

  // Luật 9: sự kiện việc chỉ invalidate prefix ['wms','tasks'], không vá cache bằng payload.
  useInvalidateOn(
    ['task.created', 'task.assigned', 'task.started', 'task.completed', 'task.exception'],
    [taskKeys.all, waveKeys.all],
  );
  const { connected } = useRealtime();

  const setFilter = (patch: Partial<Record<DispatchFilter, string | undefined>>) =>
    set({ filters: { ...state.filters, ...patch } });

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Điều phối kho"
        description="Việc gấp trước, cùng mức gấp thì việc cũ trước — đúng thứ tự API trả về."
        breadcrumb={[{ label: 'Kho' }, { label: 'Điều phối' }]}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                connected ? 'bg-success' : 'bg-muted-foreground',
              )}
              aria-hidden
            />
            {connected ? 'Realtime đang bật' : 'Chưa kết nối realtime'}
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={state.filters.type ?? ALL_TYPES}
          onValueChange={(v) => setFilter({ type: v === ALL_TYPES ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-52" aria-label="Loại việc">
            <SelectValue placeholder="Loại việc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Loại việc: tất cả</SelectItem>
            {TASK_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={lines || ALL_TYPES}
          onValueChange={(v) => setFilter({ lines: v === ALL_TYPES ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Số dòng SKU">
            <SelectValue placeholder="Số dòng SKU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Số SKU: tất cả</SelectItem>
            {LINE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={warehouseId || ALL_TYPES}
          onValueChange={(v) => setFilter({ warehouseId: v === ALL_TYPES ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-52" aria-label="Kho">
            <SelectValue placeholder="Kho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Kho: tất cả</SelectItem>
            {(warehouses.data ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {staff ? (
          <Select
            value={assignedTo || ALL_TYPES}
            onValueChange={(v) => setFilter({ assignedTo: v === ALL_TYPES ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-52" aria-label="Người nhận việc">
              <SelectValue placeholder="Người nhận việc" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>Người nhận: tất cả</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {staffLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Tab trạng thái trên URL — chỉ tab đang mở tải dữ liệu; số đếm là `total` của tab đó. */}
      <div className="flex border-b" role="tablist" aria-label="Trạng thái điều phối">
        {TABS.map((t) => {
          const active = merge === null && t.status === status;
          return (
            <button
              key={t.status}
              type="button"
              role="tab"
              aria-selected={active}
              title={t.hint}
              onClick={() =>
                setFilter({
                  status: t.status === 'PENDING' ? undefined : t.status,
                  merge: undefined,
                })
              }
              className={cn(
                '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.title}
              {active ? (
                <span className="rounded-full bg-muted px-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                  {query.data ? query.data.total : query.error ? '—' : '…'}
                </span>
              ) : null}
            </button>
          );
        })}
        {/* Tab gợi ý gộp: số nhóm hiện cả khi chưa mở — quản lý liếc là biết có gì để gộp. */}
        {MERGE_TABS.map((t) => {
          const active = merge === t.level;
          const count = suggestions.data
            ? t.level === 'PALLET'
              ? suggestions.data.palletCount
              : suggestions.data.cartonCount
            : null;
          return (
            <button
              key={t.level}
              type="button"
              role="tab"
              aria-selected={active}
              title={t.hint}
              onClick={() => setFilter({ merge: t.level, status: undefined })}
              className={cn(
                '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.title}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs font-normal tabular-nums',
                  count ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {count ?? (suggestions.error ? '—' : '…')}
              </span>
            </button>
          );
        })}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {mergeTab ? mergeTab.hint : tab.hint}
        </span>
      </div>

      {selection ? (
        <SelectionToolbar
          selected={[...selected.values()]}
          staff={staff ?? []}
          onDone={() => setSelected(new Map())}
        />
      ) : null}

      {merge ? (
        <SuggestionTable
          level={merge}
          query={suggestions}
          staff={staff ?? []}
          canAssign={canAssign}
          onGoPending={() => setFilter({ merge: undefined, status: undefined })}
        />
      ) : (
        <TaskTable
          tab={tab}
          query={query}
          staff={staff}
          selection={selection}
          page={state.page}
          size={state.size}
          onPage={(page) => set({ page })}
          onSize={(size) => set({ size })}
        />
      )}

      {canAssign ? <WavePanel warehouseId={warehouseId} staff={staff ?? []} /> : null}

      <p className="text-xs text-muted-foreground">
        Bảng này không có cờ &ldquo;quá hạn SLA&rdquo;: bảng việc trong kho chưa có cột hạn chót
        nào. Hai con số ở cột &ldquo;Chờ · tuổi&rdquo; là thời gian việc nằm im ở trạng thái hiện
        tại và tuổi việc tính từ lúc tạo — đúng như API trả về.
      </p>
    </div>
  );
}

/**
 * Thanh công cụ cho lô dòng đã tick (2026-09-16):
 *  - "Gán cho…" → POST /tasks/assign một lần cho cả lô (PENDING gán mới, ASSIGNED đổi người).
 *    Server làm từng việc; việc lỗi báo riêng, việc còn lại vẫn về tay người đó.
 *  - "Gộp thành một lượt" (PLAN-barcode-pick-pack E3) chỉ khi cả lô là PICK chưa gán, chưa
 *    thuộc lượt → POST /waves.
 */
function SelectionToolbar({
  selected,
  staff,
  onDone,
}: {
  selected: Task[];
  staff: WarehouseStaff[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [bulkUserId, setBulkUserId] = useState('');
  const create = useCreateWave();
  const assignBulk = useAssignTasksBulk();
  const selectedIds = selected.map((t) => t.id);
  const canWave = selected.length > 0 && selected.every(waveable);
  if (selected.length === 0) return null;
  const bulkAssign = () => {
    const who = staff.find((s) => s.id === bulkUserId);
    if (!who) return;
    assignBulk.mutate(
      { taskIds: selectedIds, userId: who.id },
      {
        onSuccess: (r) => {
          if (r.assigned.length > 0) {
            toast.success(`Đã gán ${r.assigned.length} việc cho ${who.fullName}`);
          }
          for (const f of r.failed) {
            toast.error(`${f.docNumber ?? f.taskId}: ${f.reason}`);
          }
          setBulkUserId('');
          onDone();
        },
        onError: (err) => toast.error(messageFor(err)),
      },
    );
  };
  return (
    <div
      role="region"
      aria-label="Việc đã chọn"
      className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
    >
      <Layers className="h-4 w-4 text-primary" aria-hidden />
      <span>
        Đã chọn <b>{selected.length}</b> việc
      </span>
      <Select value={bulkUserId} onValueChange={setBulkUserId} disabled={assignBulk.isPending}>
        <SelectTrigger className="h-8 w-56 text-xs" aria-label="Gán việc đã chọn cho">
          <SelectValue placeholder="Gán cho…" />
        </SelectTrigger>
        <SelectContent>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {staffLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!bulkUserId || assignBulk.isPending} onClick={bulkAssign}>
        {assignBulk.isPending ? 'Đang gán…' : `Gán ${selected.length} việc`}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!canWave}
        title={canWave ? undefined : 'Chỉ gộp được việc lấy hàng chưa gán, chưa thuộc lượt'}
        onClick={() => setOpen(true)}
      >
        Gộp thành một lượt
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Bỏ chọn
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gộp {selectedIds.length} việc thành một lượt lấy hàng</DialogTitle>
            <DialogDescription>
              Nhân viên đi một vòng kho, quét mã lượt rồi quét từng sản phẩm; hệ thống tự chia số
              lượng về từng đơn. Hàng về bàn đóng gói được tách theo đơn khi quét đóng gói.
            </DialogDescription>
          </DialogHeader>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-9" aria-label="Giao lượt cho">
              <SelectValue placeholder="Giao cho… (để trống = nhân viên tự quét nhận)" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {staffLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" disabled={create.isPending} onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { taskIds: selectedIds, ...(userId ? { assignedTo: userId } : {}) },
                  {
                    onSuccess: (w) => {
                      toast.success(`Đã gộp thành lượt ${w.docNumber}`);
                      setOpen(false);
                      setUserId('');
                      onDone();
                    },
                    onError: (err) => toast.error(messageFor(err)),
                  },
                )
              }
            >
              {create.isPending ? 'Đang gộp…' : 'Gộp thành một lượt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const WAVE_TAKE = 20;

/** Lượt pick gộp đang mở của kho — gán / trả về / in phiếu lượt. */
function WavePanel({ warehouseId, staff }: { warehouseId: string; staff: WarehouseStaff[] }) {
  const waves = useWaves({ warehouseId, take: WAVE_TAKE, skip: 0 });
  const [printId, setPrintId] = useState<string | null>(null);
  const printer = usePrint();
  const detail = useWaveDetail(printId);
  const assign = useAssignWave();
  const unassign = useUnassignWave();

  // Có chi tiết → mở tờ in đúng một lần cho lượt vừa bấm.
  const printing = printId !== null && detail.data?.id === printId;
  if (printing && !printer.open) printer.print();

  const items = (waves.data?.items ?? []).filter((w) => w.status !== 'CANCELLED');
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
        Lượt lấy hàng gộp
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {waves.data ? `${waves.data.total} lượt` : ''}
        </span>
      </header>
      <QueryState
        query={waves}
        skeleton={<Skeleton className="m-3 h-16" />}
        isEmpty={() => items.length === 0}
        empty={
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Chưa có lượt nào. Mở tab &ldquo;Đủ gộp thùng&rdquo; / &ldquo;Đủ gộp pallet&rdquo; để gộp
            nhóm đơn tròn thùng, hoặc tick các dòng &ldquo;Lấy hàng&rdquo; chưa gán rồi bấm
            &ldquo;Gộp thành một lượt&rdquo;.
          </p>
        }
      >
        {() => (
          <ul className="divide-y">
            {items.map((w) => (
              <WaveRow
                key={w.id}
                wave={w}
                staff={staff}
                onPrint={() => {
                  printer.done();
                  setPrintId(w.id);
                }}
                onAssign={(userId) =>
                  assign
                    .mutateAsync({ waveId: w.id, userId })
                    .then(() => toast.success(`Đã gán lượt ${w.docNumber}`))
                    .catch((err) => toast.error(messageFor(err)))
                }
                onUnassign={() =>
                  unassign
                    .mutateAsync(w.id)
                    .then(() => toast.success(`Đã trả lượt ${w.docNumber} về hàng đợi`))
                    .catch((err) => toast.error(messageFor(err)))
                }
              />
            ))}
          </ul>
        )}
      </QueryState>
      {printing && detail.data ? <WavePrintSheet wave={detail.data} printer={printer} /> : null}
    </section>
  );
}

function WaveRow({
  wave,
  staff,
  onPrint,
  onAssign,
  onUnassign,
}: {
  wave: Wave;
  staff: WarehouseStaff[];
  onPrint: () => void;
  onAssign: (userId: string) => void;
  onUnassign: () => void;
}) {
  const open = wave.status === 'PENDING' || wave.status === 'ASSIGNED';
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="font-mono font-semibold">{wave.docNumber}</span>
      <StatusBadge
        tone={
          wave.status === 'COMPLETED' ? 'ok' : wave.status === 'IN_PROGRESS' ? 'warn' : 'neutral'
        }
      >
        {taskStatusLabel(wave.status)}
      </StatusBadge>
      {wave.packLevel ? (
        <StatusBadge tone="brand">
          {mergeLabel(wave.packLevel, wave.packCount)}
          {wave.skuCode ? ` · ${wave.skuCode}` : ''}
        </StatusBadge>
      ) : null}
      <span className="text-muted-foreground">
        {wave.taskDoneCount}/{wave.taskCount} đơn · {formatQuantity(wave.qtyDone)}/
        {formatQuantity(wave.qtyPlanned)}
        {wave.assigneeName ? ` · ${wave.assigneeName}` : ''}
      </span>
      <span className="ml-auto flex items-center gap-1">
        {open ? (
          <Select value="" onValueChange={onAssign}>
            <SelectTrigger className="h-7 w-40 text-xs" aria-label={`Gán lượt ${wave.docNumber}`}>
              <SelectValue placeholder={wave.assigneeName ? 'Đổi người…' : 'Gán cho…'} />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {staffLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {wave.status === 'ASSIGNED' ? (
          <Button size="sm" variant="ghost" onClick={onUnassign}>
            Trả về
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onPrint}>
          <Printer aria-hidden />
          In phiếu lượt
        </Button>
      </span>
    </li>
  );
}

/**
 * Bảng nhóm gợi ý gộp của tab `?merge=` (PLAN-packaging-hierarchy §12): mỗi dòng một nhóm đơn
 * một SKU cộng đúng N thùng / một pallet; bấm "N đơn" bung danh sách đơn con; "Gộp và gán" mở
 * dialog chọn người (chỉ khi có task.assign). 4 trạng thái theo luật 13.
 */
function SuggestionTable({
  level,
  query,
  staff,
  canAssign,
  onGoPending,
}: {
  level: WavePackLevel;
  query: ReturnType<typeof useWaveSuggestions>;
  staff: WarehouseStaff[];
  canAssign: boolean;
  onGoPending: () => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [merging, setMerging] = useState<WaveSuggestion | null>(null);
  return (
    <>
      <QueryState
        query={query}
        skeleton={
          <div role="status" aria-label="Đang tải gợi ý gộp">
            <ListSkeleton rows={4} columns={6} />
          </div>
        }
        isEmpty={(d) => d.items.length === 0}
        empty={
          <div className="rounded-md border px-3 py-8 text-center text-sm text-muted-foreground">
            <p>
              {level === 'PALLET'
                ? 'Chưa có nhóm đơn nào cộng đúng một pallet.'
                : 'Chưa có nhóm đơn nào cộng tròn thùng.'}{' '}
              Đơn lẻ và đơn nhiều SKU nằm ở tab &ldquo;Chưa gán&rdquo; — gán tay.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={onGoPending}>
              Xem Chưa gán
            </Button>
          </div>
        }
      >
        {(data) => (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Cấp đóng gói</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                  <TableHead className="text-right">Tổng số lượng</TableHead>
                  <TableHead>Đơn cũ nhất</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((g) => {
                  const open = openKey === g.key;
                  return (
                    <Fragment key={g.key}>
                      <TableRow>
                        <TableCell>
                          <span className="font-mono font-semibold">{g.skuCode}</span>
                          <span className="ml-2 text-muted-foreground">{g.skuName}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone="brand">
                            {mergeLabel(g.packLevel, g.packCount)}
                          </StatusBadge>
                          <span className="ml-2 text-xs text-muted-foreground">
                            1 {g.packLevel === 'PALLET' ? 'pallet' : 'thùng'} ={' '}
                            {formatQuantity(g.unitsPerPack)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenKey(open ? null : g.key)}
                            className="inline-flex items-center gap-1 tabular-nums underline-offset-2 hover:underline"
                          >
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {g.taskCount} đơn
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQuantity(g.qtyPlanned)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(g.oldestCreatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canAssign ? (
                            <Button size="sm" onClick={() => setMerging(g)}>
                              Gộp và gán
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6}>
                            <ul
                              aria-label={`Đơn trong nhóm ${g.skuCode}`}
                              className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3"
                            >
                              {g.tasks.map((t) => (
                                <li key={t.taskId} className="flex items-center gap-2">
                                  <span className="font-mono">{t.docNumber}</span>
                                  {t.refDocNumber ? (
                                    <span className="text-muted-foreground">
                                      đơn {t.refDocNumber}
                                    </span>
                                  ) : null}
                                  <span className="ml-auto tabular-nums">
                                    {formatQuantity(t.qtyPlanned)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDateTime(t.createdAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {merging ? (
        <MergeDialog group={merging} staff={staff} onClose={() => setMerging(null)} />
      ) : null}
    </>
  );
}

/** 409 WAVE_SUGGESTION_STALE: nêu thêm mã việc không còn hợp lệ (dữ liệu, không phải message thô). */
function staleMessage(err: unknown): string {
  const base = messageFor(err);
  if (isApiError(err) && err.code === 'WAVE_SUGGESTION_STALE') {
    const tasks = (err.details as { tasks?: { docNumber?: string }[] } | undefined)?.tasks ?? [];
    const docs = tasks.map((t) => t.docNumber).filter((d): d is string => Boolean(d));
    if (docs.length) return `${base} Đơn không còn hợp lệ: ${docs.join(', ')}.`;
  }
  return base;
}

/** Dialog "Gộp và gán" cho một nhóm gợi ý → POST /waves/merge (server kiểm lại từng đơn). */
function MergeDialog({
  group,
  staff,
  onClose,
}: {
  group: WaveSuggestion;
  staff: WarehouseStaff[];
  onClose: () => void;
}) {
  const [userId, setUserId] = useState('');
  const merge = useMergeWaveSuggestion();
  const submit = () =>
    merge.mutate(
      {
        skuId: group.skuId,
        packLevel: group.packLevel,
        packCount: group.packCount,
        taskIds: group.tasks.map((t) => t.taskId),
        ...(userId ? { assignedTo: userId } : {}),
      },
      {
        onSuccess: (w) => {
          toast.success(`Đã gộp ${group.taskCount} đơn thành lượt ${w.docNumber}`);
          onClose();
        },
        onError: (err) => toast.error(staleMessage(err)),
      },
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !merge.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Gộp {group.taskCount} đơn — {mergeLabel(group.packLevel, group.packCount)} ·{' '}
            {group.skuCode}
          </DialogTitle>
          <DialogDescription>
            Người lấy quét{' '}
            {group.packLevel === 'PALLET' ? 'mã pallet' : `${group.packCount} mã thùng`} thay vì
            từng sản phẩm; bàn đóng gói chia về từng đơn khi quét đóng gói. Hệ thống kiểm lại từng
            đơn lúc gộp — có đơn đã huỷ hoặc đã gán thì không gộp, tải lại gợi ý.
          </DialogDescription>
        </DialogHeader>
        <Select value={userId} onValueChange={setUserId} disabled={merge.isPending}>
          <SelectTrigger className="h-9" aria-label="Giao lượt cho">
            <SelectValue placeholder="Giao cho… (để trống = lượt nằm ở Chưa gán)" />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {staffLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" disabled={merge.isPending} onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button disabled={merge.isPending} onClick={submit}>
            {merge.isPending ? 'Đang gộp…' : 'Gộp và gán'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
