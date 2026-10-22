import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type CustomerWorkItem = components['schemas']['WorkItemSummaryDto'];

/**
 * Yêu cầu hỗ trợ / việc gắn khách (module Công việc, 2026-10-22) cho thẻ ở hồ sơ khách. Key nằm
 * dưới ['work','items',…] của module Công việc để thao tác ở /work/:id cũng làm mới thẻ này.
 */
export function useCustomerWork(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ['work', 'items', 'by-customer', customerId] as const,
    queryFn: () =>
      unwrap(
        api.GET('/work-items', {
          params: {
            query: { view: 'all', state: 'all', customerId, sort: 'created', take: 10, skip: 0 },
          },
        }),
      ),
    enabled,
  });
}
