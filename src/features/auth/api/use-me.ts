import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { meKeys } from '@/lib/auth/me-keys';

export { meKeys };

/** GET /auth/me — nguồn duy nhất cho ability (luật 7), cache phiên. */
export function useMe() {
  return useQuery({
    queryKey: meKeys.me,
    queryFn: () => unwrap(api.GET('/auth/me')),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
