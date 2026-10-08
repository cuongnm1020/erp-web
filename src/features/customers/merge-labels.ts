import { isApiError } from '@/lib/api/errors';
import { hasMessageFor, messageFor, messageForCode } from '@/lib/error-messages';
import type { CompareCustomer, CustomerRefCount, MergeField } from './api/use-customer-merge';

/** Trường được chọn lấy giá trị từ hồ sơ bị gộp — đúng khoá của `MergeFieldChoicesDto`. */
export const MERGE_FIELD_LABEL: Record<MergeField, string> = {
  name: 'Tên',
  phone: 'Số điện thoại',
  email: 'Email',
  taxCode: 'Mã số thuế',
  type: 'Loại khách',
  groupId: 'Nhóm khách',
  tierId: 'Cấp độ',
  priceListId: 'Bảng giá riêng',
  creditLimit: 'Hạn mức công nợ',
  paymentTerm: 'Hạn thanh toán',
};

/** `fieldsChanged` / `fieldsRestored` của API là string tự do — trường lạ giữ nguyên tên. */
export function mergeFieldLabel(f: string): string {
  return (MERGE_FIELD_LABEL as Record<string, string>)[f] ?? f;
}

export { CONSENT_CHANNEL_LABEL } from '@/lib/shared';

export function sourceLabel(s: CompareCustomer['source']): string {
  return s === 'PANCAKE' ? 'Pancake' : 'Tạo trên ERP';
}

/** Chỉ bảng có dòng (API `moved` liệt kê mọi bảng trong sổ đăng ký, kể cả 0). */
export function nonZero(refs: readonly CustomerRefCount[]): CustomerRefCount[] {
  return refs.filter((r) => r.count > 0);
}

export function refTotal(refs: readonly CustomerRefCount[]): number {
  return refs.reduce((s, r) => s + r.count, 0);
}

/** Số đơn bán theo khoá sổ đăng ký `core.SalesOrder.customerId` — 0 nếu không có. */
export function orderRefCount(refs: readonly CustomerRefCount[]): number {
  return refs.find((r) => r.key === 'core.SalesOrder.customerId')?.count ?? 0;
}

/**
 * Lỗi hoàn tác: 409 MERGE_UNDO_CONFLICT có `details.reason` (MERGED_CHANGED | SURVIVOR_MERGED)
 * → câu riêng cho từng nguyên nhân; vẫn đi qua bộ dịch duy nhất (luật 6).
 */
export function undoErrorMessage(err: unknown): string {
  if (isApiError(err) && err.code === 'MERGE_UNDO_CONFLICT') {
    const reason = (err.details as { reason?: unknown } | null | undefined)?.reason;
    const code = typeof reason === 'string' ? `MERGE_UNDO_CONFLICT_${reason}` : '';
    if (code && hasMessageFor(code)) return messageForCode(code, err.status);
  }
  return messageFor(err);
}
