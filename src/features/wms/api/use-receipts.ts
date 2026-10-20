import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, idempotency, unwrap } from '@/lib/api/client';
import type { components, operations } from '@/lib/api/schema';

export type ReceiptListRow = components['schemas']['ReceiptListRowDto'];
export type ReceiptListResponse = components['schemas']['ReceiptListResponseDto'];
export type ReceiptDetail = components['schemas']['ReceiptDetailDto'];
export type ReceiptMovement = components['schemas']['ReceiptMovementDto'];
export type ReceiptStatus = ReceiptDetail['status'];
/** Tiến độ nghiệp vụ (2026-10-20): NEW · PUTTING_AWAY · AWAITING_COST · COMPLETED · CANCELLED. */
export type ReceiptStage = ReceiptDetail['stage'];
export type CreateReceiptBody = components['schemas']['CreateReceiptDto'];
export type SetReceiptCostsBody = components['schemas']['SetReceiptCostsDto'];
export type SetReceiptCostsResult = components['schemas']['SetReceiptCostsResultDto'];
export type ReceiptListParams = NonNullable<
  operations['ReceivingController_list']['parameters']['query']
>;

/** Phễu key (luật 3): ['wms','receipts', ...]. */
export const receiptKeys = {
  all: ['wms', 'receipts'] as const,
  lists: () => [...receiptKeys.all, 'list'] as const,
  list: (params: ReceiptListParams) => [...receiptKeys.lists(), params] as const,
  detail: (id: string) => [...receiptKeys.all, 'detail', id] as const,
  movements: (id: string) => [...receiptKeys.all, 'detail', id, 'movements'] as const,
};

/** GET /goods-receipts — danh sách + statusCounts cho dải tab; cần stock.read. */
export function useReceipts(params: ReceiptListParams) {
  return useQuery({
    queryKey: receiptKeys.list(params),
    queryFn: () => unwrap(api.GET('/goods-receipts', { params: { query: params } })),
    placeholderData: (prev) => prev,
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: () => unwrap(api.GET('/goods-receipts/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

/** Sổ cái tồn của phiếu — chỉ phiếu ĐÃ POST mới có movement. */
export function useReceiptMovements(id: string, enabled: boolean) {
  return useQuery({
    queryKey: receiptKeys.movements(id),
    queryFn: () => unwrap(api.GET('/goods-receipts/{id}/movements', { params: { path: { id } } })),
    enabled,
  });
}

/**
 * POST /goods-receipts — tạo phiếu DRAFT (chưa chạm tồn).
 * Idempotency-Key sinh LÚC BẤM (luật 4), giữ nguyên khi retry.
 */
export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateReceiptBody; key: string }) =>
      unwrap(
        api.POST('/goods-receipts', {
          params: { header: { 'idempotency-key': key } },
          headers: idempotency(key),
          body,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: receiptKeys.lists() }),
  });
}

/** POST /goods-receipts/:id/post — ghi tồn + giá vốn + task cất hàng, một transaction. */
export function usePostReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/goods-receipts/{id}/post', { params: { path: { id } }, body: {} })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: receiptKeys.lists() });
      void qc.invalidateQueries({ queryKey: receiptKeys.detail(id) });
    },
  });
}

/**
 * POST /goods-receipts/:id/costs — kế toán nhập / sửa giá nhập từng dòng (quyền `stock.cost`,
 * 2026-10-20). Giá theo ĐVT đã khai trên dòng; phiếu cất xong + đủ giá → stage COMPLETED. Thao tác
 * tuyệt đối (gửi lại cùng kết quả) nên không cần Idempotency-Key. Không optimistic (luật 5 — tiền).
 */
export function useSetReceiptCosts(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetReceiptCostsBody) =>
      unwrap(api.POST('/goods-receipts/{id}/costs', { params: { path: { id } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receiptKeys.lists() });
      void qc.invalidateQueries({ queryKey: receiptKeys.detail(id) });
    },
  });
}

/** DELETE /goods-receipts/:id — hủy phiếu NHÁP; phiếu đã post trả 409. */
export function useCancelReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/goods-receipts/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: receiptKeys.lists() });
      void qc.invalidateQueries({ queryKey: receiptKeys.detail(id) });
    },
  });
}
