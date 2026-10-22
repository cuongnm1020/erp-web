import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

/**
 * Yêu cầu hỗ trợ ĐANG MỞ gắn đơn (module Công việc, 2026-10-22) cho dải nhắc ở chi tiết đơn. Key
 * dưới ['work','items',…] để thao tác ở /work/:id làm mới luôn dải này.
 */
export function useOrderOpenWork(orderId: string, enabled = true) {
  return useQuery({
    queryKey: ['work', 'items', 'by-order', orderId] as const,
    queryFn: () =>
      unwrap(
        api.GET('/work-items', {
          params: { query: { view: 'all', state: 'open', orderId, take: 5, skip: 0 } },
        }),
      ),
    enabled,
  });
}
