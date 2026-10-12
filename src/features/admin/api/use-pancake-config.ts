import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
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

export type DuplicatePancakeConfigInput = components['schemas']['DuplicatePancakeConfigDto'];

/**
 * POST /pancake-sync/config/{shopId}/duplicate — tạo shop mới chép khoá (phía server), giới hạn,
 * danh sách sản phẩm của shop gốc. Shop đích đã có → 409.
 */
export function useDuplicatePancakeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, input }: { shopId: number; input: DuplicatePancakeConfigInput }) =>
      unwrap(
        api.POST('/pancake-sync/config/{shopId}/duplicate', {
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

// ── Nhân viên Pancake ↔ tài khoản ERP (2026-10-12) ───────────────────────────

export type PancakeStaff = components['schemas']['PancakeStaffDto'];
export type RelinkStaffInput = components['schemas']['RelinkStaffDto'];

export const pancakeStaffKeys = {
  list: () => [...pancakeConfigKeys.all, 'staff'] as const,
  userSearch: (q: string) => [...pancakeConfigKeys.all, 'staff', 'user-search', q] as const,
};

/** GET /pancake-sync/mapping/staff — nhân viên Pancake mọi POS + tài khoản ERP đang gắn. */
export function usePancakeStaff() {
  return useQuery({
    queryKey: pancakeStaffKeys.list(),
    queryFn: () => unwrap(api.GET('/pancake-sync/mapping/staff')),
  });
}

/**
 * POST /pancake-sync/mapping/staff/relink — gắn nhân viên Pancake sang tài khoản ERP khác (mọi POS);
 * server đánh thức đơn liên quan để người phụ trách đổi theo.
 */
export function useRelinkPancakeStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RelinkStaffInput) =>
      unwrap(api.POST('/pancake-sync/mapping/staff/relink', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeStaffKeys.list() }),
  });
}

/** Tìm tài khoản ERP đang hoạt động để gắn (EntityPicker) — GET /users?q=. */
export function useStaffUserSearch(q: string): EntitySearchResult {
  const query = useQuery({
    queryKey: pancakeStaffKeys.userSearch(q),
    queryFn: () =>
      unwrap(
        api.GET('/users', {
          params: { query: { q: q || undefined, isActive: true, take: 20, skip: 0 } },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items.map((u) => ({
    id: u.id,
    label: u.fullName,
    hint: u.code,
  }));
  return { options, isPending: query.isPending, error: query.error };
}
