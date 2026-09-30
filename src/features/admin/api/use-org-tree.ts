import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type OrgTree = components['schemas']['OrgTreeDto'];
export type OrgDepartmentNode = components['schemas']['OrgDepartmentNodeDto'];
export type OrgTeamNode = components['schemas']['OrgTeamNodeDto'];
export type OrgEmployee = components['schemas']['OrgEmployeeDto'];
export type OrgTeamMember = components['schemas']['OrgTeamMemberDto'];

/** Query key theo phễu (luật 3): ['admin','org-tree', { includeInactive }]. */
export const orgTreeKeys = {
  all: ['admin', 'org-tree'] as const,
  tree: (includeInactive: boolean) => [...orgTreeKeys.all, { includeInactive }] as const,
};

/**
 * GET /org/tree — cây nhân sự theo phòng ban & team, server đã lồng sẵn theo `parentId`.
 * Danh bạ nội bộ (vài trăm người) nên trả nguyên cây, không phân trang; cache 1 phút và
 * bị invalidate khi đổi phòng ban / nhân viên (use-departments, use-users).
 */
export function useOrgTree(includeInactive = false) {
  return useQuery({
    queryKey: orgTreeKeys.tree(includeInactive),
    queryFn: () => unwrap(api.GET('/org/tree', { params: { query: { includeInactive } } })),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
