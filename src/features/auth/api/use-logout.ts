import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
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
      qc.clear();
      window.location.assign('/login');
    },
  });
}
