'use client';

import { useUomName } from '@/lib/uom';

/**
 * Tên ĐVT theo mã (`BOX` → "Thùng") — cho ô bảng / chỗ JSX không gọi được hook. Chuỗi ghép
 * (toast, nhãn) dùng thẳng `useUomName()` trong component.
 */
export function UomText({ code }: { code: string | null | undefined }) {
  const name = useUomName();
  return <>{name(code)}</>;
}
