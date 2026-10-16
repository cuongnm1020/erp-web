import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntityOption, EntitySearchResult } from '@/components/data/form';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { pancakeConfigKeys, pancakeShopProductKeys } from './use-pancake-config';

export type CatalogMigrationPreview = components['schemas']['CatalogMigrationPreviewDto'];
export type CatalogMigrationRow = components['schemas']['CatalogMigrationRowDto'];
export type CatalogMigrationRowInput = components['schemas']['CatalogMigrationRowInputDto'];
export type CatalogMigrationStatus = components['schemas']['CatalogMigrationStatusDto'];

export const catalogMigrationKeys = {
  preview: (shopId: string) =>
    [...pancakeConfigKeys.all, 'catalog-migration', shopId, 'preview'] as const,
  status: (shopId: string) =>
    [...pancakeConfigKeys.all, 'catalog-migration', shopId, 'status'] as const,
  skuSearch: (q: string, combosToo: boolean) =>
    [...pancakeConfigKeys.all, 'catalog-migration', 'sku-search', q, combosToo] as const,
};

export const isMigrationRunning = (s: CatalogMigrationStatus | undefined): boolean =>
  s?.state === 'waiting' || s?.state === 'active';

/**
 * GET /pancake-sync/config/{shopId}/catalog-migration/preview — sản phẩm đang có trên POS + gợi ý
 * hàng ERP. Server gọi Pancake mỗi lần, nên không tự tải lại.
 */
export function useCatalogMigrationPreview(shopId: string, enabled: boolean) {
  return useQuery({
    queryKey: catalogMigrationKeys.preview(shopId),
    queryFn: () =>
      unwrap(
        api.GET('/pancake-sync/config/{shopId}/catalog-migration/preview', {
          params: { path: { shopId: Number(shopId) } },
        }),
      ),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Trạng thái lượt chuyển gần nhất — hỏi lại mỗi 3 s khi đang chạy. */
export function useCatalogMigrationStatus(shopId: string) {
  return useQuery({
    queryKey: catalogMigrationKeys.status(shopId),
    queryFn: () =>
      unwrap(
        api.GET('/pancake-sync/config/{shopId}/catalog-migration', {
          params: { path: { shopId: Number(shopId) } },
        }),
      ),
    refetchInterval: (q) => (isMigrationRunning(q.state.data) ? 3_000 : false),
  });
}

/**
 * POST /pancake-sync/config/{shopId}/catalog-migration — xếp job nền theo các dòng đã duyệt.
 * Không phải chứng từ: server dùng jobId cố định theo shop, đang chạy thì chỉ trả trạng thái.
 */
export function useStartCatalogMigration(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: CatalogMigrationRowInput[]) =>
      unwrap(
        api.POST('/pancake-sync/config/{shopId}/catalog-migration', {
          params: { path: { shopId: Number(shopId) } },
          body: { rows },
        }),
      ),
    onSuccess: (status) => {
      qc.setQueryData(catalogMigrationKeys.status(shopId), status);
      void qc.invalidateQueries({ queryKey: pancakeShopProductKeys.detail(shopId) });
    },
  });
}

function useSkuSearch(q: string, combosToo: boolean): EntitySearchResult {
  const query = useQuery({
    queryKey: catalogMigrationKeys.skuSearch(q, combosToo),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: { query: { q: q || undefined, status: 'active', take: 20, skip: 0 } },
        }),
      ),
    staleTime: 30_000,
  });
  const options: EntityOption[] | undefined = query.data?.items
    .filter((s) => combosToo || !s.isCombo)
    .map((s) => ({
      id: s.skuId,
      label: s.name,
      hint: `${s.code}${s.isCombo ? ' · combo' : ''}`,
    }));
  return { options, isPending: query.isPending, error: query.error };
}

/** Hàng ERP để nối mẫu mã POS — SKU thường lẫn combo. */
export const useMigrationTargetSearch = (q: string) => useSkuSearch(q, true);
/** Thành phần cho combo mới — chỉ SKU thường (server chặn combo lồng combo). */
export const useMigrationComponentSearch = (q: string) => useSkuSearch(q, false);
