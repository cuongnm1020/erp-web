import type { StatusTone } from '@/components/data/status-badge';
import type { ReturnReceiptStatus } from '../api/use-returns';

export const RETURN_STATUS: Record<ReturnReceiptStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nháp', tone: 'draft' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warn' },
  APPROVED: { label: 'Đã duyệt', tone: 'brand' },
  POSTED: { label: 'Đã post', tone: 'ok' },
  CANCELLED: { label: 'Hủy', tone: 'err' },
};

export const DISPOSITION_LABEL: Record<'RESTOCK' | 'SCRAP', { label: string; tone: StatusTone }> = {
  RESTOCK: { label: 'Nhập lại kho', tone: 'ok' },
  SCRAP: { label: 'Hủy (hỏng)', tone: 'err' },
};
