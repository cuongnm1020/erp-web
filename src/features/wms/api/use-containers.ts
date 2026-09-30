import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape từ schema.d.ts (PLAN-packaging-hierarchy B/C). */
export type ContainerType = components['schemas']['ContainerTypeDto'];
export type ContainerRow = components['schemas']['ContainerDto'];
export type ContainerDetail = components['schemas']['ContainerDetailDto'];
export type ContainerContent = components['schemas']['ContainerContentDto'];
export type ContainerHistoryRow = components['schemas']['ContainerHistoryRowDto'];

/** Phễu key: ['wms','containers', …]. */
export const containerKeys = {
  all: ['wms', 'containers'] as const,
  types: () => [...containerKeys.all, 'types'] as const,
  detail: (id: string) => [...containerKeys.all, 'detail', id] as const,
  byBarcode: (barcode: string) => [...containerKeys.all, 'by-barcode', barcode] as const,
  history: (id: string) => [...containerKeys.all, 'detail', id, 'history'] as const,
};

/** GET /container-types — loại thùng/kiện/pallet đang dùng (admin cấu hình). Danh mục nhỏ, ít đổi. */
export function useContainerTypes(enabled = true) {
  return useQuery({
    queryKey: containerKeys.types(),
    queryFn: () => unwrap(api.GET('/container-types')),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** GET /containers/:id — cây + nội dung (tồn = Σ StockBalance cây con, không lưu). */
export function useContainer(id: string | null) {
  return useQuery({
    queryKey: containerKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/containers/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: !!id,
  });
}

/** GET /containers/by-barcode/:barcode — tra theo tem LPN / mã NCC. */
export function useContainerByBarcode(barcode: string | null) {
  return useQuery({
    queryKey: containerKeys.byBarcode(barcode ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/containers/by-barcode/{barcode}', {
          params: { path: { barcode: barcode ?? '' } },
        }),
      ),
    enabled: !!barcode,
  });
}

/** GET /containers/:id/history — sổ cái của cả cây (mới nhất trước). */
export function useContainerHistory(id: string | null) {
  return useQuery({
    queryKey: containerKeys.history(id ?? ''),
    queryFn: () =>
      unwrap(api.GET('/containers/{id}/history', { params: { path: { id: id ?? '' } } })),
    enabled: !!id,
  });
}
