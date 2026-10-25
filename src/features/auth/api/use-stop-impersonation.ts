import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forgetWarehouseSelection } from '@/lib/warehouse';

/**
 * Thôi "đăng nhập với tư cách" — POST /api/auth/impersonate/stop (route BFF, không có trong
 * OpenAPI: đổi refresh đã cất của superadmin lấy phiên mới, thu hồi phiên đăng nhập thay). Thành
 * công → về màn Nhân viên (/admin/users, 2026-10-25) dưới tài khoản superadmin; phiên cất đã hết
 * hạn → route trả 401 và xoá cookie → về /login.
 */
export function useStopImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<boolean> => {
      const res = await fetch('/api/auth/impersonate/stop', {
        method: 'POST',
        credentials: 'same-origin',
      });
      return res.ok;
    },
    onSettled: (ok) => {
      forgetWarehouseSelection();
      qc.clear();
      window.location.assign(ok ? '/admin/users' : '/login');
    },
  });
}
