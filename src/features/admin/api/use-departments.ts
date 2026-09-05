import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
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

/** GET /departments — cây phòng ban kèm số nhân viên (`_count.members`). Danh mục nhỏ, cache 5 phút. */
export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: () => unwrap(api.GET('/departments')),
    staleTime: 5 * 60 * 1000,
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: departmentKeys.all }),
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
    },
  });
}

/** Gỡ khỏi phòng ban = PATCH /users/{id} { departmentId: null } — API phòng ban không có DELETE. */
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
    },
  });
}
