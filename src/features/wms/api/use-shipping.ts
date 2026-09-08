import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type StuckShipment = components['schemas']['StuckShipmentDto'];
export type CarrierStatusLog = components['schemas']['CarrierStatusLogDto'];
export type CarrierStatusLogList = components['schemas']['CarrierStatusLogListDto'];
export type Carrier = components['schemas']['CarrierDto'];

export interface StuckShipmentParams {
  days: number;
  take: number;
  skip: number;
}

export const shippingKeys = {
  all: ['wms', 'shipping'] as const,
  stuck: (p: StuckShipmentParams) => [...shippingKeys.all, 'stuck', p] as const,
  statusLog: (shipmentId: string) => [...shippingKeys.all, 'status-log', shipmentId] as const,
  carriers: () => [...shippingKeys.all, 'carriers'] as const,
};

/** GET /carriers — picker hãng vận chuyển (đơn bán chọn theo `id`). Danh mục ít đổi → cache 10 phút. */
export function useCarriers() {
  return useQuery({
    queryKey: shippingKeys.carriers(),
    queryFn: () => unwrap(api.GET('/carriers')),
    staleTime: 10 * 60_000,
  });
}

/** GET /carriers/stuck-shipments — đơn rời kho quá N ngày chưa terminal (BE-carrier-sync #3). */
export function useStuckShipments(params: StuckShipmentParams) {
  return useQuery({
    queryKey: shippingKeys.stuck(params),
    queryFn: () =>
      unwrap(
        api.GET('/carriers/stuck-shipments', {
          params: { query: { days: params.days, take: params.take, skip: params.skip } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /shipments/:id/status-log — timeline tín hiệu hãng (webhook + poll). */
export function useShipmentStatusLog(shipmentId: string) {
  return useQuery({
    queryKey: shippingKeys.statusLog(shipmentId),
    queryFn: () =>
      unwrap(api.GET('/shipments/{id}/status-log', { params: { path: { id: shipmentId } } })),
    enabled: shipmentId !== '',
  });
}
