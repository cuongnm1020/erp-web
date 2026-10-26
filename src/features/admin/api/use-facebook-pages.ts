import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type FacebookPage = components['schemas']['FacebookPageDto'];
export type CreateFacebookPageInput = components['schemas']['CreateFacebookPageDto'];
export type UpdateFacebookPageInput = components['schemas']['UpdateFacebookPageDto'];
export type FacebookPageShop = components['schemas']['PancakeShopOptionDto'];

export interface FacebookPageListParams {
  q?: string;
  shopId?: string;
  origin?: FacebookPage['origin'];
  isActive?: boolean;
  take: number;
  skip: number;
}

/**
 * Query key theo phễu (luật 3). Prefix `['facebook-pages']` dùng chung với ô chọn page ở màn đơn
 * (features/orders) — sửa page ở đây là ô chọn bên đó tải lại.
 */
export const facebookPageKeys = {
  all: ['facebook-pages'] as const,
  list: (p: FacebookPageListParams) => ['facebook-pages', 'list', p] as const,
  shops: () => ['facebook-pages', 'pancake-shops'] as const,
};

/** GET /facebook-pages — lọc + phân trang phía server (luật 8), page nhiều đơn lên trước. */
export function useFacebookPages(params: FacebookPageListParams) {
  return useQuery({
    queryKey: facebookPageKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/facebook-pages', {
          params: {
            query: {
              q: params.q || undefined,
              shopId: params.shopId,
              origin: params.origin,
              isActive: params.isActive,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /pancake-sync/shops — tên POS cho cột / ô chọn POS (page chỉ giữ mã shop). */
export function useFacebookPageShops() {
  return useQuery({
    queryKey: facebookPageKeys.shops(),
    queryFn: () => unwrap(api.GET('/pancake-sync/shops')),
    staleTime: 5 * 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: facebookPageKeys.all });
  };
}

export function useCreateFacebookPage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateFacebookPageInput) => unwrap(api.POST('/facebook-pages', { body })),
    onSuccess: invalidate,
  });
}

/** PATCH /facebook-pages/{id} — optimistic lock: body mang version đang cầm. */
export function useUpdateFacebookPage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFacebookPageInput }) =>
      unwrap(api.PATCH('/facebook-pages/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** DELETE /facebook-pages/{id} — xóa mềm; đơn cũ giữ page. */
export function useDeleteFacebookPage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/facebook-pages/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}
