import { useMutation, useQuery } from '@tanstack/react-query';
import { publicApi, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

/**
 * CRM-12/13 — hủy nhận tin công khai (không đăng nhập). Đi qua `publicApi`: proxy Next chuyển
 * tiếp IP + User-Agent của khách tới /public/* và KHÔNG gắn phiên nhân viên (nếu trình duyệt đó
 * tình cờ đang đăng nhập ERP). Không refresh, không đá về /login.
 */
export type PublicUnsubscribe = components['schemas']['PublicUnsubscribeDto'];

export const unsubscribeKeys = {
  all: ['public', 'unsubscribe'] as const,
  detail: (token: string) => [...unsubscribeKeys.all, token] as const,
};

/** GET /public/unsubscribe/{token} — tên đã che + kênh + trạng thái hiện tại. */
export function usePublicUnsubscribe(token: string) {
  return useQuery({
    queryKey: unsubscribeKeys.detail(token),
    queryFn: () =>
      unwrap(publicApi.GET('/public/unsubscribe/{token}', { params: { path: { token } } })),
    // 404 (token sai) / 429 (quá nhanh) không retry; lỗi mạng / 5xx để mặc định của QueryClient.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * POST /public/unsubscribe/{token} — idempotent: bấm lại vẫn trả currentlyGranted=false.
 * Màn dùng thẳng response của mutation, không refetch GET (tránh tốn lượt rate limit).
 */
export function useConfirmUnsubscribe(token: string) {
  return useMutation({
    mutationFn: () =>
      unwrap(publicApi.POST('/public/unsubscribe/{token}', { params: { path: { token } } })),
  });
}
