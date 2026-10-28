import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

export type EInvoiceListItem = components['schemas']['EInvoiceListItemDto'];
export type EInvoiceList = components['schemas']['EInvoiceListResponseDto'];
export type EInvoiceDetail = components['schemas']['EInvoiceDetailDto'];
export type EInvoiceLine = components['schemas']['EInvoiceLineDto'];
export type EInvoiceStatus = components['schemas']['EInvoiceStatus'];
export type UpdateEInvoiceInput = components['schemas']['UpdateEInvoiceDto'];
export type EInvoiceActionResult = components['schemas']['EInvoiceActionResultDto'];
export type EInvoiceListQuery = NonNullable<
  operations['EInvoiceController_list']['parameters']['query']
>;
export type EInvoiceSetting = components['schemas']['EInvoiceSettingDto'];
export type UpdateEInvoiceSettingInput = components['schemas']['UpdateEInvoiceSettingDto'];
export type EInvoiceVerifyResult = components['schemas']['EInvoiceVerifyResultDto'];
export type CarrierReconImportResult = components['schemas']['CarrierReconImportResultDto'];
export type CarrierReconLine = components['schemas']['CarrierReconLineDto'];
export type CarrierReconOutcome = components['schemas']['CarrierReconOutcome'];

/**
 * Hóa đơn điện tử MISA (2026-10-28, docs/PLAN-einvoice-misa.md §12): hàng chờ từ đối soát hãng,
 * duyệt 2 bước, đẩy nháp lên meInvoice, lấy số hóa đơn về. Tiền / hóa đơn: không optimistic (luật 5)
 * — chờ server trả rồi invalidate.
 */
export const einvoiceKeys = {
  all: ['fin', 'einvoices'] as const,
  list: (q: EInvoiceListQuery) => ['fin', 'einvoices', 'list', q] as const,
  detail: (id: string) => ['fin', 'einvoices', 'detail', id] as const,
  settings: ['fin', 'einvoices', 'settings'] as const,
  recon: ['fin', 'einvoices', 'reconciliations'] as const,
  reconLines: (id: string, q: { outcome?: CarrierReconOutcome; skip: number; take: number }) =>
    ['fin', 'einvoices', 'reconciliations', id, 'lines', q] as const,
};

export function useEInvoices(q: EInvoiceListQuery) {
  return useQuery({
    queryKey: einvoiceKeys.list(q),
    queryFn: () => unwrap(api.GET('/einvoices', { params: { query: q } })),
    placeholderData: keepPreviousData,
  });
}

export function useEInvoice(id: string) {
  return useQuery({
    queryKey: einvoiceKeys.detail(id),
    queryFn: () => unwrap(api.GET('/einvoices/{id}', { params: { path: { id } } })),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: einvoiceKeys.all });
}

export function useUpdateEInvoice(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: UpdateEInvoiceInput) =>
      unwrap(api.PATCH('/einvoices/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useRebuildEInvoice(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/einvoices/{id}/rebuild', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

export type EInvoiceAction = 'approve' | 'unapprove' | 'push' | 'withdraw' | 'unskip';

/** Thao tác hàng loạt theo danh sách id — kết quả từng hóa đơn nằm trong `failed`. */
export function useEInvoiceAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ action, ids }: { action: EInvoiceAction; ids: string[] }) => {
      const body = { ids };
      switch (action) {
        case 'approve':
          return unwrap(api.POST('/einvoices/approve', { body }));
        case 'unapprove':
          return unwrap(api.POST('/einvoices/unapprove', { body }));
        case 'push':
          return unwrap(api.POST('/einvoices/push', { body }));
        case 'withdraw':
          return unwrap(api.POST('/einvoices/withdraw', { body }));
        case 'unskip':
          return unwrap(api.POST('/einvoices/unskip', { body }));
      }
    },
    onSettled: invalidate,
  });
}

export function useSkipEInvoices() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { ids: string[]; reason: string }) =>
      unwrap(api.POST('/einvoices/skip', { body })),
    onSuccess: invalidate,
  });
}

export function useSyncEInvoices() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/einvoices/sync')),
    onSettled: invalidate,
  });
}

export function useCollectDelivered() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { from: string; to: string }) =>
      unwrap(api.POST('/einvoices/collect-delivered', { body })),
    onSuccess: invalidate,
  });
}

/** Tải file đối soát hãng (multipart "file"). */
export function useImportReconciliation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return unwrap(
        api.POST('/einvoices/reconciliations', {
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
          // Bỏ Content-Type mặc định (json) để browser tự đặt multipart boundary.
          headers: { 'Content-Type': null },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useReconciliations() {
  return useQuery({
    queryKey: einvoiceKeys.recon,
    queryFn: () => unwrap(api.GET('/einvoices/reconciliations')),
  });
}

export function useReconciliationLines(
  id: string,
  q: { outcome?: CarrierReconOutcome; skip: number; take: number },
) {
  return useQuery({
    queryKey: einvoiceKeys.reconLines(id, q),
    queryFn: () =>
      unwrap(
        api.GET('/einvoices/reconciliations/{id}/lines', {
          params: { path: { id }, query: q },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useEInvoiceSettings() {
  return useQuery({
    queryKey: einvoiceKeys.settings,
    queryFn: () => unwrap(api.GET('/einvoices/settings')),
  });
}

export function useUpdateEInvoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEInvoiceSettingInput) =>
      unwrap(api.PUT('/einvoices/settings', { body })),
    onSuccess: (data) => qc.setQueryData(einvoiceKeys.settings, data),
  });
}

export function useVerifyEInvoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/einvoices/settings/verify')),
    onSuccess: (r) => qc.setQueryData(einvoiceKeys.settings, r.setting),
  });
}
