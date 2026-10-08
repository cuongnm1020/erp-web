import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { customerKeys } from './use-customers';

/** CRM-13 — đồng ý nhận tin (API CRM-11). Đọc: customer.read; ghi: customer.update. */
export type ConsentChannel = components['schemas']['CreateCustomerConsentDto']['channel'];
export type ConsentSource = components['schemas']['CreateCustomerConsentDto']['source'];
export type CreateConsentInput = components['schemas']['CreateCustomerConsentDto'];
export type ConsentRecord = components['schemas']['ConsentRecordDto'];
export type ConsentCurrent = components['schemas']['ConsentCurrentDto'];
export type CustomerConsents = components['schemas']['CustomerConsentsDto'];
export type ConsentStateItem = components['schemas']['ConsentStateItemDto'];
export type ConsentStateList = components['schemas']['ConsentStateListDto'];

export interface CustomerConsentParams {
  take: number;
  skip: number;
}

export interface ConsentListParams {
  channel?: ConsentChannel;
  granted?: boolean;
  /** YYYY-MM-DD giờ VN. */
  from?: string;
  to?: string;
  q?: string;
  take: number;
  skip: number;
}

/**
 * Query key theo phễu (luật 3), nằm dưới ['crm','customers'] — gộp khách (invalidate
 * `customerKeys.all`) cũng làm mới consent vì bản ghi đi theo khách giữ.
 */
export const consentKeys = {
  all: () => [...customerKeys.all, 'consents'] as const,
  ofCustomer: (id: string) => [...consentKeys.all(), 'customer', id] as const,
  customerPage: (id: string, p: CustomerConsentParams) =>
    [...consentKeys.ofCustomer(id), p] as const,
  lists: () => [...consentKeys.all(), 'list'] as const,
  list: (p: ConsentListParams) => [...consentKeys.lists(), p] as const,
};

/** GET /customers/{id}/consents — 4 kênh hiện tại + lịch sử (mới nhất trước). */
export function useCustomerConsents(customerId: string, params: CustomerConsentParams) {
  return useQuery({
    queryKey: consentKeys.customerPage(customerId, params),
    queryFn: () =>
      unwrap(
        api.GET('/customers/{id}/consents', {
          params: { path: { id: customerId }, query: { take: params.take, skip: params.skip } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /consents — trạng thái mới nhất mỗi (khách, kênh) trong phạm vi người xem. */
export function useConsents(params: ConsentListParams) {
  return useQuery({
    queryKey: consentKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/consents', {
          params: {
            query: {
              channel: params.channel,
              granted: params.granted,
              from: params.from,
              to: params.to,
              q: params.q || undefined,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** POST /customers/{id}/consents — append-only; xong invalidate mọi consent (hồ sơ + danh sách). */
export function useRecordConsent(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConsentInput) =>
      unwrap(
        api.POST('/customers/{id}/consents', {
          params: { path: { id: customerId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: consentKeys.all() });
    },
  });
}
