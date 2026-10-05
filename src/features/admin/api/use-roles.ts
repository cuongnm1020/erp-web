import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Role = components['schemas']['RoleDto'];
export type UpdateRoleInput = components['schemas']['UpdateRoleDto'];
export type CreateRoleInput = components['schemas']['CreateRoleDto'];

export const roleKeys = {
  all: ['admin', 'roles'] as const,
};

/** `enabled: false` khi người xem không có role.read (trưởng phòng thêm nhân sự) — tránh 403 vô ích. */
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: () => unwrap(api.GET('/roles')),
    enabled,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => unwrap(api.POST('/roles', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

/** DELETE /roles/{code} — vai trò còn người giữ → 409 ROLE_IN_USE (gỡ khỏi họ trước). */
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      unwrap(api.DELETE('/roles/{code}', { params: { path: { code } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, ...input }: UpdateRoleInput & { code: string }) =>
      unwrap(api.PUT('/roles/{code}', { params: { path: { code } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: roleKeys.all });
    },
  });
}
