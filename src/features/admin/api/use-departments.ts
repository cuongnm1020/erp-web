import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { orgTreeKeys } from './use-org-tree';
import { userKeys } from './use-users';

export type Department = components['schemas']['DepartmentDto'];
export type CreateDepartmentInput = components['schemas']['CreateDepartmentDto'];
export type UpdateDepartmentInput = components['schemas']['UpdateDepartmentDto'];
export type Team = components['schemas']['TeamDto'];

/** Query key theo phễu (luật 3): ['admin','departments']. */
export const departmentKeys = {
  all: ['admin', 'departments'] as const,
  teams: () => ['admin', 'teams'] as const,
};

/**
 * GET /departments — cây phòng ban kèm số nhân viên (`_count.members`). Danh mục nhỏ, cache 5 phút.
 * `enabled: false` khi màn không cần (trưởng phòng không có user.read — tránh 403 vô ích).
 */
export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: () => unwrap(api.GET('/departments')),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * GET /teams — danh bạ team CHỈ ĐỌC cho màn Phòng ban & team (bản riêng của admin, luật 12:
 * không import chéo từ features/customers). Quản trị team (tạo/sửa/gán member) chưa có API.
 */
export function useAdminTeams() {
  return useQuery({
    queryKey: departmentKeys.teams(),
    queryFn: () => unwrap(api.GET('/teams')),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => unwrap(api.POST('/departments', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all });
      void qc.invalidateQueries({ queryKey: orgTreeKeys.all });
    },
  });
}

/** PATCH /departments/{id} — đổi tên / cha / trưởng phòng / ngừng hoạt động. Server chặn vòng (422). */
export function useUpdateDepartment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) =>
      unwrap(api.PATCH('/departments/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all });
      void qc.invalidateQueries({ queryKey: userKeys.all });
      void qc.invalidateQueries({ queryKey: orgTreeKeys.all });
    },
  });
}

/** PUT /departments/{id}/users/{userId} — chuyển nhân viên vào phòng ban (mỗi người một phòng ban). */
export function useAssignUserToDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ departmentId, userId }: { departmentId: string; userId: string }) =>
      unwrap(
        api.PUT('/departments/{id}/users/{userId}', {
          params: { path: { id: departmentId, userId } },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all });
      void qc.invalidateQueries({ queryKey: userKeys.all });
      void qc.invalidateQueries({ queryKey: orgTreeKeys.all });
    },
  });
}

/** DELETE /departments/{id} — chỉ phòng ban trống; còn con / nhân sự → 409 DEPARTMENT_NOT_EMPTY. */
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/departments/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all });
      void qc.invalidateQueries({ queryKey: orgTreeKeys.all });
    },
  });
}

/** Gỡ khỏi phòng ban = PATCH /users/{id} { departmentId: null }. */
export function useRemoveUserFromDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        api.PATCH('/users/{id}', {
          params: { path: { id: userId } },
          body: { departmentId: null },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: departmentKeys.all });
      void qc.invalidateQueries({ queryKey: userKeys.all });
      void qc.invalidateQueries({ queryKey: orgTreeKeys.all });
    },
  });
}
