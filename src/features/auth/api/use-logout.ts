import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clearLastActivity, IDLE_LOGOUT_REASON } from '@/lib/auth/idle';
import { forgetWarehouseSelection } from '@/lib/warehouse';

export interface LogoutInput {
  /** Đăng xuất tự động vì không hoạt động → /login giải thích lý do và quay lại đúng trang. */
  reason?: typeof IDLE_LOGOUT_REASON;
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_input?: LogoutInput): Promise<void> => {
      // Route handler Next đọc refresh token từ cookie — không cần body.
      await api.POST('/auth/logout', { body: { refreshToken: '' }, parseAs: 'stream' });
    },
    onSettled: (_data, _err, input) => {
      forgetWarehouseSelection();
      clearLastActivity();
      qc.clear();
      if (input?.reason) {
        const next = window.location.pathname + window.location.search;
        window.location.assign(`/login?reason=${input.reason}&next=${encodeURIComponent(next)}`);
        return;
      }
      window.location.assign('/login');
    },
  });
}
