import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { forgetWarehouseSelection } from '@/lib/warehouse';

/**
 * POST /auth/impersonate — superadmin đăng nhập với tư cách người dùng (2026-10-19). Route BFF
 * /api/auth/impersonate đổi cookie sang phiên của người đó và cất phiên superadmin; token không tới
 * JS. Xong thì bỏ toàn bộ cache + kho đang chọn rồi tải lại trang chủ dưới danh tính mới.
 */
export function useImpersonate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.POST('/auth/impersonate', { body: { userId }, parseAs: 'stream' })),
    onSuccess: () => {
      forgetWarehouseSelection();
      qc.clear();
      window.location.assign('/');
    },
  });
}
