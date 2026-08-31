import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Team = components['schemas']['TeamDto'];

/**
 * GET /teams — danh mục nhỏ, ít đổi trong phiên → staleTime 5 phút.
 * Bản riêng của feature customers (luật 12: cấm import chéo từ features/orders).
 * Query key theo phễu (luật 3): ['crm','customers','teams'].
 */
export const customerTeamKeys = {
  teams: () => ['crm', 'customers', 'teams'] as const,
};

export function useTeams(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: customerTeamKeys.teams(),
    queryFn: () => unwrap(api.GET('/teams')),
    staleTime: 300_000,
    enabled: opts.enabled ?? true,
  });
}
