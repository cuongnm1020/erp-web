'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

/**
 * Tuỳ chọn giao diện của người đăng nhập — GET/PUT /me/preferences/{key} (2026-10-22): lưu ở
 * server theo từng tài khoản, đăng xuất / đổi máy vẫn giữ. Dùng chung cho primitive (vd "Ghi nhớ
 * khoảng ngày" của DateRangeFilter) nên nằm ở lib, không ở một feature. Key: chữ thường, số, `.`
 * `_` `-` (≤ 64 ký tự); value là object JSON ≤ 8 KB do người gọi tự hiểu.
 */
export const userPreferenceKeys = {
  all: ['me', 'preferences'] as const,
  one: (key: string) => [...userPreferenceKeys.all, key] as const,
};

export function useUserPreference<T extends object>(key: string | undefined) {
  return useQuery({
    queryKey: userPreferenceKeys.one(key ?? ''),
    queryFn: async () => {
      const r = await unwrap(api.GET('/me/preferences/{key}', { params: { path: { key: key! } } }));
      return (r.value ?? null) as T | null;
    },
    enabled: !!key,
    staleTime: Infinity,
  });
}

/** PUT — ghi trọn object. Tuỳ chọn cá nhân: cập nhật cache ngay (luật 5 cho phép), lỗi thì nạp lại. */
export function useSaveUserPreference<T extends object>(key: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: T) =>
      unwrap(
        api.PUT('/me/preferences/{key}', {
          params: { path: { key: key! } },
          body: { value: value as Record<string, unknown> },
        }),
      ),
    onMutate: (value) => qc.setQueryData(userPreferenceKeys.one(key ?? ''), value),
    onError: () => qc.invalidateQueries({ queryKey: userPreferenceKeys.one(key ?? '') }),
  });
}
