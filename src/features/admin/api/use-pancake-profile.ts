import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { userKeys } from './use-users';

export type PancakeProfile = components['schemas']['PancakeProfileDto'];
export type PancakeProfileInput = components['schemas']['UpdatePancakeProfileDto'];
export type PancakeProfileResult = components['schemas']['UpdatePancakeProfileResultDto'];

/**
 * Hồ sơ Pancake (fb_id + tên trên Pancake + POS làm việc, 2026-10-18). Của user khác:
 * ['admin','users','detail',id,'pancake']; của chính mình: ['admin','me','pancake'].
 */
export const pancakeProfileKeys = {
  user: (id: string) => [...userKeys.detail(id), 'pancake'] as const,
  me: ['admin', 'me', 'pancake'] as const,
};

export function useUserPancakeProfile(id: string) {
  return useQuery({
    queryKey: pancakeProfileKeys.user(id),
    queryFn: () => unwrap(api.GET('/users/{id}/pancake-profile', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

export function useUpdateUserPancakeProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PancakeProfileInput) =>
      unwrap(api.PUT('/users/{id}/pancake-profile', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pancakeProfileKeys.user(id) });
      // Tài khoản pc.* vừa bị khoá khi chuyển fb_id → danh sách nhân viên đổi.
      void qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useMyPancakeProfile() {
  return useQuery({
    queryKey: pancakeProfileKeys.me,
    queryFn: () => unwrap(api.GET('/me/pancake-profile')),
  });
}

export function useUpdateMyPancakeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PancakeProfileInput) =>
      unwrap(api.PUT('/me/pancake-profile', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pancakeProfileKeys.me });
    },
  });
}
