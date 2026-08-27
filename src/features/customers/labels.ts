import type { StatusTone } from '@/components/data/status-badge';
import type { Customer } from './api/use-customers';

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
