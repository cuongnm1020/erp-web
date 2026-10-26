import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

/**
 * Màn Tạo đơn — mục đích sử dụng + lịch sử chăm sóc của khách (biên bản CSKH 2026-10-26, mockup
 * SVf5Yc5pCBTzezpd4rru9Z màn 3). Hook riêng của feature đơn hàng (luật 12: không import
 * features/customers); query key cùng phễu ['crm', …] với màn khách để dùng chung cache.
 */
const keys = {
  purposes: () => ['crm', 'purposes'] as const,
  customerPurposes: (id: string) => ['crm', 'customers', 'purposes', id] as const,
  notes: (id: string, take: number) => ['crm', 'customers', 'notes', id, take] as const,
};

export function usePurposeOptions() {
  return useQuery({
    queryKey: keys.purposes(),
    queryFn: () => unwrap(api.GET('/customer-purposes')),
    staleTime: 5 * 60_000,
  });
}

/** Tạo mục đích từ màn tạo đơn — trùng không dấu trả bản đã có (`created: false`). */
export function useCreatePurposeOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.POST('/customer-purposes', { body: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.purposes() }),
  });
}

/** Mục đích khách đang có — hiện bật sẵn, không gỡ ở màn tạo đơn. */
export function useOrderCustomerPurposes(customerId: string | undefined) {
  return useQuery({
    queryKey: keys.customerPurposes(customerId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/customer-care/customers/{customerId}/purposes', {
          params: { path: { customerId: customerId! } },
        }),
      ),
    enabled: !!customerId,
  });
}

/** Vài ghi chú chăm sóc mới nhất của khách. */
export function useRecentCustomerNotes(customerId: string | undefined, take = 2) {
  return useQuery({
    queryKey: keys.notes(customerId ?? '', take),
    queryFn: () =>
      unwrap(
        api.GET('/customer-care/customers/{customerId}/notes', {
          params: { path: { customerId: customerId! }, query: { take, skip: 0 } },
        }),
      ),
    enabled: !!customerId,
  });
}
