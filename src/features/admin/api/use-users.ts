import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/schema';

export type UserListItem = components['schemas']['UserListItemDto'];
export type UserDetail = components['schemas']['UserDetailDto'];
export type UserPermissions = components['schemas']['UserPermissionsDto'];
export type UserPermissionEntry = components['schemas']['UserPermissionEntryDto'];
export type CreateUserInput = components['schemas']['CreateUserDto'];
export type UpdateUserInput = components['schemas']['UpdateUserDto'];

export type UserSortBy = NonNullable<
  NonNullable<paths['/users']['get']['parameters']['query']>['sortBy']
>;
export type UserSortDir = NonNullable<
  NonNullable<paths['/users']['get']['parameters']['query']>['sortDir']
>;

export interface UserListParams {
  q?: string;
  roleCode?: string;
  isActive?: boolean;
  sortBy?: UserSortBy;
  sortDir?: UserSortDir;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['admin','users','list', params]. */
export const userKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (p: UserListParams) => [...userKeys.lists(), p] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  permissions: (id: string) => [...userKeys.detail(id), 'permissions'] as const,
};

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/users', {
          params: {
            query: {
              q: params.q || undefined,
              roleCode: params.roleCode,
              isActive: params.isActive,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

const SORTABLE: readonly UserSortBy[] = ['code', 'fullName', 'email', 'createdAt', 'updatedAt'];

export function toUserSort(sort: { id: string; desc: boolean } | null): {
  sortBy?: UserSortBy;
  sortDir?: UserSortDir;
} {
  if (!sort || !(SORTABLE as readonly string[]).includes(sort.id)) return {};
  return { sortBy: sort.id as UserSortBy, sortDir: sort.desc ? 'desc' : 'asc' };
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => unwrap(api.GET('/users/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => unwrap(api.POST('/users', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) =>
      unwrap(api.PATCH('/users/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.lists() });
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

export function useUserPermissions(id: string) {
  return useQuery({
    queryKey: userKeys.permissions(id),
    queryFn: () => unwrap(api.GET('/users/{id}/permissions', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

export function useUpdateUserPermissions(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { allow: string[]; deny: string[] }) =>
      unwrap(api.PUT('/users/{id}/permissions', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

/** Thay toàn bộ role của user (PUT /users/:id/roles). */
export function useAssignRoles(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roles: string[]) =>
      unwrap(api.PUT('/users/{id}/roles', { params: { path: { id } }, body: { roles } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.lists() });
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}
