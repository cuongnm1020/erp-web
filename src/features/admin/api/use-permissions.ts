import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Permission = components['schemas']['PermissionDto'];

/** Catalog quyền gần như tĩnh → staleTime dài. */
export function usePermissions() {
  return useQuery({
    queryKey: ['admin', 'permissions'] as const,
    queryFn: () => unwrap(api.GET('/permissions')),
    staleTime: 10 * 60 * 1000,
  });
}
