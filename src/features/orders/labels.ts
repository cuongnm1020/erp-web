import Decimal from 'decimal.js';
import type { StatusTone } from '@/components/data/status-badge';
import { formatMoney } from '@/lib/format';
import type {
  OrderFlow,
  SalesOrderChannel,
  SalesOrderDetail,
  SalesOrderStatus,
} from './api/use-orders';

/**
 * Nhãn tiếng Việt theo cái người dùng điều khiển, không theo enum của DB.
 * Danh sách khoá lấy từ union trong schema.d.ts — thêm giá trị ở backend thì TypeScript
 * bắt lỗi ở đây, không âm thầm hiện mã enum ra màn hình.
 */
const STATUS_LABEL: Record<SalesOrderStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  POSTED: 'Đã chốt',
  CANCELLED: 'Đã hủy',
};

const STATUS_TONE: Record<SalesOrderStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'brand',
  POSTED: 'ok',
  CANCELLED: 'err',
};

const CHANNEL_LABEL: Record<SalesOrderChannel, string> = {
  DIRECT: 'Trực tiếp',
  MARKETPLACE: 'Sàn TMĐT',
  WEBSITE: 'Website',
  POS: 'Tại quầy',
};

export function orderStatusLabel(s: SalesOrderStatus): string {
  return STATUS_LABEL[s];
}

export function orderStatusTone(s: SalesOrderStatus): StatusTone {
  return STATUS_TONE[s];
}

export function orderChannelLabel(c: SalesOrderChannel): string {
  return CHANNEL_LABEL[c];
}

export const ORDER_STATUSES = Object.keys(STATUS_LABEL) as SalesOrderStatus[];

/** Giá trị status trên URL do người dùng dán vào — chỉ nhận đúng union của API. */
export function parseOrderStatus(v: string | undefined): SalesOrderStatus | undefined {
  return v !== undefined && (ORDER_STATUSES as string[]).includes(v)
    ? (v as SalesOrderStatus)
    : undefined;
}

/**
 * Đích chuyển trạng thái được sửa TAY qua PATCH /sales-orders/{id} — chép đúng
 * MANUAL_STATUS_TARGETS của backend (SCREEN-INVENTORY ghi chú D-05: ranh giới phải khớp
 * state machine, không để bấm rồi API từ chối). Mỗi đích cần thêm quyền của hành động đó.
 */
const MANUAL_STATUS_TARGETS: Record<SalesOrderStatus, readonly SalesOrderStatus[]> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  PENDING_APPROVAL: ['CANCELLED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  POSTED: ['CANCELLED'],
  CANCELLED: [],
};

/** Quyền (CASL action trên SalesOrder) cần có để đặt đích này — ngoài `update` mở cửa. */
const STATUS_TARGET_ACTION: Partial<Record<SalesOrderStatus, 'approve' | 'post' | 'cancel'>> = {
  APPROVED: 'approve',
  POSTED: 'post',
  CANCELLED: 'cancel',
};

export function manualStatusTargets(
  from: SalesOrderStatus,
  can: (action: 'approve' | 'post' | 'cancel') => boolean,
): SalesOrderStatus[] {
  return MANUAL_STATUS_TARGETS[from].filter((to) => {
    const action = STATUS_TARGET_ACTION[to];
    return action === undefined || can(action);
  });
}

/** Đơn còn sửa được hãng vận chuyển / trường ERP khác — khớp ORDER_NOT_EDITABLE của backend. */
/** Dòng địa chỉ 2 cấp: số nhà/đường, thôn/xóm, phường/xã, tỉnh/thành — bỏ phần trống. */
export function orderAddressLine(a: {
  line1: string;
  hamlet: string | null;
  ward: string | null;
  province: string;
}): string {
  return [a.line1, a.hamlet, a.ward, a.province].filter(Boolean).join(', ');
}

export function orderEditable(status: SalesOrderStatus): boolean {
  return status !== 'POSTED' && status !== 'CANCELLED';
}

// ── Trạng thái KHO của đơn (fulfilment) — suy từ task PICK/PACK + phiếu giao ở server ──

export type OrderFulfilmentStatus = SalesOrderDetail['fulfilment']['status'];
export type FulfilTarget = 'PICKED' | 'PACKED';

const FULFILMENT_LABEL: Record<OrderFulfilmentStatus, string> = {
  NOT_STARTED: 'Chờ pick',
  PICKING: 'Đang pick',
  PICKED: 'Đã pick xong',
  PACKING: 'Đang đóng gói',
  PACKED: 'Đã đóng gói',
  SHIPPED: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERED: 'Thành công',
  FAILED: 'Giao thất bại',
  RETURNED: 'Sự cố hoàn',
  CARRIER_CANCELLED: 'Hãng hủy',
  CANCELLED: 'Đã hủy việc kho',
};

const FULFILMENT_TONE: Record<OrderFulfilmentStatus, StatusTone> = {
  NOT_STARTED: 'neutral',
  PICKING: 'brand',
  PICKED: 'brand',
  PACKING: 'brand',
  PACKED: 'ok',
  SHIPPED: 'ok',
  IN_TRANSIT: 'brand',
  OUT_FOR_DELIVERY: 'brand',
  DELIVERED: 'ok',
  FAILED: 'err',
  RETURNED: 'warn',
  CARRIER_CANCELLED: 'err',
  CANCELLED: 'neutral',
};

export function fulfilmentLabel(s: OrderFulfilmentStatus): string {
  return FULFILMENT_LABEL[s];
}
export function fulfilmentTone(s: OrderFulfilmentStatus): StatusTone {
  return FULFILMENT_TONE[s];
}

/** Nhãn đích đóng tay — trùng nhãn trạng thái tương ứng để toast/nhãn không đổi từ. */
export function fulfilTargetLabel(t: FulfilTarget): string {
  return FULFILMENT_LABEL[t];
}

/**
 * Đích "Trạng thái kho" đặt TAY qua POST /sales-orders/{id}/fulfil — chép đúng
 * `manualFulfilTargets` của backend (sales-order-fulfilment.ts): không để bấm rồi API từ chối.
 */
export function manualFulfilTargets(status: OrderFulfilmentStatus): FulfilTarget[] {
  switch (status) {
    case 'NOT_STARTED':
    case 'PICKING':
      return ['PICKED', 'PACKED'];
    case 'PICKED':
    case 'PACKING':
      return ['PACKED'];
    default:
      return [];
  }
}

/**
 * Phần giảm giá cấp đơn sale nhập tay (đã nằm trong `discount`): "giảm tay 15.000" hoặc
 * "giảm tay 10% = 27.000". null = đơn không có giảm tay.
 */
export function manualDiscountNote(
  o: Pick<SalesOrderDetail, 'manualDiscount' | 'manualDiscountRate'>,
): string | null {
  if (!o.manualDiscount || new Decimal(o.manualDiscount).isZero()) return null;
  const amount = formatMoney(o.manualDiscount, { unit: '' });
  if (!o.manualDiscountRate) return `giảm tay ${amount}`;
  const pct = new Decimal(o.manualDiscountRate).mul(100).toDecimalPlaces(2).toString();
  return `giảm tay ${pct}% = ${amount}`;
}

// ── Tab danh sách đơn (2026-10-12) — luồng chung, docs/carrier-status-mapping.md ở apps/api ──

/** Thứ tự tab; `group` tách ba nhóm bằng vạch: ở kho / đang đi đường / đã xong. */
export const ORDER_FLOW_TABS: ReadonlyArray<{
  flow: OrderFlow;
  label: string;
  group: 'warehouse' | 'shipping' | 'done';
}> = [
  { flow: 'PENDING_APPROVAL', label: 'Chờ duyệt', group: 'warehouse' },
  { flow: 'WAREHOUSE', label: 'Chờ xử lý kho', group: 'warehouse' },
  { flow: 'PICKING', label: 'Đang pick', group: 'warehouse' },
  { flow: 'PACKED', label: 'Đã đóng gói', group: 'warehouse' },
  { flow: 'PICKED_UP', label: 'Đã lấy hàng', group: 'shipping' },
  { flow: 'IN_TRANSIT', label: 'Đang vận chuyển', group: 'shipping' },
  { flow: 'OUT_FOR_DELIVERY', label: 'Đang giao hàng', group: 'shipping' },
  { flow: 'DELIVERED', label: 'Thành công', group: 'done' },
  { flow: 'RETURNED', label: 'Sự cố hoàn', group: 'done' },
  { flow: 'CARRIER_CANCELLED', label: 'Hãng hủy', group: 'done' },
  { flow: 'CANCELLED', label: 'Đã hủy', group: 'done' },
];

/**
 * Mỗi trạng thái một màu chữ, nền cùng màu 10% (token --flow-* trong globals.css). Viết nguyên
 * class — Tailwind chỉ sinh class thấy được trong mã nguồn.
 */
const FLOW_CLASS: Record<OrderFlow, string> = {
  PENDING_APPROVAL: 'bg-flow-pending/10 text-flow-pending',
  WAREHOUSE: 'bg-flow-warehouse/10 text-flow-warehouse',
  PICKING: 'bg-flow-picking/10 text-flow-picking',
  PACKED: 'bg-flow-packed/10 text-flow-packed',
  PICKED_UP: 'bg-flow-picked-up/10 text-flow-picked-up',
  IN_TRANSIT: 'bg-flow-in-transit/10 text-flow-in-transit',
  OUT_FOR_DELIVERY: 'bg-flow-out-for-delivery/10 text-flow-out-for-delivery',
  DELIVERED: 'bg-flow-delivered/10 text-flow-delivered',
  RETURNED: 'bg-flow-returned/10 text-flow-returned',
  CARRIER_CANCELLED: 'bg-flow-carrier-cancelled/10 text-flow-carrier-cancelled',
  CANCELLED: 'bg-flow-cancelled/10 text-flow-cancelled',
};

export function orderFlowClass(f: OrderFlow): string {
  return FLOW_CLASS[f];
}

/** Màu chữ của nhà mạng + nền cùng màu 15% (token --telco-*). Không nhận ra → xám. */
const TELCO_CLASS: Record<string, string> = {
  Viettel: 'bg-telco-viettel/15 text-telco-viettel',
  Vina: 'bg-telco-vina/15 text-telco-vina',
  Mobi: 'bg-telco-mobi/15 text-telco-mobi',
  Vnmb: 'bg-telco-vnmb/15 text-telco-vnmb',
  Gmobile: 'bg-telco-gmobile/15 text-telco-gmobile',
  iTel: 'bg-telco-itel/15 text-telco-itel',
};

export function telcoClass(name: string): string {
  return TELCO_CLASS[name] ?? 'bg-muted text-muted-foreground';
}

export function parseOrderFlow(v: string | undefined): OrderFlow | undefined {
  return ORDER_FLOW_TABS.find((t) => t.flow === v)?.flow;
}

export function orderFlowLabel(f: OrderFlow): string {
  return ORDER_FLOW_TABS.find((t) => t.flow === f)?.label ?? f;
}
