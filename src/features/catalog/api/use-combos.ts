import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { productKeys } from './use-products';

export type ComboListItem = components['schemas']['ComboListItemDto'];
export type ComboListResponse = components['schemas']['ComboListResponseDto'];
export type ComboDetail = components['schemas']['ComboDetailDto'];
export type ComboComponent = components['schemas']['ComboComponentDto'];
export type CreateComboInput = components['schemas']['CreateComboDto'];
export type UpdateComboInput = components['schemas']['UpdateComboDto'];

export interface ComboListParams {
  q?: string;
  isActive?: boolean;
  sortBy?: 'code' | 'name' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  take: number;
  skip: number;
}

/** Phễu key (luật 3): ['catalog','combos', …]. Combo là sản phẩm → đổi combo cũng bay list sản phẩm. */
export const comboKeys = {
  all: ['catalog', 'combos'] as const,
  lists: () => [...comboKeys.all, 'list'] as const,
  list: (p: ComboListParams) => [...comboKeys.lists(), p] as const,
  details: () => [...comboKeys.all, 'detail'] as const,
  detail: (id: string) => [...comboKeys.details(), id] as const,
  componentSearch: (q: string) => [...comboKeys.all, 'component-search', q] as const,
};

/** GET /combos — danh sách combo kèm giá bán mặc định và số combo còn bán được (từ tồn thành phần). */
export function useCombos(params: ComboListParams) {
  return useQuery({
    queryKey: comboKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/combos', {
          params: {
            query: {
              q: params.q || undefined,
              isActive: params.isActive,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /combos/{id} — chi tiết kèm thành phần (mã, tên, ĐVT, định mức, tồn khả dụng). */
export function useCombo(id: string) {
  return useQuery({
    queryKey: comboKeys.detail(id),
    queryFn: () => unwrap(api.GET('/combos/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

function invalidateCombos(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: comboKeys.lists() });
  if (id) void qc.invalidateQueries({ queryKey: comboKeys.detail(id) });
  // Combo cũng là Product/SKU → danh sách sản phẩm và ô tìm SKU khi lên đơn phải thấy.
  void qc.invalidateQueries({ queryKey: productKeys.lists() });
  void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
}

/** POST /combos — tạo combo (product + SKU + thành phần + giá bán mặc định) trong một lần gọi. */
export function useCreateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComboInput) => unwrap(api.POST('/combos', { body: input })),
    onSuccess: () => invalidateCombos(qc),
  });
}

/** PATCH /combos/{id} — `version` bắt buộc (optimistic locking); `components` có mặt = thay toàn bộ. */
export function useUpdateCombo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateComboInput) =>
      unwrap(api.PATCH('/combos/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => invalidateCombos(qc, id),
  });
}

/** DELETE /combos/{id} — xóa mềm; đơn cũ giữ nguyên dòng thành phần đã snapshot. */
export function useDeleteCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/combos/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => invalidateCombos(qc, id),
  });
}

/**
 * Tìm SKU THƯỜNG làm thành phần — GET /skus (q ăn mã/tên SKU, sản phẩm, barcode), chỉ SKU
 * đang bán, loại SKU combo (không lồng combo — server cũng chặn 422). `meta` mang mã / ĐVT /
 * khả dụng để form hiện ngay không cần gọi thêm.
 */
export function useComponentSkuSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: comboKeys.componentSearch(q),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: { query: { q: q || undefined, status: 'active', take: 20, skip: 0 } },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items
    .filter((s) => !s.isCombo)
    .map((s) => ({
      id: s.skuId,
      label: s.name,
      hint: `${s.code} · ${s.productName}`,
      meta: { code: s.code, name: s.name, baseUomCode: s.baseUomCode, available: s.available },
    }));
  return { options, isPending: query.isPending, error: query.error };
}
