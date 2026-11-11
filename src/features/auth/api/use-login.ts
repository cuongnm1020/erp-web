import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/errors';
import { forgetWarehouseSelection } from '@/lib/warehouse';
import type { LoginInput } from '../schema';

/**
 * POST /api/auth/login (route handler Next) → cookie httpOnly. Không có token trong data.
 * Không dùng unwrap(): route trả 204 rỗng, khác kiểu TokenPairDto của API gốc.
 */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<void> => {
      const { response } = await api.POST('/auth/login', { body: input, parseAs: 'stream' });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => undefined);
        throw toApiError(response, body);
      }
    },
    onSuccess: () => {
      // Mỗi lần đăng nhập về kho mặc định của tài khoản (PLAN-warehouse-context).
      forgetWarehouseSelection();
      qc.removeQueries({ queryKey: ['auth'] });
    },
  });
}
