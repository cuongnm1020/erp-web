import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type CarrierSetting = components['schemas']['CarrierSettingDto'];
export type CarrierSettingField = components['schemas']['CarrierSettingFieldDto'];
export type UpdateCarrierSettingInput = components['schemas']['UpdateCarrierSettingDto'];
export type CarrierVerifyResult = components['schemas']['CarrierVerifyResultDto'];

/** Query key theo phễu (luật 3): ['admin','carrier-settings']. */
export const carrierSettingsKeys = {
  all: ['admin', 'carrier-settings'] as const,
};

/** GET /carriers/settings — kết nối các hãng có adapter. Bí mật chỉ có 4 ký tự cuối. */
export function useCarrierSettings() {
  return useQuery({
    queryKey: carrierSettingsKeys.all,
    queryFn: () => unwrap(api.GET('/carriers/settings')),
  });
}

/** PUT /carriers/{code}/settings — trường bỏ qua = giữ, `null` = xoá về env. */
export function useUpdateCarrierSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, input }: { code: string; input: UpdateCarrierSettingInput }) =>
      unwrap(
        api.PUT('/carriers/{code}/settings', {
          params: { path: { code } },
          body: input,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: carrierSettingsKeys.all }),
  });
}

/**
 * POST /carriers/{code}/settings/verify — gọi thử hãng bằng cấu hình đang hiệu lực. Luôn 200,
 * kết quả ở `status`; server ghi lastVerified* nên luôn invalidate.
 */
export function useVerifyCarrierSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      unwrap(api.POST('/carriers/{code}/settings/verify', { params: { path: { code } } })),
    onSettled: () => void qc.invalidateQueries({ queryKey: carrierSettingsKeys.all }),
  });
}
