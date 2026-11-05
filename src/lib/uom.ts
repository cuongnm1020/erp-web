'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

/**
 * Tên đơn vị tính (2026-11-06, user: "đổi tên box thành thùng ở tất cả các màn"): API trả MÃ ĐVT
 * (`BOX`, `CHAI`…) trên dòng đơn / tồn / phiếu; màn hình hiện TÊN trong danh mục ĐVT ("Thùng",
 * "Chai"). Danh mục tải một lần (GET /uoms — mọi người đăng nhập), dùng chung query key với màn
 * Sản phẩm (`useUoms`) nên sửa tên ĐVT ở đó là mọi màn đổi theo. Mã không có trong danh mục (đã xóa,
 * mã gõ tay, chưa tải xong) → hiện nguyên mã.
 *
 * Chỉ dùng cho HIỂN THỊ. Mã vẫn là khóa gửi lên API / so sánh (`PACK_CARTON_UOM`…).
 */
export const UOMS_QUERY_KEY = ['catalog', 'uoms'] as const;

export function useUomName(): (code: string | null | undefined) => string {
  const { data } = useQuery({
    queryKey: UOMS_QUERY_KEY,
    queryFn: () => unwrap(api.GET('/uoms')),
    staleTime: 10 * 60 * 1000,
  });
  return useCallback(
    (code) => {
      if (!code) return '';
      return data?.find((u) => u.code === code)?.name ?? code;
    },
    [data],
  );
}
