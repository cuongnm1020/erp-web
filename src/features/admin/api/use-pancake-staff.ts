import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type PancakeStaff = components['schemas']['PancakeStaffDto'];
export type StaffCandidate = components['schemas']['StaffCandidateDto'];
export type RelinkStaffInput = components['schemas']['RelinkStaffDto'];
export type RelinkStaffResult = components['schemas']['RelinkStaffResultDto'];
export type StaffCleanupResult = components['schemas']['StaffCleanupResultDto'];

/** Query key theo phễu (luật 3): ['pancake-staff', …]. */
export const pancakeStaffKeys = {
  all: ['pancake-staff'] as const,
  list: (pending: boolean) =>
    [...pancakeStaffKeys.all, 'list', pending ? 'pending' : 'all'] as const,
  candidates: (q: string) => [...pancakeStaffKeys.all, 'candidates', q] as const,
};

/**
 * GET /pancake-sync/staff — nhân viên Pancake mọi POS + tài khoản ERP đang gắn (sync.staff_read).
 * `pending` = chỉ người chưa có tài khoản thật (còn chờ / đang ở tài khoản tự tạo pc.*).
 */
export function usePancakeStaff(pending: boolean, enabled = true) {
  return useQuery({
    queryKey: pancakeStaffKeys.list(pending),
    queryFn: () =>
      unwrap(
        api.GET('/pancake-sync/staff', {
          params: { query: pending ? { pending: true } : {} },
        }),
      ),
    enabled,
  });
}

/**
 * GET /pancake-sync/staff/candidates?q= — tài khoản thật người gọi được gắn vào (trưởng nhóm: nhân
 * sự phòng mình; quản trị: mọi người). Dạng EntitySearchResult cho EntityPicker.
 */
export function useStaffCandidateSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: pancakeStaffKeys.candidates(q),
    queryFn: () =>
      unwrap(
        api.GET('/pancake-sync/staff/candidates', {
          params: { query: q ? { q } : {} },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.map((u) => ({
    id: u.id,
    label: u.fullName,
    hint: u.departmentName ? `${u.code} · ${u.departmentName}` : u.code,
  }));
  return { options, isPending: query.isPending, error: query.error };
}

/**
 * POST /pancake-sync/staff/relink — gắn nhân viên Pancake vào tài khoản thật (mọi POS). Tài khoản
 * pc.* đang giữ người đó → gộp: đơn + khách chuyển ngay, pc.* xoá mềm. Làm mới danh sách + người dùng.
 */
export function useRelinkPancakeStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RelinkStaffInput) =>
      unwrap(api.POST('/pancake-sync/staff/relink', { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pancakeStaffKeys.all });
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

/** POST /pancake-sync/staff/cleanup — dọn tài khoản pc.* đã khoá trước đây (sync.map). */
export function useCleanupPancakeStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/pancake-sync/staff/cleanup')),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pancakeStaffKeys.all });
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
