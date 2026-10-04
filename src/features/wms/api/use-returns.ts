import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

/** Luật 2: shape response chỉ lấy từ schema.d.ts sinh bởi OpenAPI. */
export type ReturnableOrder = components['schemas']['ReturnableOrderDto'];
export type ReturnableLine = components['schemas']['ReturnableLineDto'];
export type ReturnReceiptRow = components['schemas']['ReturnReceiptListRowDto'];
export type ReturnReceiptDetail = components['schemas']['ReturnReceiptDetailDto'];
export type ReturnReceiptStatus = ReturnReceiptRow['status'];
export type CreateReturnBody = components['schemas']['CreateReturnReceiptDto'];
export type ReturnListParams = NonNullable<
  operations['ReturnsController_list']['parameters']['query']
>;

/** Phễu key (luật 3): ['wms','returns', ...]. */
export const returnKeys = {
  all: ['wms', 'returns'] as const,
  lists: () => [...returnKeys.all, 'list'] as const,
  list: (params: ReturnListParams) => [...returnKeys.lists(), params] as const,
  detail: (id: string) => [...returnKeys.all, 'detail', id] as const,
  returnable: (ref: { orderId?: string; docNumber?: string }) =>
    [...returnKeys.all, 'returnable', ref] as const,
};

/** GET /return-receipts — phiếu nhập hàng hoàn; cần stock.read. */
export function useReturnReceipts(params: ReturnListParams) {
  return useQuery({
    queryKey: returnKeys.list(params),
    queryFn: () => unwrap(api.GET('/return-receipts', { params: { query: params } })),
    placeholderData: (prev) => prev,
  });
}

export function useReturnReceipt(id: string) {
  return useQuery({
    queryKey: returnKeys.detail(id),
    queryFn: () => unwrap(api.GET('/return-receipts/{id}', { params: { path: { id } } })),
  });
}

/**
 * GET /return-receipts/returnable — dòng đơn còn hoàn được (đã xuất − đã hoàn), bin / lô / giá vốn
 * mặc định. Tra theo id đơn hoặc số đơn; không có ref thì không gọi.
 */
export function useReturnable(ref: { orderId?: string; docNumber?: string }) {
  return useQuery({
    queryKey: returnKeys.returnable(ref),
    queryFn: () => unwrap(api.GET('/return-receipts/returnable', { params: { query: ref } })),
    enabled: !!(ref.orderId || ref.docNumber),
    retry: false,
  });
}

/** POST /return-receipts — phiếu DRAFT; Idempotency-Key sinh LÚC BẤM (luật 4). */
export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateReturnBody; key: string }) =>
      unwrap(
        api.POST('/return-receipts', {
          params: { header: { 'idempotency-key': key } },
          headers: idempotency(key),
          body,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: returnKeys.lists() }),
  });
}

/** POST /return-receipts/:id/post — nhập lại kho dòng RESTOCK + chốt giá vốn, một transaction. */
export function usePostReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/return-receipts/{id}/post', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: returnKeys.all }),
  });
}

/** DELETE /return-receipts/:id — hủy phiếu NHÁP; phiếu đã post trả 409. */
export function useCancelReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/return-receipts/{id}', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: returnKeys.all }),
  });
}
