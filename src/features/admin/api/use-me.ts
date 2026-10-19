import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type MyProfile = components['schemas']['MyProfileDto'];
export type UpdateMyProfileInput = components['schemas']['UpdateMyProfileDto'];
export type ChangeMyPasswordInput = components['schemas']['ChangeMyPasswordDto'];

/** Phễu key (luật 3): ['admin','me','profile']. */
export const meKeys = {
  profile: ['admin', 'me', 'profile'] as const,
};

/** GET /me/profile — hồ sơ của chính người đăng nhập (họ tên, số điện thoại). */
export function useMyProfile() {
  return useQuery({
    queryKey: meKeys.profile,
    queryFn: () => unwrap(api.GET('/me/profile')),
  });
}

/** PATCH /me/profile — không cần quyền user.*; chờ server rồi mới đổi UI. */
export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMyProfileInput) => unwrap(api.PATCH('/me/profile', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}

/** POST /me/password — sai mật khẩu hiện tại → 422 path currentPassword. */
export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (body: ChangeMyPasswordInput) => unwrap(api.POST('/me/password', { body })),
  });
}
