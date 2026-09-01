import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { warehouseKeys } from './use-warehouses';

export type LocationNode = components['schemas']['LocationTreeNodeDto'];
export type LocationType = LocationNode['type'];
export type CreateLocationInput = components['schemas']['CreateLocationDto'];
export type UpdateLocationInput = components['schemas']['UpdateLocationDto'];

/** Phễu key nối tiếp warehouseKeys: ['wms','warehouses','detail',id,'locations','tree']. */
export const locationKeys = {
  tree: (warehouseId: string) =>
    [...warehouseKeys.all, 'detail', warehouseId, 'locations', 'tree'] as const,
};

/** GET /warehouses/{id}/locations/tree — cây ZONE/AISLE/RACK/BIN; cần stock.read. */
export function useLocationTree(warehouseId: string | null) {
  return useQuery({
    queryKey: locationKeys.tree(warehouseId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/warehouses/{id}/locations/tree', { params: { path: { id: warehouseId! } } }),
      ),
    enabled: warehouseId !== null,
  });
}

export function useCreateLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLocationInput) =>
      unwrap(
        api.POST('/warehouses/{id}/locations', {
          params: { path: { id: warehouseId } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}

export function useUpdateLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLocationInput }) =>
      unwrap(
        api.PATCH('/warehouses/locations/{locationId}', {
          params: { path: { locationId: id } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}

/** DELETE — soft delete: vị trí chuyển Ngừng dùng; server chặn 422 khi còn vị trí con đang dùng. */
export function useDeleteLocation(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/warehouses/locations/{locationId}', { params: { path: { locationId: id } } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: locationKeys.tree(warehouseId) }),
  });
}
