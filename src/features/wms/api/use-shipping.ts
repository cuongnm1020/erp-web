import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI, không khai lại. */
export type CarrierStatusLog = components['schemas']['CarrierStatusLogDto'];
export type CarrierStatusLogList = components['schemas']['CarrierStatusLogListDto'];
export type Carrier = components['schemas']['CarrierDto'];
export type ShipmentMonitorSummary = components['schemas']['ShipmentMonitorSummaryDto'];
export type ShipmentMonitorRow = components['schemas']['ShipmentMonitorRowDto'];
export type ShipmentMonitorView = components['schemas']['ShipmentMonitorListDto']['view'];

export interface ShipmentMonitorFilter {
  /** YYYY-MM-DD giờ VN. */
  date: string;
  carrierId?: string;
  holdDays: number;
}

export interface ShipmentMonitorListParams extends ShipmentMonitorFilter {
  view: ShipmentMonitorView;
  q?: string;
  take: number;
  skip: number;
}

/** Màn theo dõi để mở cả ca — tự làm mới mỗi phút. */
const MONITOR_REFRESH_MS = 60_000;

export const shippingKeys = {
  all: ['wms', 'shipping'] as const,
  statusLog: (shipmentId: string) => [...shippingKeys.all, 'status-log', shipmentId] as const,
  carriers: () => [...shippingKeys.all, 'carriers'] as const,
  monitorSummary: (p: ShipmentMonitorFilter) =>
    [...shippingKeys.all, 'monitor', 'summary', p] as const,
  monitorList: (p: ShipmentMonitorListParams) =>
    [...shippingKeys.all, 'monitor', 'list', p] as const,
};

/** GET /carriers — picker hãng vận chuyển (đơn bán chọn theo `id`). Danh mục ít đổi → cache 10 phút. */
export function useCarriers() {
  return useQuery({
    queryKey: shippingKeys.carriers(),
    queryFn: () => unwrap(api.GET('/carriers')),
    staleTime: 10 * 60_000,
  });
}

/** Một lựa chọn "hãng + tài khoản" trong ô chọn hãng (hãng nhiều tài khoản = nhiều dòng). */
export interface CarrierAccountOption {
  /** `${carrier.id}|${accountId ?? ''}` — dùng làm value của Select. */
  value: string;
  carrier: Carrier;
  /** null = hãng không có tài khoản (không adapter) — server dùng mặc định. */
  accountId: string | null;
  label: string;
  /** Tài khoản thiếu cấu hình — hiện nhưng không chọn được (gọi hãng sẽ lỗi). */
  disabled: boolean;
}

/**
 * Mọi hãng đang bật × mọi tài khoản đang bật của hãng (2026-10-22): hãng có ≥ 2 tài khoản hiện
 * "Hãng · Tài khoản" từng dòng, tài khoản mặc định lên đầu; hãng một tài khoản / không adapter
 * hiện một dòng như cũ.
 */
export function carrierAccountOptions(carriers: Carrier[] | undefined): CarrierAccountOption[] {
  return (carriers ?? [])
    .filter((c) => c.isActive)
    .flatMap((c): CarrierAccountOption[] => {
      const base = `${c.name} (${c.code})`;
      if (c.accounts.length === 0) {
        return [{ value: `${c.id}|`, carrier: c, accountId: null, label: base, disabled: false }];
      }
      const many = c.accounts.length > 1;
      return [...c.accounts]
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        .map((a) => ({
          value: `${c.id}|${a.id}`,
          carrier: c,
          accountId: a.id,
          label:
            (many ? `${c.name} · ${a.name}${a.isDefault ? ' (mặc định)' : ''}` : base) +
            (a.configured ? '' : ' — thiếu cấu hình'),
          disabled: !a.configured,
        }));
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

/**
 * GET /shipment-monitor/summary — đã đóng gói / đã bàn giao trong ngày, hãng đang giữ, giữ quá
 * N ngày (tổng + theo hãng). Số đếm do API tính.
 */
export function useShipmentMonitorSummary(params: ShipmentMonitorFilter) {
  return useQuery({
    queryKey: shippingKeys.monitorSummary(params),
    queryFn: () =>
      unwrap(
        api.GET('/shipment-monitor/summary', {
          params: {
            query: {
              date: params.date,
              carrierId: params.carrierId,
              holdDays: params.holdDays,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: MONITOR_REFRESH_MS,
  });
}

/** GET /shipment-monitor — danh sách phiếu giao theo góc nhìn (đóng gói / bàn giao / đang giữ / quá hạn). */
export function useShipmentMonitorList(params: ShipmentMonitorListParams) {
  return useQuery({
    queryKey: shippingKeys.monitorList(params),
    queryFn: () =>
      unwrap(
        api.GET('/shipment-monitor', {
          params: {
            query: {
              view: params.view,
              date: params.date,
              carrierId: params.carrierId,
              holdDays: params.holdDays,
              q: params.q || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: MONITOR_REFRESH_MS,
  });
}
