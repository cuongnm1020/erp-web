import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/** CSKH-6 (2026-10-21) — % khách mới chia về team CSKH + lịch sử lượt chia. */
export type CareDistributionConfig = components['schemas']['CareDistributionConfigDto'];
export type CareDistributionRun = components['schemas']['CareDistributionRunDto'];
export type UpdateCareDistributionInput = components['schemas']['UpdateCareDistributionDto'];

/** Query key theo phễu (luật 3): ['admin','care-distribution']. */
export const careDistributionKeys = {
  all: ['admin', 'care-distribution'] as const,
};

/** GET /customer-care/distribution — team CSKH đang hoạt động kèm %, lịch chạy, 30 lượt gần nhất. */
export function useCareDistribution() {
  return useQuery({
    queryKey: careDistributionKeys.all,
    queryFn: () => unwrap(api.GET('/customer-care/distribution')),
  });
}

/** PUT /customer-care/distribution — ghi đè %; tổng các team > 0 phải đúng 100 (422). */
export function useUpdateCareDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCareDistributionInput) =>
      unwrap(api.PUT('/customer-care/distribution', { body: input })),
    onSuccess: (data) => qc.setQueryData(careDistributionKeys.all, data),
  });
}

/** POST /customer-care/distribution/run — chia ngay khách tạo trong `day` (mặc định hôm qua). */
export function useRunCareDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: string | undefined) =>
      unwrap(api.POST('/customer-care/distribution/run', { body: day ? { day } : {} })),
    onSuccess: () => qc.invalidateQueries({ queryKey: careDistributionKeys.all }),
  });
}
