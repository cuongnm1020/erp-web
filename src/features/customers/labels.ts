import type { StatusTone } from '@/components/data/status-badge';
import type { Customer } from './api/use-customers';
import type { CustomerOrderItem, CustomerOrderStatus } from './api/use-customer-sales';

export type CustomerType = Customer['type'];

/** Nhãn tiếng Việt theo cái người dùng điều khiển, không theo enum của DB. */
const TYPE_LABEL: Record<CustomerType, string> = {
  RETAIL: 'Bán lẻ',
  WHOLESALE: 'Bán sỉ',
  DISTRIBUTOR: 'Nhà phân phối',
  KEY_ACCOUNT: 'Khách trọng điểm',
};

const TYPE_TONE: Record<CustomerType, StatusTone> = {
  RETAIL: 'neutral',
  WHOLESALE: 'draft',
  DISTRIBUTOR: 'brand',
  KEY_ACCOUNT: 'warn',
};

export function customerTypeLabel(t: CustomerType): string {
  return TYPE_LABEL[t];
}

export function customerTypeTone(t: CustomerType): StatusTone {
  return TYPE_TONE[t];
}

export const CUSTOMER_TYPE_OPTIONS: Array<{ value: CustomerType; label: string }> = (
  Object.keys(TYPE_LABEL) as CustomerType[]
).map((v) => ({ value: v, label: TYPE_LABEL[v] }));

/** Chữ cái đầu để dựng avatar chữ — tối đa 2 ký tự. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!;
  const last = words[words.length - 1]!;
  return (words.length === 1 ? first.slice(0, 2) : first[0]! + last[0]!).toUpperCase();
}

/**
 * Trạng thái / kênh đơn trong tab Lịch sử mua hàng (CRM-06). Chép cùng nhãn với
 * features/orders/labels.ts — luật 12 cấm import chéo feature; khoá lấy từ union của
 * CustomerOrderItemDto nên backend thêm giá trị thì TypeScript bắt lỗi ở đây.
 */
const ORDER_STATUS_LABEL: Record<CustomerOrderStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  POSTED: 'Đã chốt',
  CANCELLED: 'Đã hủy',
};

const ORDER_STATUS_TONE: Record<CustomerOrderStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'brand',
  POSTED: 'ok',
  CANCELLED: 'err',
};

const ORDER_CHANNEL_LABEL: Record<CustomerOrderItem['channel'], string> = {
  DIRECT: 'Trực tiếp',
  MARKETPLACE: 'Sàn TMĐT',
  WEBSITE: 'Website',
  POS: 'Tại quầy',
};

export const CUSTOMER_ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as CustomerOrderStatus[];

export function customerOrderStatusLabel(s: CustomerOrderStatus): string {
  return ORDER_STATUS_LABEL[s];
}

export function customerOrderStatusTone(s: CustomerOrderStatus): StatusTone {
  return ORDER_STATUS_TONE[s];
}

export function customerOrderChannelLabel(c: CustomerOrderItem['channel']): string {
  return ORDER_CHANNEL_LABEL[c];
}

/** Giá trị trên URL do người dùng dán — chỉ nhận đúng union của API. */
export function parseCustomerOrderStatus(v: string | null): CustomerOrderStatus | undefined {
  return v !== null && (CUSTOMER_ORDER_STATUSES as string[]).includes(v)
    ? (v as CustomerOrderStatus)
    : undefined;
}
