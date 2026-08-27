'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useInvalidateOn, useRealtime } from '@/lib/realtime';
import { useListState } from '@/lib/url-state';
import { taskKeys, useTasks, type Task, type TaskStatus, type TaskType } from '../api/use-tasks';
import {
  TASK_TYPE_OPTIONS,
  formatMinutes,
  parseTaskType,
  taskTypeLabel,
  taskTypeTone,
} from '../labels';

/**
 * G-06 Bảng điều phối kho — GET /tasks, mỗi làn là một truy vấn theo `status`.
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
 * - Làn "Hoàn thành hôm nay": `GET /tasks` không lọc theo ngày, làn COMPLETED sẽ là "mọi
 *   việc đã xong từ trước tới nay" — gắn nhãn "hôm nay" là nói sai.
 * - Bảng nhân viên (tên, ca trực, tiến độ từng người): chỉ có `assigneeId` (UUID), chưa có
 *   danh bạ user và không có dữ liệu ca trực.
 * - Số chứng từ nguồn (SO-…/GRN-…): DTO trả `refType` + `refId` (UUID), không trả số chứng
 *   từ; hiện link "Đơn bán" theo id thay vì bịa một số chứng từ.
 * - "Ưu tiên Cao/TB/Thấp": `priority` là số nguyên, không có thang bậc nào được định nghĩa;
 *   hiện đúng con số.
 * - Kéo thả để gán việc: chưa có endpoint giao việc.
 * - Chọn kho: `GET /warehouses` chưa khai kiểu response nên chưa dựng được danh sách chọn;
 *   `warehouseId` và `assignedTo` vẫn đọc từ URL để dán link được (luật 8).
 */
const LANE_SIZE = 20;
const DEFAULTS = { size: LANE_SIZE, filterKeys: ['type', 'warehouseId', 'assignedTo'] as const };
const ALL_TYPES = '__all__';

type DispatchFilter = (typeof DEFAULTS.filterKeys)[number];

interface LaneParams {
  type: TaskType | undefined;
  warehouseId: string;
  assignedTo: string;
}

const LANES: Array<{ status: TaskStatus; title: string; hint: string }> = [
  { status: 'PENDING', title: 'Chưa gán', hint: 'chờ người nhận' },
  { status: 'ASSIGNED', title: 'Đã giao', hint: 'đã có người, chưa bắt đầu' },
  { status: 'IN_PROGRESS', title: 'Đang làm', hint: 'đang quét trên PDA' },
  { status: 'EXCEPTION', title: 'Ngoại lệ', hint: 'thiếu hàng · sai lô · hỏng' },
];

function useLane(status: TaskStatus, p: LaneParams) {
  return useTasks({
    status,
    type: p.type,
    warehouseId: p.warehouseId,
    assignedTo: p.assignedTo,
    take: LANE_SIZE,
    skip: 0,
  });
}

function TaskCard({ task }: { task: Task }) {
  const idleWord = task.status === 'PENDING' ? 'chờ' : 'đứng yên';
  return (
    <article className="flex flex-col gap-1 rounded-md border bg-card px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{task.docNumber}</span>
        <StatusBadge tone={taskTypeTone(task.type)}>{taskTypeLabel(task.type)}</StatusBadge>
        {task.status === 'EXCEPTION' ? (
          <AlertTriangle className="ml-auto h-3.5 w-3.5 text-warning" aria-hidden />
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {task.lineCount} dòng · đã làm {formatQuantity(task.qtyDone)}/
        {formatQuantity(task.qtyPlanned)}
        {task.refType === 'SalesOrder' && task.refId ? (
          <>
            {' · '}
            <Link href={`/crm/orders/${task.refId}`} className="text-primary hover:underline">
              Đơn bán
            </Link>
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Ưu tiên {task.priority}</span>
        <span title={`Tạo lúc ${formatDateTime(task.createdAt)}`}>
          {idleWord} {formatMinutes(task.idleMinutes)} · tuổi {formatMinutes(task.ageMinutes)}
        </span>
      </div>
    </article>
  );
}

function LaneSkeleton() {
  return (
    <div role="status" aria-label="Đang tải việc" className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[74px] w-full" />
      ))}
    </div>
  );
}

/** Ô chỉ số dùng chính `total` của truy vấn làn tương ứng — không đếm lại ở frontend. */
function LaneCount({
  label,
  status,
  params,
}: {
  label: string;
  status: TaskStatus;
  params: LaneParams;
}) {
  const query = useLane(status, params);
  return (
    <KpiCard
      label={label}
      value={
        query.error ? '—' : query.data ? query.data.total : <Skeleton className="mt-1 h-5 w-12" />
      }
      detail={query.error ? 'không đếm được, xem lỗi ở làn bên dưới' : 'việc đang ở trạng thái này'}
    />
  );
}

function Lane({
  title,
  hint,
  status,
  params,
}: {
  title: string;
  hint: string;
  status: TaskStatus;
  params: LaneParams;
}) {
  const query = useLane(status, params);
  return (
    <section className="flex min-h-64 flex-col rounded-md border bg-muted/50">
      <header className="flex items-baseline gap-2 border-b px-3 py-2 text-sm font-semibold">
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{hint}</span>
      </header>
      <QueryState
        query={query}
        skeleton={<LaneSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Không có việc nào ở trạng thái này.
          </p>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-2 p-2">
            {data.items.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
            {data.total > data.items.length ? (
              <p className="px-1 pb-1 text-xs text-muted-foreground">
                Hiện {data.items.length} việc gấp nhất trong tổng {data.total}.
              </p>
            ) : null}
          </div>
        )}
      </QueryState>
    </section>
  );
}

export function DispatchScreen() {
  const { state, set } = useListState<DispatchFilter>(DEFAULTS);
  const type = parseTaskType(state.filters.type);
  const warehouseId = state.filters.warehouseId ?? '';
  const assignedTo = state.filters.assignedTo ?? '';
  const params = useMemo<LaneParams>(
    () => ({ type, warehouseId, assignedTo }),
    [type, warehouseId, assignedTo],
  );

  // Luật 9: sự kiện việc chỉ invalidate prefix ['wms','tasks'], không vá cache bằng payload.
  useInvalidateOn(
    ['task.created', 'task.assigned', 'task.started', 'task.completed', 'task.exception'],
    [taskKeys.all],
  );
  const { connected } = useRealtime();

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
          onValueChange={(v) =>
            set({ filters: { ...state.filters, type: v === ALL_TYPES ? undefined : v } })
          }
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
        <span className="text-xs text-muted-foreground">
          Lọc theo kho và theo người nhận việc đọc từ URL (`warehouseId`, `assignedTo`) — chưa có
          danh sách chọn vì API kho và danh bạ user chưa khai kiểu.
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((l) => (
          <LaneCount key={l.status} label={l.title} status={l.status} params={params} />
        ))}
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((l) => (
          <Lane key={l.status} title={l.title} hint={l.hint} status={l.status} params={params} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Bảng này không có cờ &ldquo;quá hạn SLA&rdquo;: bảng việc trong kho chưa có cột hạn chót
        nào. Hai con số trên mỗi thẻ là thời gian việc nằm im ở trạng thái hiện tại và tuổi việc
        tính từ lúc tạo — đúng như API trả về.
      </p>
    </div>
  );
}
