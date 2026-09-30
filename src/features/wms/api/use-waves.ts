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
export type WaveSuggestion = components['schemas']['WaveSuggestionDto'];
export type WaveSuggestionList = components['schemas']['WaveSuggestionListDto'];

export interface WaveListParams {
  status?: WaveStatus;
  warehouseId?: string;
  assignedTo?: string;
  /** Chỉ lượt gộp theo cấp đóng gói này. */
  packLevel?: WavePackLevel;
  take: number;
  skip: number;
}

export interface WaveSuggestionParams {
  warehouseId?: string;
  /** Chỉ nhóm cấp này; `cartonCount` / `palletCount` trong response vẫn đếm cả hai. */
  packLevel?: WavePackLevel;
}

/** Phễu key: ['wms','waves', …] — gợi ý gộp nằm dưới cùng prefix để realtime / mutation invalidate một lần. */
export const waveKeys = {
  all: ['wms', 'waves'] as const,
  lists: () => [...waveKeys.all, 'list'] as const,
  list: (p: WaveListParams) => [...waveKeys.lists(), p] as const,
  detail: (id: string) => [...waveKeys.all, 'detail', id] as const,
  suggestions: (p: WaveSuggestionParams) => [...waveKeys.all, 'suggestions', p] as const,
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

/**
 * GET /waves/suggestions — nhóm đơn ĐỦ ĐIỀU KIỆN gộp theo cấp đóng gói (PLAN-packaging-hierarchy
 * §12): đơn một SKU cộng đúng N thùng / đúng một pallet. Server chỉ gợi ý, không tạo lượt — quản
 * lý bấm "Gộp và gán" (`useMergeWaveSuggestion`). Tính lúc gọi nên không có trạng thái cũ.
 */
export function useWaveSuggestions(params: WaveSuggestionParams) {
  return useQuery({
    queryKey: waveKeys.suggestions(params),
    queryFn: () =>
      unwrap(
        api.GET('/waves/suggestions', {
          params: {
            query: {
              warehouseId: params.warehouseId || undefined,
              packLevel: params.packLevel,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
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
 * POST /waves/merge — gộp MỘT nhóm gợi ý thành lượt (server kiểm lại từng đơn trong transaction;
 * 409 `WAVE_SUGGESTION_STALE` khi có đơn đã huỷ / đã gán / đã vào lượt khác). Invalidate ở
 * `onSettled` vì cả khi 409 danh sách gợi ý cũng đã cũ — phải tải lại, không gộp phần còn lại.
 */
export function useMergeWaveSuggestion() {
  const invalidate = useInvalidateWaves();
  return useMutation({
    mutationFn: (body: {
      skuId: string;
      packLevel: WavePackLevel;
      packCount: number;
      taskIds: string[];
      assignedTo?: string;
    }) => unwrap(api.POST('/waves/merge', { body })),
    onSettled: invalidate,
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
