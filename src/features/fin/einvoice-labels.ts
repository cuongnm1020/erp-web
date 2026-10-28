import type { StatusTone } from '@/components/data/status-badge';
import type { CarrierReconOutcome, EInvoiceStatus } from './api/use-einvoices';

/** Nhãn + tone trạng thái hóa đơn điện tử (docs/PLAN-einvoice-misa.md §12). */
export const EINVOICE_STATUS: Record<EInvoiceStatus, { label: string; tone: StatusTone }> = {
  PENDING_REVIEW: { label: 'Chờ duyệt', tone: 'warn' },
  APPROVED: { label: 'Đã duyệt', tone: 'brand' },
  PUSHED: { label: 'Đã đẩy nháp', tone: 'draft' },
  ISSUED: { label: 'Đã phát hành', tone: 'ok' },
  FAILED: { label: 'Lỗi', tone: 'err' },
  SKIPPED: { label: 'Không xuất', tone: 'neutral' },
};

/** Thứ tự tab trên màn danh sách. */
export const EINVOICE_TABS: EInvoiceStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'PUSHED',
  'ISSUED',
  'FAILED',
  'SKIPPED',
];

/** Vấn đề của hóa đơn: chặn duyệt (`block`) hay chỉ cảnh báo. */
export const EINVOICE_ISSUE: Record<string, { label: string; block: boolean }> = {
  MISSING_TAX_RATE: { label: 'Sản phẩm chưa gán thuế suất', block: true },
  AMOUNT_MISMATCH: { label: 'Tổng dòng lệch tiền phải xuất', block: true },
  PARTIAL_DELIVERY: { label: 'Hãng thu thiếu — sửa số lượng khách nhận', block: true },
  BUYER_MISSING: { label: 'Thiếu tên người mua', block: true },
  NOT_RECONCILED: { label: 'Chưa có đối soát của hãng', block: false },
  OVER_COLLECTED: { label: 'Hãng thu nhiều hơn đơn', block: false },
};

export function issueLabel(code: string): string {
  return EINVOICE_ISSUE[code]?.label ?? code;
}

export const RECON_OUTCOME: Record<CarrierReconOutcome, { label: string; tone: StatusTone }> = {
  MATCHED: { label: 'Khớp tiền', tone: 'ok' },
  SHORT: { label: 'Thu thiếu', tone: 'warn' },
  OVER: { label: 'Thu dư', tone: 'warn' },
  ZERO: { label: 'Thu 0 ₫ — không xuất', tone: 'neutral' },
  SUBSIDIARY: { label: 'Mã phụ (đổi / hoàn một phần)', tone: 'neutral' },
  NOT_DELIVERED: { label: 'Chưa giao', tone: 'draft' },
  NOT_FOUND: { label: 'Không thấy đơn', tone: 'err' },
};

export const RECON_OUTCOMES: CarrierReconOutcome[] = [
  'MATCHED',
  'SHORT',
  'OVER',
  'ZERO',
  'SUBSIDIARY',
  'NOT_DELIVERED',
  'NOT_FOUND',
];

export const CARRIER_NAME: Record<string, string> = {
  VTP: 'Viettel Post',
  GHTK: 'GHTK',
  VNPOST: 'VNPost',
  'J&T': 'J&T',
  GHN: 'GHN',
};
