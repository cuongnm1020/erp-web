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
