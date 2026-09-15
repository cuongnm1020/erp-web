import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type Task = components['schemas']['TaskRowDto'];
export type TaskStatus = Task['status'];
export type TaskType = Task['type'];
export type WarehouseStaff = components['schemas']['TaskAssigneeDto'];
export type AssignTasksBulkResult = components['schemas']['AssignTasksBulkResultDto'];
export type TaskDetail = components['schemas']['TaskDetailDto'];
export type TaskLine = components['schemas']['TaskLineDto'];

export interface TaskListParams {
  status?: TaskStatus;
  type?: TaskType;
  warehouseId?: string;
  assignedTo?: string;
  /** Chứng từ nguồn: "SalesOrder" + id đơn → mọi việc của một đơn. */
  refType?: string;
  refId?: string;
  /** Tra đúng một số việc (PICK-…, PACK-…). */
  docNumber?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['wms','tasks','list', params]. Invalidate theo prefix. */
export const taskKeys = {
  all: ['wms', 'tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (p: TaskListParams) => [...taskKeys.lists(), p] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * GET /tasks — bảng điều phối. API sắp `priority` giảm dần rồi `createdAt` tăng dần:
 * gấp trước, cùng mức gấp thì việc cũ trước.
 *
 * `wms.Task` KHÔNG có cột hạn chót/SLA, nên API trả `ageMinutes` (tuổi việc) và
 * `idleMinutes` (nằm im ở trạng thái hiện tại) thay vì cờ "quá hạn". Màn hình hiển thị
 * đúng hai con số đó — không dựng cờ SLA giả.
 */
export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/tasks', {
          params: {
            query: {
              status: params.status,
              type: params.type,
              warehouseId: params.warehouseId || undefined,
              assignedTo: params.assignedTo || undefined,
              refType: params.refType || undefined,
              refId: params.refId || undefined,
              docNumber: params.docNumber || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /tasks/:id — chi tiết + dòng (đã sắp theo pickSequence) cho in phiếu pick / trạm đóng gói. */
export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId ?? ''),
    queryFn: () => unwrap(api.GET('/tasks/{id}', { params: { path: { id: taskId ?? '' } } })),
    enabled: taskId !== null && taskId !== '',
  });
}

/**
 * Task PICK của một đơn bán — `GET /tasks?refType=SalesOrder&refId=…&type=PICK`. Một đơn
 * chỉ có một task PICK (task engine dedupe theo refId) nên lấy phần tử đầu; null = chưa sinh.
 */
export function usePickTaskOfOrder(orderId: string | null) {
  const params: TaskListParams = {
    refType: 'SalesOrder',
    refId: orderId ?? '',
    type: 'PICK',
    take: 1,
    skip: 0,
  };
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: async () => {
      const r = await unwrap(
        api.GET('/tasks', {
          params: {
            query: {
              refType: params.refType,
              refId: params.refId,
              type: params.type,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      );
      return r.items[0] ?? null;
    },
    enabled: orderId !== null && orderId !== '',
  });
}

/**
 * Danh bạ người nhận việc — GET /tasks/assignees (cần task.assign, KHÔNG cần
 * user.read: supervisor kho không có quyền danh bạ chung).
 */
export function useWarehouseStaff(enabled: boolean) {
  return useQuery({
    queryKey: [...taskKeys.all, 'assignees'] as const,
    queryFn: () => unwrap(api.GET('/tasks/assignees')),
    enabled,
    staleTime: 60_000,
  });
}

/** POST /tasks/:id/assign — PENDING → ASSIGNED; server chặn user khóa / việc đang làm. */
export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      unwrap(
        api.POST('/tasks/{id}/assign', { params: { path: { id: taskId } }, body: { userId } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/**
 * POST /tasks/assign — gán NHIỀU việc cho một người (chọn nhiều thẻ). Server làm từng việc,
 * việc lỗi nằm trong `failed` kèm lý do; lô không rollback nên luôn invalidate.
 */
export function useAssignTasksBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, userId }: { taskIds: string[]; userId: string }) =>
      unwrap(api.POST('/tasks/assign', { body: { taskIds, userId } })),
    onSettled: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** POST /tasks/:id/unassign — ASSIGNED → PENDING (đổi người / nghỉ ca). */
export function useUnassignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      unwrap(api.POST('/tasks/{id}/unassign', { params: { path: { id: taskId } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
