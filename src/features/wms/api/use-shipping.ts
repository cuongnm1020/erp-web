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
  /** Tài khoản hãng đã cấp vận đơn (ô chọn hãng dùng chung). */
  carrierAccountId?: string;
  /** Phòng ban CSKH lên đơn (team `DEPT-<mã>`), 2026-10-29. */
  careTeamId?: string;
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
  careTeams: () => [...shippingKeys.all, 'care-teams'] as const,
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

/** Một lựa chọn "hãng + tài khoản" trong ô chọn hãng (mỗi tài khoản đủ cấu hình một dòng). */
export interface CarrierAccountOption {
  /** `${carrier.id}|${accountId ?? ''}` — dùng làm value của Select. */
  value: string;
  carrier: Carrier;
  /** null = hãng không có tài khoản (không adapter, vd giao thủ công) — server dùng mặc định. */
  accountId: string | null;
  /** Phần riêng của tài khoản ("S23119447 Nam Việt - Hàng Lòng"); null = hãng không tài khoản. */
  accountLabel: string | null;
  /** Nhãn đầy đủ, dùng chung mọi ô chọn: "GHTK S23119447 Nam Việt - Hàng Lòng". */
  label: string;
}

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

/** Tên tài khoản tạo tự động khi chưa nhập gì (carrier-config `ensureDefaultAccount`). */
const AUTO_ACCOUNT_NAME = 'Mặc định';

/**
 * Phần nhãn của một tài khoản: mã ở hãng (mã shop / đối tác) + tên. Tài khoản "Mặc định" chưa đặt
 * tên thì lấy tên hãng ("VTP Viettel Post" thay cho "VTP Mặc định"); tên đã chứa mã thì không lặp.
 */
export function carrierAccountLabel(c: Carrier, a: Carrier['accounts'][number]): string {
  const name = a.name.trim() === AUTO_ACCOUNT_NAME ? c.name : a.name.trim();
  const code = a.code?.trim();
  return code && !name.includes(code) ? `${code} ${name}` : name;
}

/**
 * Lựa chọn của ô chọn hãng dùng chung (2026-10-25): KHÔNG có dòng cấp hãng — mỗi tài khoản ĐỦ
 * CẤU HÌNH của hãng đang bật là một dòng "<MÃ HÃNG> <mã tài khoản> <tên>", tài khoản mặc định lên
 * đầu. Hãng không tài khoản (không adapter, vd giao thủ công) hiện một dòng tên hãng. Hãng có
 * adapter mà chưa cấu hình thì ẩn hẳn — chọn vào chỉ để hãng báo lỗi.
 */
export function carrierAccountOptions(carriers: Carrier[] | undefined): CarrierAccountOption[] {
  return (carriers ?? [])
    .filter((c) => c.isActive)
    .flatMap((c): CarrierAccountOption[] => {
      if (c.accounts.length === 0) {
        if (c.hasAdapter && !c.configured) return [];
        return [
          { value: `${c.id}|`, carrier: c, accountId: null, accountLabel: null, label: c.name },
        ];
      }
      return [...readyCarrierAccounts(c)]
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        .map((a) => {
          const accountLabel = carrierAccountLabel(c, a);
          return {
            value: `${c.id}|${a.id}`,
            carrier: c,
            accountId: a.id,
            accountLabel,
            label: `${c.code} ${accountLabel}`,
          };
        });
    });
}

/**
 * Dòng ứng với (hãng, tài khoản) đã lưu: tài khoản null = mặc định của hãng → dòng tài khoản mặc
 * định (hoặc dòng đầu của hãng). Không khớp → undefined.
 */
export function findCarrierOption(
  options: CarrierAccountOption[],
  carrierId: string | null | undefined,
  accountId: string | null | undefined,
): CarrierAccountOption | undefined {
  if (!carrierId) return undefined;
  const ofCarrier = options.filter((o) => o.carrier.id === carrierId);
  if (accountId) return ofCarrier.find((o) => o.accountId === accountId);
  return (
    ofCarrier.find((o) => o.carrier.accounts.find((a) => a.id === o.accountId)?.isDefault) ??
    ofCarrier[0]
  );
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
              carrierAccountId: params.carrierAccountId,
              careTeamId: params.careTeamId,
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
              carrierAccountId: params.carrierAccountId,
              careTeamId: params.careTeamId,
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

/**
 * GET /sales-orders/care-team-options — ô "Phòng ban CSKH" (2026-10-29). API trả theo người xem:
 * toàn quyền → mọi phòng CSKH, leader CSKH → phòng mình làm leader, người khác → rỗng (ẩn ô).
 */
export function useShippingCareTeams(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: shippingKeys.careTeams(),
    queryFn: () => unwrap(api.GET('/sales-orders/care-team-options')),
    staleTime: 300_000,
  });
}
