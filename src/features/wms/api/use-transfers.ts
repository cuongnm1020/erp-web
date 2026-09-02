import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

export type TransferListRow = components['schemas']['TransferListRowDto'];
export type TransferDetail = components['schemas']['TransferDetailDto'];
export type TransferLine = components['schemas']['TransferLineDto'];
export type TransferStage = TransferDetail['stage'];
export type CreateTransferBody = components['schemas']['CreateTransferDto'];
export type ReceiveTransferBody = components['schemas']['ReceiveTransferDto'];
export type TransferListParams = NonNullable<
  operations['TransferController_list']['parameters']['query']
>;

/** Phễu key (luật 3): ['wms','transfers', ...]. */
export const transferKeys = {
  all: ['wms', 'transfers'] as const,
  lists: () => [...transferKeys.all, 'list'] as const,
  list: (params: TransferListParams) => [...transferKeys.lists(), params] as const,
  detail: (id: string) => [...transferKeys.all, 'detail', id] as const,
};

export function useTransfers(params: TransferListParams) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn: () => unwrap(api.GET('/transfers', { params: { query: params } })),
    placeholderData: (prev) => prev,
  });
}

export function useTransfer(id: string | null) {
  return useQuery({
    queryKey: transferKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/transfers/{id}', { params: { path: { id: id! } } })),
    enabled: id !== null,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransferBody) => unwrap(api.POST('/transfers', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: transferKeys.lists() }),
  });
}

/** Bước 1 — xuất khỏi kho đi: tồn kho đi giảm NGAY, hàng vào kho trung chuyển ảo. */
export function useDispatchTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/transfers/{id}/dispatch', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: transferKeys.lists() });
      void qc.invalidateQueries({ queryKey: transferKeys.detail(id) });
      // Tồn hai kho đã đổi
      void qc.invalidateQueries({ queryKey: ['wms', 'stock'] });
    },
  });
}

/** Bước 2 — nhận tại kho đến. Thiếu → bắt buộc lý do, phần thiếu ở lại transit. */
export function useReceiveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReceiveTransferBody }) =>
      unwrap(api.POST('/transfers/{id}/receive', { params: { path: { id } }, body })),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: transferKeys.lists() });
      void qc.invalidateQueries({ queryKey: transferKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ['wms', 'stock'] });
    },
  });
}

/** Hủy phiếu NHÁP chưa xuất; đã xuất → 409 từ server. */
export function useCancelTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/transfers/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: transferKeys.lists() });
      void qc.invalidateQueries({ queryKey: transferKeys.detail(id) });
    },
  });
}
