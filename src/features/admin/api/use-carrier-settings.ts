import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type CarrierSetting = components['schemas']['CarrierSettingDto'];
export type CarrierAccount = components['schemas']['CarrierAccountDto'];
export type CarrierSettingField = components['schemas']['CarrierSettingFieldDto'];
export type UpdateCarrierSettingInput = components['schemas']['UpdateCarrierSettingDto'];
export type CreateCarrierAccountInput = components['schemas']['CreateCarrierAccountDto'];
export type UpdateCarrierAccountInput = components['schemas']['UpdateCarrierAccountDto'];
export type CarrierVerifyResult = components['schemas']['CarrierVerifyResultDto'];

/** Query key theo phễu (luật 3): ['admin','carrier-settings']. */
export const carrierSettingsKeys = {
  all: ['admin', 'carrier-settings'] as const,
};

/** GET /carriers/settings — các hãng có adapter + mọi tài khoản của hãng. Bí mật chỉ có 4 ký tự cuối. */
export function useCarrierSettings() {
  return useQuery({
    queryKey: carrierSettingsKeys.all,
    queryFn: () => unwrap(api.GET('/carriers/settings')),
  });
}

/**
 * Đổi tài khoản thì danh sách hãng của popup "Gửi sang ĐVVC" (GET /carriers, key
 * `shippingKeys.carriers()` bên features/wms — không import chéo feature, luật 12) cũng đổi.
 */
const CARRIERS_KEY = ['wms', 'shipping', 'carriers'] as const;

function useInvalidateCarriers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: carrierSettingsKeys.all });
    void qc.invalidateQueries({ queryKey: CARRIERS_KEY });
  };
}

/** POST /carriers/{code}/accounts — thêm tài khoản (tên + trường kết nối). */
export function useCreateCarrierAccount() {
  const invalidate = useInvalidateCarriers();
  return useMutation({
    mutationFn: ({ code, input }: { code: string; input: CreateCarrierAccountInput }) =>
      unwrap(api.POST('/carriers/{code}/accounts', { params: { path: { code } }, body: input })),
    onSuccess: invalidate,
  });
}

/** PATCH /carriers/{code}/accounts/{accountId} — trường bỏ qua = giữ, `null` = xoá. */
export function useUpdateCarrierAccount() {
  const invalidate = useInvalidateCarriers();
  return useMutation({
    mutationFn: ({
      code,
      accountId,
      input,
    }: {
      code: string;
      accountId: string;
      input: UpdateCarrierAccountInput;
    }) =>
      unwrap(
        api.PATCH('/carriers/{code}/accounts/{accountId}', {
          params: { path: { code, accountId } },
          body: input,
        }),
      ),
    onSuccess: invalidate,
  });
}

/** POST /carriers/{code}/accounts/{accountId}/default — đơn không chọn tài khoản dùng tài khoản này. */
export function useSetDefaultCarrierAccount() {
  const invalidate = useInvalidateCarriers();
  return useMutation({
    mutationFn: ({ code, accountId }: { code: string; accountId: string }) =>
      unwrap(
        api.POST('/carriers/{code}/accounts/{accountId}/default', {
          params: { path: { code, accountId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** DELETE /carriers/{code}/accounts/{accountId} — chỉ tài khoản chưa từng cấp vận đơn. */
export function useDeleteCarrierAccount() {
  const invalidate = useInvalidateCarriers();
  return useMutation({
    mutationFn: ({ code, accountId }: { code: string; accountId: string }) =>
      unwrap(
        api.DELETE('/carriers/{code}/accounts/{accountId}', {
          params: { path: { code, accountId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/**
 * POST /carriers/{code}/accounts/{accountId}/verify — gọi thử hãng bằng tài khoản này. Luôn 200,
 * kết quả ở `status`; server ghi lastVerified* nên luôn invalidate.
 */
export function useVerifyCarrierAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, accountId }: { code: string; accountId: string }) =>
      unwrap(
        api.POST('/carriers/{code}/accounts/{accountId}/verify', {
          params: { path: { code, accountId } },
        }),
      ),
    onSettled: () => void qc.invalidateQueries({ queryKey: carrierSettingsKeys.all }),
  });
}
