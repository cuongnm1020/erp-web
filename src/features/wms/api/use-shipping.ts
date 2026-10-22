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
  /** Tên tài khoản khi hãng có ≥ 2 tài khoản đủ cấu hình (kèm "(mặc định)"); còn lại null. */
  accountLabel: string | null;
  label: string;
}

/**
 * Mọi hãng đang bật × mọi tài khoản ĐỦ CẤU HÌNH của hãng (2026-10-22): hãng có ≥ 2 tài khoản hiện
 * "Hãng · Tài khoản" từng dòng, tài khoản mặc định lên đầu; hãng một tài khoản / không adapter
 * hiện một dòng như cũ. Tài khoản / hãng có adapter mà chưa cấu hình thì ẩn hẳn — chọn vào chỉ để
 * hãng báo lỗi.
 */
/** Tài khoản đủ cấu hình (token / mã shop) — gửi được đơn sang hãng. */
export function readyCarrierAccounts(c: Carrier): Carrier['accounts'] {
  return c.accounts.filter((a) => a.configured);
}

/**
 * Hãng đang bật và dùng được: có ≥ 1 tài khoản đủ cấu hình, hoặc không tài khoản thì là hãng nội
 * bộ (không adapter) hoặc đã cấu hình. Hãng chưa cấu hình ẩn khỏi ô chọn (2026-10-22).
 */
export function isCarrierReady(c: Carrier): boolean {
  if (!c.isActive) return false;
  if (c.accounts.length === 0) return !c.hasAdapter || c.configured;
  return readyCarrierAccounts(c).length > 0;
}

export function carrierAccountOptions(carriers: Carrier[] | undefined): CarrierAccountOption[] {
  return (carriers ?? [])
    .filter((c) => c.isActive)
    .flatMap((c): CarrierAccountOption[] => {
      const base = `${c.name} (${c.code})`;
      if (c.accounts.length === 0) {
        if (c.hasAdapter && !c.configured) return [];
        return [
          { value: `${c.id}|`, carrier: c, accountId: null, accountLabel: null, label: base },
        ];
      }
      const ready = readyCarrierAccounts(c);
      const many = ready.length > 1;
      return ready
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        .map((a) => {
          const accountLabel = many ? `${a.name}${a.isDefault ? ' (mặc định)' : ''}` : null;
          return {
            value: `${c.id}|${a.id}`,
            carrier: c,
            accountId: a.id,
            accountLabel,
            label: accountLabel ? `${c.name} · ${accountLabel}` : base,
          };
        });
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
