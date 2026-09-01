import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

export type CycleCountListRow = components['schemas']['CycleCountListRowDto'];
export type CycleCountDetail = components['schemas']['CycleCountDetailDto'];
export type CycleCountLine = components['schemas']['CycleCountLineDto'];
export type CycleCountStatus = CycleCountDetail['status'];
export type CycleCountListParams = NonNullable<
  operations['StocktakeController_list']['parameters']['query']
>;

/** Phễu key (luật 3): ['wms','cycle-counts', ...]. */
export const stocktakeKeys = {
  all: ['wms', 'cycle-counts'] as const,
  lists: () => [...stocktakeKeys.all, 'list'] as const,
  list: (params: CycleCountListParams) => [...stocktakeKeys.lists(), params] as const,
  detail: (id: string) => [...stocktakeKeys.all, 'detail', id] as const,
};

export function useCycleCounts(params: CycleCountListParams) {
  return useQuery({
    queryKey: stocktakeKeys.list(params),
    queryFn: () => unwrap(api.GET('/cycle-counts', { params: { query: params } })),
    placeholderData: (prev) => prev,
  });
}

export function useCycleCount(id: string | null) {
  return useQuery({
    queryKey: stocktakeKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/cycle-counts/{id}', { params: { path: { id: id! } } })),
    enabled: id !== null,
  });
}

/** POST /cycle-counts — mở phiên, snapshot tồn sổ ngay lúc bấm. */
export function useCreateCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { warehouseId: string; locationIds?: string[] }) =>
      unwrap(api.POST('/cycle-counts', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: stocktakeKeys.lists() }),
  });
}

/** PATCH /cycle-counts/:id/lines/:lineId — ghi số đếm (chỉ khi phiên DRAFT). */
export function useRecordCount(countId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lineId,
      qtyCounted,
      note,
    }: {
      lineId: string;
      qtyCounted: string;
      note?: string;
    }) =>
      unwrap(
        api.PATCH('/cycle-counts/{id}/lines/{lineId}', {
          params: { path: { id: countId, lineId } },
          body: { qtyCounted, ...(note !== undefined ? { note } : {}) },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: stocktakeKeys.detail(countId) }),
  });
}

export function useSubmitCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/cycle-counts/{id}/submit', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: stocktakeKeys.lists() });
      void qc.invalidateQueries({ queryKey: stocktakeKeys.detail(id) });
    },
  });
}

/** Duyệt → ghi COUNT_GAIN/COUNT_LOSS vào sổ cái; tồn sổ đổi NGAY khi duyệt. */
export function useApproveCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/cycle-counts/{id}/approve', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: stocktakeKeys.lists() });
      void qc.invalidateQueries({ queryKey: stocktakeKeys.detail(id) });
      // Tồn sổ đã đổi — làm mới các màn tồn kho
      void qc.invalidateQueries({ queryKey: ['wms', 'stock'] });
    },
  });
}

export function useRejectCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/cycle-counts/{id}/reject', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: stocktakeKeys.lists() });
      void qc.invalidateQueries({ queryKey: stocktakeKeys.detail(id) });
    },
  });
}
