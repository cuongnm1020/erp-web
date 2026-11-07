import Decimal from 'decimal.js';
import type { StatusTone } from '@/components/data/status-badge';
import { formatMoney } from '@/lib/format';
import type {
  CarrierIssue,
  CarrierStage,
  OrderFlow,
  OrderTab,
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
  // Đơn tạo trên ERP chờ người tạo "Xác nhận" (2026-10-31).
  DRAFT: 'Đơn mới',
  PENDING_APPROVAL: 'Chờ duyệt',
  // Khớp Pancake 1 "Đã xác nhận" và tab Đã xác nhận (2026-11-07, bỏ nhãn "Đã duyệt").
  APPROVED: 'Đã xác nhận',
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

type OrderSource = NonNullable<SalesOrderDetail['source']>;

const SOURCE_LABEL: Record<OrderSource, string> = {
  FACEBOOK: 'Facebook',
  ZALO: 'Zalo',
  TIKTOK: 'TikTok',
  PHONE: 'Gọi điện',
  WEBSITE: 'Website',
  WALK_IN: 'Khách đến cửa hàng',
  REFERRAL: 'Người quen giới thiệu',
  OTHER: 'Khác',
};

/** Nguồn đơn — khách tìm đến qua đâu. */
export function orderSourceLabel(s: OrderSource): string {
  return SOURCE_LABEL[s];
}

export const GENDER_LABEL: Record<'MALE' | 'FEMALE' | 'OTHER', string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
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

/** Kho đã đóng gói trở đi — tồn đã trừ, server chặn hủy (ORDER_ALREADY_PACKED). */
const PACKED_OR_LATER: ReadonlySet<string> = new Set([
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'CARRIER_CANCELLED',
]);

/**
 * Gợi ý đơn còn hủy được trên danh sách: chưa hủy và kho chưa đóng gói. Người có quyền hủy sau
 * khi gán ĐVVC (`afterCarrier`, 2026-11-02) hủy được cả đơn đã đóng gói mà hãng chưa lấy hàng
 * (server gọi hãng hủy vận đơn + tự nhập lại kho). Chỉ để bỏ bớt đơn chắc chắn hỏng trước khi gửi —
 * server vẫn là nơi quyết định (đơn lệch pha về `failed`).
 */
export function orderCancellable(
  status: SalesOrderStatus,
  fulfilmentStatus: string | null,
  /**
   * Người có quyền Hủy đơn (`sales_order.cancel`, 2026-11-07): hủy được tới trước Thành công —
   * đã đóng gói (chưa trừ tồn) hủy luôn; hãng đã lấy hàng thì chuyển Sự cố hoàn, nhập hàng hoàn
   * xong mới hủy.
   */
  canCancelAny = false,
): boolean {
  if (status === 'CANCELLED' || !fulfilmentStatus) return status !== 'CANCELLED';
  return canCancelAny ? fulfilmentStatus !== 'DELIVERED' : !PACKED_OR_LATER.has(fulfilmentStatus);
}
// ── Trạng thái KHO của đơn (fulfilment) — suy từ task PICK/PACK + phiếu giao ở server ──

export type OrderFulfilmentStatus = SalesOrderDetail['fulfilment']['status'];
export type FulfilTarget = 'PICKED' | 'PACKED';

const FULFILMENT_LABEL: Record<OrderFulfilmentStatus, string> = {
  NOT_STARTED: 'Chờ pick',
  PICKING: 'Đang pick',
  PICKED: 'Đã pick xong',
  PACKING: 'Đang đóng gói',
  // Tên theo Pancake (2026-10-31): đóng gói + in xong = 9 "Chờ chuyển hàng", hãng quét = 2 "Đã gửi hàng".
  PACKED: 'Chờ chuyển hàng',
  SHIPPED: 'Đã gửi hàng',
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

/**
 * Tạm tính / giảm giá để HIỂN THỊ (2026-11-03, SOP2610-107393). Đơn Pancake lưu `subtotal` theo GIÁ
 * NIÊM YẾT và `discount` = chiết khấu từng dòng (niêm yết − giá bán, kể cả hàng tặng 0 đ) + giảm cấp
 * đơn → màn thấy "Tạm tính 1.596.000, Giảm giá −171.000" dù không ai giảm thêm. Hiện như đơn ERP:
 * tạm tính = Σ thành tiền, giảm giá = chỉ phần cấp đơn. Tổng tiền không đổi.
 */
export function shownAmounts(
  o: Pick<SalesOrderDetail, 'pancakeOrderId' | 'subtotal' | 'discount'> & {
    lines: ReadonlyArray<Pick<SalesOrderDetail['lines'][number], 'discount' | 'lineTotal'>>;
  },
): { subtotal: string; discount: string } {
  if (o.pancakeOrderId == null) return { subtotal: o.subtotal, discount: o.discount };
  const lines = o.lines.reduce((s, l) => s.plus(l.lineTotal), new Decimal(0));
  const lineDiscount = o.lines.reduce((s, l) => s.plus(l.discount), new Decimal(0));
  return {
    subtotal: lines.toFixed(4),
    discount: Decimal.max(new Decimal(o.discount).minus(lineDiscount), 0).toFixed(4),
  };
}

// ── Tab danh sách đơn (2026-10-12) — luồng chung, docs/carrier-status-mapping.md ở apps/api ──

/**
 * Họ trạng thái theo giai đoạn (design system: 5 họ `flow-*` + `flow-off`) — tab cùng họ đứng
 * cạnh nhau, vạch dọc tách họ, chấm màu ở tab đầu họ (redesign Bán hàng 2026-10-22).
 */
export type OrderFlowFamily = 'wait' | 'fulfil' | 'ship' | 'done' | 'issue' | 'off';

/** Thứ tự tab; `family` = họ màu của trạng thái. */
export const ORDER_FLOW_TABS: ReadonlyArray<{
  flow: OrderFlow;
  label: string;
  family: OrderFlowFamily;
}> = [
  // Đơn mới (2026-10-31): đơn tạo trên ERP chờ người tạo "Xác nhận" / đơn Pancake 0 "Mới".
  { flow: 'NEW', label: 'Đơn mới', family: 'wait' },
  { flow: 'PENDING_APPROVAL', label: 'Chờ duyệt', family: 'wait' },
  { flow: 'WAREHOUSE', label: 'Đã xác nhận', family: 'fulfil' },
  // Chờ hàng (2026-10-25; luật ≥ 24h bỏ 2026-11-03): kho chuyển tay / Pancake 11 — cần người xử lý → họ "chờ".
  { flow: 'WAITING_STOCK', label: 'Chờ hàng', family: 'wait' },
  // "Đang đóng hàng" (2026-11-07, user chốt; trước "Đang lấy hàng"): đã Gửi sang ĐVVC tới khi PDA
  // đóng gói xong — gồm cả đơn đóng gói TAY (chưa sang Chờ chuyển hàng tới khi hãng lấy).
  { flow: 'PICKING', label: 'Đang đóng hàng', family: 'fulfil' },
  { flow: 'PACKED', label: 'Chờ chuyển hàng', family: 'fulfil' },
  // Cần sửa (2026-11-02, thay tab Lỗi vận đơn): hãng không cấp được mã + đơn chưa đóng gói có SP
  // ngoài hệ thống (món gõ tay / SP Pancake tự tạo) — không được Gửi sang ĐVVC tới khi sửa xong.
  { flow: 'NEEDS_FIX', label: 'Cần sửa', family: 'issue' },
  { flow: 'PICKED_UP', label: 'Đã gửi hàng', family: 'ship' },
  { flow: 'IN_TRANSIT', label: 'Đang vận chuyển', family: 'ship' },
  { flow: 'OUT_FOR_DELIVERY', label: 'Đang giao hàng', family: 'ship' },
  { flow: 'DELIVERED', label: 'Thành công', family: 'done' },
  { flow: 'RETURNED', label: 'Sự cố hoàn', family: 'issue' },
  { flow: 'CARRIER_CANCELLED', label: 'Hãng hủy', family: 'issue' },
  { flow: 'CANCELLED', label: 'Đã hủy', family: 'off' },
];

/**
 * 4 khối trạng thái của danh sách đơn (design system FlowTabs v3, 2026-11-04): mỗi khối một họ
 * màu, 14 trạng thái hiện cùng lúc. `flows` là trạng thái còn mở, `done` là trạng thái kết thúc
 * đứng cuối khối (Đã hủy, Thành công). Khối không có tên / tổng số trên màn — `label` chỉ để đọc
 * màn hình (aria-label).
 */
export type OrderFlowGroup = 'wait' | 'fulfil' | 'issue' | 'ship';

export const ORDER_FLOW_GROUPS: ReadonlyArray<{
  group: OrderFlowGroup;
  label: string;
  family: OrderFlowFamily;
  flows: readonly OrderFlow[];
  done: readonly OrderFlow[];
}> = [
  {
    group: 'wait',
    label: 'Chờ xử lý',
    family: 'wait',
    // Bỏ tab Chờ duyệt (2026-11-07, user chốt) trên Đơn hàng + In đơn — đơn Chờ duyệt vẫn xem được
    // qua "Tất cả" / tìm kiếm và ô lọc trạng thái.
    flows: ['NEW', 'WAITING_STOCK'],
    done: [],
  },
  {
    group: 'fulfil',
    label: 'Kho',
    family: 'fulfil',
    flows: ['WAREHOUSE', 'PICKING', 'PACKED'],
    done: [],
  },
  {
    group: 'issue',
    label: 'Cần xử lý',
    family: 'issue',
    flows: ['NEEDS_FIX', 'RETURNED', 'CARRIER_CANCELLED'],
    done: ['CANCELLED'],
  },
  {
    group: 'ship',
    label: 'Vận chuyển',
    family: 'ship',
    flows: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
    done: ['DELIVERED'],
  },
];

/** Trạng thái chọn sẵn khi URL không có `flow` (2026-11-04: Đơn mới). */
export const DEFAULT_ORDER_FLOW: OrderFlow = 'NEW';

/**
 * Luồng chung của một đơn ở màn chi tiết (DTO chi tiết không có `flow` như dòng danh sách): suy từ
 * trạng thái chứng từ + trạng thái kho/giao. `null` = không xếp được vào luồng (việc kho bị hủy
 * trong khi đơn còn sống) — màn không vẽ thanh tiến độ.
 */
export function detailOrderFlow(
  status: SalesOrderStatus,
  fulfilment: OrderFulfilmentStatus,
): OrderFlow | null {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DRAFT') return 'NEW';
  if (status === 'PENDING_APPROVAL') return 'PENDING_APPROVAL';
  switch (fulfilment) {
    case 'NOT_STARTED':
      return 'WAREHOUSE';
    case 'PICKING':
    case 'PICKED':
    case 'PACKING':
      return 'PICKING';
    case 'PACKED':
      return 'PACKED';
    case 'SHIPPED':
      return 'PICKED_UP';
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'OUT_FOR_DELIVERY':
    case 'FAILED':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'RETURNED':
      return 'RETURNED';
    case 'CARRIER_CANCELLED':
      return 'CARRIER_CANCELLED';
    default:
      return null;
  }
}

/** Chấm màu của họ trạng thái (nguyên class để Tailwind thấy). */
export const FLOW_FAMILY_DOT: Record<OrderFlowFamily, string> = {
  wait: 'bg-flow-wait',
  fulfil: 'bg-flow-fulfil',
  ship: 'bg-flow-ship',
  done: 'bg-flow-done',
  issue: 'bg-flow-issue',
  off: 'bg-flow-off',
};

/**
 * Mỗi trạng thái một màu chữ, nền cùng màu 10% (token --flow-* trong globals.css). Viết nguyên
 * class — Tailwind chỉ sinh class thấy được trong mã nguồn.
 */
const FLOW_CLASS: Record<OrderFlow, string> = {
  // Đơn mới (2026-10-31) cùng họ "chờ" với Chờ duyệt — dùng lại màu đó, không thêm token.
  NEW: 'bg-flow-pending-weak text-flow-pending',
  PENDING_APPROVAL: 'bg-flow-pending-weak text-flow-pending',
  WAREHOUSE: 'bg-flow-warehouse-weak text-flow-warehouse',
  WAITING_STOCK: 'bg-flow-wait-weak text-flow-wait',
  PICKING: 'bg-flow-picking-weak text-flow-picking',
  PACKED: 'bg-flow-packed-weak text-flow-packed',
  NEEDS_FIX: 'bg-destructive-weak text-destructive',
  PICKED_UP: 'bg-flow-picked-up-weak text-flow-picked-up',
  IN_TRANSIT: 'bg-flow-in-transit-weak text-flow-in-transit',
  OUT_FOR_DELIVERY: 'bg-flow-out-for-delivery-weak text-flow-out-for-delivery',
  DELIVERED: 'bg-flow-delivered-weak text-flow-delivered',
  RETURNED: 'bg-flow-returned-weak text-flow-returned',
  CARRIER_CANCELLED: 'bg-flow-carrier-cancelled-weak text-flow-carrier-cancelled',
  CANCELLED: 'bg-flow-cancelled-weak text-flow-cancelled',
};

export function orderFlowClass(f: OrderFlow): string {
  return FLOW_CLASS[f];
}

/** Màu chữ của nhà mạng + nền cùng màu 15% (token --telco-*). Không nhận ra → xám. */
const TELCO_CLASS: Record<string, string> = {
  Viettel: 'bg-telco-viettel-weak text-telco-viettel',
  Vina: 'bg-telco-vina-weak text-telco-vina',
  Mobi: 'bg-telco-mobi-weak text-telco-mobi',
  Vnmb: 'bg-telco-vnmb-weak text-telco-vnmb',
  Gmobile: 'bg-telco-gmobile-weak text-telco-gmobile',
  iTel: 'bg-telco-itel-weak text-telco-itel',
};

export function telcoClass(name: string): string {
  return TELCO_CLASS[name] ?? 'bg-muted text-muted-foreground';
}

export function parseOrderFlow(v: string | undefined): OrderFlow | undefined {
  // Link cũ ?flow=WAYBILL_ERROR (tab Lỗi vận đơn, nay gộp vào Cần sửa 2026-11-02).
  if (v === 'WAYBILL_ERROR') return 'NEEDS_FIX';
  return ORDER_FLOW_TABS.find((t) => t.flow === v)?.flow;
}

// ── Tab cha "Đơn hàng" / "Cần xử lý" (2026-11-07, mockup SbgUqZzjfFrgyto7HKPeVC đã duyệt) ──

/** Chip tab cha "Đơn hàng" — mỗi đơn đúng một chip (API `?tab=`). */
export const ORDER_TAB_DEFS: ReadonlyArray<{
  tab: OrderTab;
  label: string;
  family: OrderFlowFamily;
}> = [
  { tab: 'NEW', label: 'Đơn mới', family: 'wait' },
  { tab: 'WAITING_STOCK', label: 'Chờ hàng', family: 'wait' },
  { tab: 'WAREHOUSE', label: 'Đã xác nhận', family: 'fulfil' },
  { tab: 'PICKING', label: 'Đang đóng hàng', family: 'fulfil' },
  { tab: 'PACKED', label: 'Chờ chuyển hàng', family: 'fulfil' },
  { tab: 'SHIPPED', label: 'Đã gửi hàng', family: 'ship' },
  { tab: 'OUT_FOR_DELIVERY', label: 'Đang giao', family: 'ship' },
  { tab: 'DELIVERED', label: 'Đã nhận', family: 'done' },
  { tab: 'PAID', label: 'Đã thu tiền', family: 'done' },
  { tab: 'RETURNING', label: 'Đang hoàn', family: 'issue' },
  { tab: 'PARTIAL', label: 'Hoàn 1 phần', family: 'issue' },
  { tab: 'RETURNED', label: 'Đã hoàn', family: 'off' },
  { tab: 'CANCELLED', label: 'Đã hủy', family: 'off' },
];

/**
 * Chip tab cha "Cần xử lý" (API `?carrierIssue=`). Chưa đối soát không cộng vào số tab cha và
 * không vào chip "Tất cả" ({@link CARRIER_ISSUES_QUIET}).
 */
export const CARRIER_ISSUE_DEFS: ReadonlyArray<{
  issue: CarrierIssue;
  label: string;
  family: OrderFlowFamily;
}> = [
  { issue: 'NEEDS_FIX', label: 'Cần sửa', family: 'issue' },
  { issue: 'PICKUP_DELAYED', label: 'Trễ lấy hàng', family: 'issue' },
  { issue: 'PICKUP_FAILED', label: 'Không lấy được hàng', family: 'issue' },
  { issue: 'CARRIER_CANCELLED', label: 'Hãng hủy', family: 'issue' },
  { issue: 'DELIVERY_DELAYED', label: 'Trễ giao hàng', family: 'issue' },
  { issue: 'DELIVERY_FAILED', label: 'Giao không thành công', family: 'issue' },
  { issue: 'UNRECONCILED', label: 'Chưa đối soát', family: 'done' },
  { issue: 'RECON_MISMATCH', label: 'Đối soát lệch', family: 'issue' },
  { issue: 'RETURNED_TO_SENDER', label: 'Hãng đã trả hàng', family: 'issue' },
  { issue: 'INCIDENT', label: 'Sự cố', family: 'issue' },
];

/**
 * Chip Cần xử lý chỉ xem khi bấm đúng chip (user chốt 2026-11-07): đơn hãng đã giao Thành công
 * chờ tiền về không lẫn vào chip "Tất cả" của Cần xử lý. Cùng luật `CARRIER_ISSUES_QUIET` bên api.
 */
export const CARRIER_ISSUES_QUIET: readonly CarrierIssue[] = ['UNRECONCILED'];

/** Chip "Tất cả" của Cần xử lý gửi API = mọi chip trừ {@link CARRIER_ISSUES_QUIET}. */
export const CARRIER_ISSUES_ALL: readonly CarrierIssue[] = CARRIER_ISSUE_DEFS.map(
  (d) => d.issue,
).filter((i) => !CARRIER_ISSUES_QUIET.includes(i));

export const DEFAULT_ORDER_TAB: OrderTab = 'NEW';

/**
 * `?flow=` trên URL giữ chip "Đơn hàng" (link cũ / màn khác dùng tên tab cũ vẫn mở đúng chip).
 * Tên cũ không còn chip: Đã lấy hàng / Đang vận chuyển → Đã gửi hàng, Thành công → Đã nhận, Sự cố
 * hoàn → Đang hoàn. Cần sửa / Hãng hủy → {@link parseLegacyIssue}.
 */
export function parseOrderTab(v: string | undefined): OrderTab | undefined {
  if (v === 'PICKED_UP' || v === 'IN_TRANSIT') return 'SHIPPED';
  return ORDER_TAB_DEFS.find((t) => t.tab === v)?.tab;
}

export function parseCarrierIssue(v: string | undefined): CarrierIssue | undefined {
  return CARRIER_ISSUE_DEFS.find((t) => t.issue === v)?.issue;
}

/** Link cũ `?flow=NEEDS_FIX` / `WAYBILL_ERROR` / `CARRIER_CANCELLED` → chip "Cần xử lý". */
export function parseLegacyIssue(v: string | undefined): CarrierIssue | undefined {
  if (v === 'NEEDS_FIX' || v === 'WAYBILL_ERROR') return 'NEEDS_FIX';
  if (v === 'CARRIER_CANCELLED') return 'CARRIER_CANCELLED';
  return undefined;
}

export function orderTabLabel(t: OrderTab): string {
  return ORDER_TAB_DEFS.find((d) => d.tab === t)?.label ?? t;
}

export function carrierIssueLabel(i: CarrierIssue): string {
  return CARRIER_ISSUE_DEFS.find((d) => d.issue === i)?.label ?? i;
}

/** Cột "Thẻ" tab Cần xử lý — chữ + họ màu của trạng thái hãng. */
const CARRIER_STAGE_DEFS: Record<CarrierStage, { label: string; family: OrderFlowFamily }> = {
  WAITING_PICKUP: { label: 'Chờ lấy hàng', family: 'fulfil' },
  PICKUP_DELAYED: { label: 'Trễ lấy hàng', family: 'issue' },
  PICKUP_FAILED: { label: 'Không lấy được hàng', family: 'issue' },
  CARRIER_CANCELLED: { label: 'Hãng hủy', family: 'issue' },
  IN_TRANSIT: { label: 'Đang vận chuyển', family: 'ship' },
  OUT_FOR_DELIVERY: { label: 'Đang giao', family: 'ship' },
  DELIVERY_DELAYED: { label: 'Trễ giao hàng', family: 'issue' },
  DELIVERY_FAILED: { label: 'Giao không thành công', family: 'issue' },
  DELIVERED: { label: 'Chưa đối soát', family: 'done' },
  PAID: { label: 'Đã thu tiền', family: 'done' },
  RECON_MISMATCH: { label: 'Đối soát lệch', family: 'issue' },
  PARTIAL: { label: 'Hoàn 1 phần', family: 'issue' },
  RETURNING: { label: 'Đang hoàn', family: 'issue' },
  RETURNED_TO_SENDER: { label: 'Hãng đã trả hàng', family: 'issue' },
  RETURN_RECEIVED: { label: 'Đã nhập hàng hoàn', family: 'off' },
  INCIDENT: { label: 'Sự cố', family: 'issue' },
};

export function carrierStageLabel(s: CarrierStage): string {
  return CARRIER_STAGE_DEFS[s].label;
}

export function carrierStageFamily(s: CarrierStage): OrderFlowFamily {
  return CARRIER_STAGE_DEFS[s].family;
}

export function orderFlowLabel(f: OrderFlow): string {
  return ORDER_FLOW_TABS.find((t) => t.flow === f)?.label ?? f;
}
