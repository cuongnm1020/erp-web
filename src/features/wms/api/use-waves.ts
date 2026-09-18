import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { taskKeys } from './use-tasks';

/** Luật 2: shape từ schema.d.ts sinh bởi OpenAPI. */
export type Wave = components['schemas']['WaveDto'];
export type WaveDetail = components['schemas']['WaveDetailDto'];
export type WaveLineGroup = components['schemas']['WaveLineGroupDto'];
export type WaveStatus = Wave['status'];

export type WavePackLevel = NonNullable<Wave['packLevel']>;
export type AutoWaveResult = components['schemas']['AutoWaveResultDto'];

export interface WaveListParams {
  status?: WaveStatus;
  warehouseId?: string;
  assignedTo?: string;
  /** Chỉ lượt gộp tự động cấp này. */
  packLevel?: WavePackLevel;
  take: number;
  skip: number;
}

/** Phễu key: ['wms','waves', …]. */
export const waveKeys = {
  all: ['wms', 'waves'] as const,
  lists: () => [...waveKeys.all, 'list'] as const,
  list: (p: WaveListParams) => [...waveKeys.lists(), p] as const,
  detail: (id: string) => [...waveKeys.all, 'detail', id] as const,
};

/** GET /waves — lượt pick gộp cho bảng điều phối (mới nhất trước). */
export function useWaves(params: WaveListParams) {
  return useQuery({
    queryKey: waveKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/waves', {
          params: {
            query: {
              status: params.status,
              warehouseId: params.warehouseId || undefined,
              assignedTo: params.assignedTo || undefined,
              packLevel: params.packLevel,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /waves/:id — dòng gộp theo lối đi + tiến độ từng đơn (in phiếu wave). */
export function useWaveDetail(id: string | null) {
  return useQuery({
    queryKey: waveKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/waves/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null && id !== '',
  });
}

function useInvalidateWaves() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: waveKeys.all });
    void qc.invalidateQueries({ queryKey: taskKeys.all });
  };
}

/**
 * POST /waves/auto-merge — gộp TỰ ĐỘNG theo cấp đóng gói: đơn một SKU vừa đủ một thùng → lượt
 * CARTON; đủ số thùng một pallet → lượt PALLET. Server tự chạy sau mỗi đơn; nút này chạy lại cho cả kho.
 */
export function useAutoMergeWaves() {
  const invalidate = useInvalidateWaves();
  return useMutation({
    mutationFn: (body: { warehouseId?: string; skuId?: string }) =>
      unwrap(api.POST('/waves/auto-merge', { body })),
    onSuccess: invalidate,
  });
}

/** POST /waves — gộp N task PICK (cùng kho, chưa ai nhận) thành một lượt; gán người luôn nếu có. */
export function useCreateWave() {
  const invalidate = useInvalidateWaves();
  return useMutation({
    mutationFn: (body: { taskIds: string[]; assignedTo?: string }) =>
      unwrap(api.POST('/waves', { body })),
    onSuccess: invalidate,
  });
}

/** POST /waves/:id/assign — gán cả lượt (mọi task con) cho một người. */
export function useAssignWave() {
  const invalidate = useInvalidateWaves();
  return useMutation({
    mutationFn: ({ waveId, userId }: { waveId: string; userId: string }) =>
      unwrap(
        api.POST('/waves/{id}/assign', { params: { path: { id: waveId } }, body: { userId } }),
      ),
    onSuccess: invalidate,
  });
}

/** POST /waves/:id/unassign — trả cả lượt về hàng đợi. */
export function useUnassignWave() {
  const invalidate = useInvalidateWaves();
  return useMutation({
    mutationFn: (waveId: string) =>
      unwrap(api.POST('/waves/{id}/unassign', { params: { path: { id: waveId } } })),
    onSuccess: invalidate,
  });
}
