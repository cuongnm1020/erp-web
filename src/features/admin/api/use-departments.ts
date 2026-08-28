import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Department = components['schemas']['DepartmentDto'];

export function useDepartments() {
  return useQuery({
    queryKey: ['admin', 'departments'] as const,
    queryFn: () => unwrap(api.GET('/departments')),
    staleTime: 5 * 60 * 1000,
  });
}
