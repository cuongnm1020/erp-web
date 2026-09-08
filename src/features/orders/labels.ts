import type { StatusTone } from '@/components/data/status-badge';
import type { SalesOrderChannel, SalesOrderStatus } from './api/use-orders';

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
export function orderEditable(status: SalesOrderStatus): boolean {
  return status !== 'POSTED' && status !== 'CANCELLED';
}
