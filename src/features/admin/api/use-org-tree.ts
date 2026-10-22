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

export type CareStaffList = components['schemas']['CareStaffListDto'];
export type CareStaff = components['schemas']['CareStaffDto'];

/**
 * GET /org/care-staff — nhân viên các phòng CSKH người gọi phụ trách (màn "Nhân viên của team",
 * 2026-10-22). Key dưới prefix org-tree: thêm / sửa / khóa nhân viên (use-users) tải lại luôn.
 */
export function useCareStaff(includeInactive: boolean) {
  return useQuery({
    queryKey: [...orgTreeKeys.all, 'care-staff', { includeInactive }] as const,
    queryFn: () => unwrap(api.GET('/org/care-staff', { params: { query: { includeInactive } } })),
    placeholderData: keepPreviousData,
  });
}

export type StaffRevenue = components['schemas']['SalesByStaffItemDto'];

/**
 * Doanh thu theo người phụ trách trong kỳ — GET /reports/sales/by-staff?groupBy=owner (API đã lọc
 * theo team trưởng nhóm, bất biến 8 / D-CR2). Key dưới prefix ['reports','sales'] như màn báo cáo.
 */
export function useStaffRevenue(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'sales', 'care-staff', { from, to }] as const,
    queryFn: () =>
      unwrap(
        api.GET('/reports/sales/by-staff', {
          params: { query: { from, to, groupBy: 'owner' } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}
