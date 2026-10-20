import type { StatusTone } from '@/components/data/status-badge';
import type { ReceiptStage } from '../api/use-receipts';

/**
 * Tiến độ phiếu nhập kho (`GoodsReceipt.stage`, 2026-10-20) — thứ người kho / kế toán theo dõi,
 * khác với DocStatus (tính bất biến của chứng từ): Mới tạo → Đang cất hàng → Chờ nhập giá (hàng
 * đã lên kệ, bán được; kế toán chưa nhập giá) → Hoàn thành.
 */
export const GRN_STAGE: Record<ReceiptStage, { label: string; tone: StatusTone }> = {
  NEW: { label: 'Mới tạo', tone: 'draft' },
  PUTTING_AWAY: { label: 'Đang cất hàng', tone: 'brand' },
  AWAITING_COST: { label: 'Chờ nhập giá', tone: 'warn' },
  COMPLETED: { label: 'Hoàn thành', tone: 'ok' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};
