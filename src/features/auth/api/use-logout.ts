import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { forgetSavedListStates } from '@/lib/list-state-memory';
import { forgetWarehouseSelection } from '@/lib/warehouse';

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      // Route handler Next đọc refresh token từ cookie — không cần body.
      await api.POST('/auth/logout', { body: { refreshToken: '' }, parseAs: 'stream' });
    },
    onSettled: () => {
      forgetWarehouseSelection();
      // Bộ lọc lần gần nhất của các danh sách là của tài khoản vừa thoát — người đăng nhập sau
      // trên cùng trình duyệt không thừa hưởng.
      forgetSavedListStates();
      qc.clear();
      window.location.assign('/login');
    },
  });
}
