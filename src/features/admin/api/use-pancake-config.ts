import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type PancakeShopConfig = components['schemas']['PancakeShopConfigDto'];
export type PancakeConfigList = components['schemas']['PancakeConfigListDto'];
export type UpsertPancakeConfigInput = components['schemas']['UpsertPancakeConfigDto'];
export type PancakeVerifyResult = components['schemas']['PancakeVerifyResultDto'];

/** Query key theo phễu (luật 3): ['admin','pancake-config']. */
export const pancakeConfigKeys = {
  all: ['admin', 'pancake-config'] as const,
};

/** GET /pancake-sync/config — mọi shop đã kết nối + trạng thái env của server. Không bao giờ chứa khoá. */
export function usePancakeConfig() {
  return useQuery({
    queryKey: pancakeConfigKeys.all,
    queryFn: () => unwrap(api.GET('/pancake-sync/config')),
  });
}

/** PUT /pancake-sync/config/{shopId} — tạo hoặc sửa. Bỏ `apiKey` khi sửa = giữ khoá đang lưu. */
export function useUpsertPancakeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, input }: { shopId: number; input: UpsertPancakeConfigInput }) =>
      unwrap(
        api.PUT('/pancake-sync/config/{shopId}', {
          params: { path: { shopId } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeConfigKeys.all }),
  });
}

export function useDeletePancakeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: number) =>
      unwrap(api.DELETE('/pancake-sync/config/{shopId}', { params: { path: { shopId } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeConfigKeys.all }),
  });
}

/** POST /pancake-sync/config/{shopId}/webhook-secret — xoay secret; secret cũ hết hiệu lực ngay. */
export function useRotatePancakeWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: number) =>
      unwrap(
        api.POST('/pancake-sync/config/{shopId}/webhook-secret', {
          params: { path: { shopId } },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeConfigKeys.all }),
  });
}

/**
 * POST /pancake-sync/config/{shopId}/verify — gọi thử Pancake bằng cấu hình đang lưu.
 * Thất bại → 502 PANCAKE_VERIFY_FAILED; server đã ghi lastVerifyError nên vẫn invalidate.
 */
export function useVerifyPancakeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: number) =>
      unwrap(api.POST('/pancake-sync/config/{shopId}/verify', { params: { path: { shopId } } })),
    onSettled: () => void qc.invalidateQueries({ queryKey: pancakeConfigKeys.all }),
  });
}

export type PancakeShopProducts = components['schemas']['PancakeShopProductsDto'];
export type PancakeShopProduct = components['schemas']['PancakeShopProductDto'];
export type UpdateShopProductsInput = components['schemas']['UpdateShopProductsDto'];
export type ProductPickItem = components['schemas']['ProductListItemDto'];

export const pancakeShopProductKeys = {
  detail: (shopId: string) => [...pancakeConfigKeys.all, 'products', shopId] as const,
};

/** GET /pancake-sync/config/{shopId}/products — sản phẩm bán trên shop (POS) này. */
export function usePancakeShopProducts(shopId: string) {
  return useQuery({
    queryKey: pancakeShopProductKeys.detail(shopId),
    queryFn: () =>
      unwrap(
        api.GET('/pancake-sync/config/{shopId}/products', {
          params: { path: { shopId: Number(shopId) } },
        }),
      ),
  });
}

/**
 * PUT /pancake-sync/config/{shopId}/products — ghi đè danh sách gán. Server xếp đẩy lại các sản
 * phẩm bị ảnh hưởng lên Pancake (`queued`).
 */
export function useUpdatePancakeShopProducts(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateShopProductsInput) =>
      unwrap(
        api.PUT('/pancake-sync/config/{shopId}/products', {
          params: { path: { shopId: Number(shopId) } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeShopProductKeys.detail(shopId) }),
  });
}

/** GET /products?q= — tìm sản phẩm (kể cả combo) để gán cho shop; phân trang phía server. */
export function useProductPickSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'pancake-config', 'product-pick', q] as const,
    queryFn: () =>
      unwrap(
        api.GET('/products', {
          params: {
            query: { q: q || undefined, take: 50, skip: 0, sortBy: 'code', sortDir: 'asc' },
          },
        }),
      ),
    enabled,
    placeholderData: (prev) => prev,
  });
}
