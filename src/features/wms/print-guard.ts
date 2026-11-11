import { formatDateTime } from '@/lib/format';

/**
 * Cảnh báo in trùng (PRINT-DUP-1, 2026-11-11, user chốt): đơn ĐÃ in tem VÀ ĐÃ gán NV đóng hàng
 * (bất kỳ ai) → in lẻ phải xác nhận mới in lại; in nhiều thì in đơn đủ điều kiện, đơn vướng không
 * in mà sang tab "Cảnh báo" của hộp kết quả (in lại từ đó cũng phải xác nhận). Áp dụng "Đóng gói +
 * in vận đơn", "In lại vận đơn" và tem ở trạm đóng gói.
 */
export interface PrintState {
  labelPrintedAt: string | null;
  packerName: string | null;
}

export function isPrintLocked(s: PrintState | null | undefined): boolean {
  return !!s?.labelPrintedAt && !!s.packerName;
}

/** "Đã in tem 09:12 11/11/2026 · NV đóng hàng Nguyễn Văn A". */
export function printLockReason(s: PrintState): string {
  const at = s.labelPrintedAt ? ` ${formatDateTime(s.labelPrintedAt)}` : '';
  return `Đã in tem${at} · NV đóng hàng ${s.packerName ?? ''}`;
}
