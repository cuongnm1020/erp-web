import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

export type AssignmentTeam = components['schemas']['TeamAssignmentSummaryDto'];
export type TeamMemberLoad = components['schemas']['TeamMemberLoadDto'];
export type AssignCustomersInput = components['schemas']['AssignCustomersDto'];
export type AssignCustomersResult = components['schemas']['AssignCustomersResultDto'];
export type CustomerAssignment = components['schemas']['CustomerAssignmentDto'];

export interface AssignmentHistoryParams {
  customerId?: string;
  teamId?: string;
  activeOnly?: boolean;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3) — nằm dưới ['crm','customers'] để invalidate chung với khách. */
export const assignmentKeys = {
  all: [...customerKeys.all, 'assignments'] as const,
  teams: () => [...assignmentKeys.all, 'teams'] as const,
  members: (teamId: string) => [...assignmentKeys.all, 'members', teamId] as const,
  histories: () => [...assignmentKeys.all, 'history'] as const,
  history: (p: AssignmentHistoryParams) => [...assignmentKeys.histories(), p] as const,
};

/** GET /customer-assignments/teams — team mình lead kèm số khách trong team / chưa chia. */
export function useAssignmentTeams() {
  return useQuery({
    queryKey: assignmentKeys.teams(),
    queryFn: () => unwrap(api.GET('/customer-assignments/teams')),
  });
}

/** GET /customer-assignments/teams/{teamId}/members — thành viên + số khách đang giữ. */
export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: assignmentKeys.members(teamId),
    queryFn: () =>
      unwrap(
        api.GET('/customer-assignments/teams/{teamId}/members', {
          params: { path: { teamId } },
        }),
      ),
    enabled: teamId !== '',
  });
}

/** GET /customer-assignments — lịch sử (ledger) theo khách hoặc theo team. */
export function useAssignmentHistory(
  params: AssignmentHistoryParams,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: assignmentKeys.history(params),
    queryFn: () =>
      unwrap(
        api.GET('/customer-assignments', {
          params: {
            query: {
              customerId: params.customerId,
              teamId: params.teamId,
              activeOnly: params.activeOnly,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    enabled: (opts.enabled ?? true) && (!!params.customerId || !!params.teamId),
  });
}

/**
 * POST /customer-assignments — gán lô khách cho một sale (userId null = trả về chưa phân).
 * Không optimistic: projection teamIds/ownerIds quyết định ai thấy khách (luật 5/7) — chờ
 * server rồi invalidate danh sách khách + tải thành viên + lịch sử.
 */
export function useAssignCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignCustomersInput) =>
      unwrap(api.POST('/customer-assignments', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerKeys.lists() });
      void qc.invalidateQueries({ queryKey: assignmentKeys.all });
    },
  });
}
