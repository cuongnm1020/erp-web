import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { pancakeConfigKeys } from './use-pancake-config';

export type PancakeWarehouseLinks = components['schemas']['PancakeWarehouseLinksDto'];
export type PancakeShopWarehouses = components['schemas']['PancakeShopWarehousesDto'];
export type PancakeWarehouseLinkRow = components['schemas']['PancakeWarehouseLinkRowDto'];
export type PancakeUnlinkedWarehouse = components['schemas']['PancakeUnlinkedWarehouseDto'];

/** Query key theo phễu (luật 3): ['admin','pancake-config','warehouses']. */
export const pancakeWarehouseKeys = {
  links: () => [...pancakeConfigKeys.all, 'warehouses'] as const,
};

/**
 * GET /pancake-sync/warehouses/links — kho ERP × shop đang bật: đã nối kho Pancake nào, kho
 * Pancake nào chưa nối. Server gọi Pancake mỗi lần nên không tự refetch khi đổi tab.
 */
export function usePancakeWarehouseLinks() {
  return useQuery({
    queryKey: pancakeWarehouseKeys.links(),
    queryFn: () => unwrap(api.GET('/pancake-sync/warehouses/links')),
    refetchOnWindowFocus: false,
  });
}

/** POST /pancake-sync/push/warehouses — đẩy mọi kho ERP lên mọi shop đang bật. */
export function usePushPancakeWarehouses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/pancake-sync/push/warehouses')),
    onSettled: () => void qc.invalidateQueries({ queryKey: pancakeWarehouseKeys.links() }),
  });
}

/** PUT /pancake-sync/warehouses/{id}/link — nối kho ERP với kho có sẵn trên shop rồi đẩy ngay. */
export function useLinkPancakeWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      warehouseId,
      shopId,
      externalId,
    }: {
      warehouseId: string;
      shopId: string;
      externalId: string;
    }) =>
      unwrap(
        api.PUT('/pancake-sync/warehouses/{id}/link', {
          params: { path: { id: warehouseId } },
          body: { shopId, externalId },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeWarehouseKeys.links() }),
  });
}

/** DELETE /pancake-sync/warehouses/{id}/link?shopId= — gỡ liên kết (không đổi gì trên Pancake). */
export function useUnlinkPancakeWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ warehouseId, shopId }: { warehouseId: string; shopId: string }) =>
      unwrap(
        api.DELETE('/pancake-sync/warehouses/{id}/link', {
          params: { path: { id: warehouseId }, query: { shopId } },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pancakeWarehouseKeys.links() }),
  });
}
