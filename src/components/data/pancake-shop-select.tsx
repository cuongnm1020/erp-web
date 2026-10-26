'use client';

import { SearchableSelect } from './searchable-select';

/** Hình tối thiểu của một POS Pancake (PancakeShopOptionDto — GET /pancake-sync/shops). */
export interface PancakeShopLike {
  shopId: string;
  shopName: string | null;
  isActive: boolean;
}

/** Nhãn POS dùng chung mọi màn: tên shop (chưa đặt tên → "POS <mã>") + "(đã ngắt)" khi tắt. */
export function pancakeShopLabel(s: PancakeShopLike): string {
  return `${s.shopName ?? `POS ${s.shopId}`}${s.isActive ? '' : ' (đã ngắt)'}`;
}

/**
 * Ô chọn POS Pancake có ô tìm theo tên shop — hàng chục POS nên không dùng select thường.
 * Cùng ô với lọc "Nguồn" ở danh sách đơn (SearchableSelect).
 */
export function PancakeShopSelect({
  shops,
  value,
  onChange,
  label = 'POS Pancake',
  allLabel,
  className,
}: {
  shops: PancakeShopLike[];
  value: string | undefined;
  onChange: (shopId: string | undefined) => void;
  label?: string;
  allLabel?: string;
  className?: string;
}) {
  return (
    <SearchableSelect
      label={label}
      allLabel={allLabel}
      value={value}
      options={shops.map((s) => ({ value: s.shopId, label: pancakeShopLabel(s) }))}
      onChange={onChange}
      className={className}
    />
  );
}
