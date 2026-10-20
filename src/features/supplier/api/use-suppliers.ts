import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Supplier = components['schemas']['SupplierDto'];
export type SupplierDetail = components['schemas']['SupplierDetailDto'];
export type SupplierAddress = components['schemas']['SupplierAddressDto'];
export type CreateSupplierInput = components['schemas']['CreateSupplierDto'];
export type UpdateSupplierInput = components['schemas']['UpdateSupplierDto'];
export type AddressInput = components['schemas']['AddressDto'];
export type SupplierImportResult = components['schemas']['SupplierImportResultDto'];
export type SupplierImportError = components['schemas']['SupplierImportErrorDto'];

export interface SupplierListParams {
  q?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
  take: number;
  skip: number;
}

/** F2 — module NCC (không data scope, bất biến 8). Key theo phễu (luật 3). */
export const supplierKeys = {
  all: ['catalog', 'suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (p: SupplierListParams) => [...supplierKeys.lists(), p] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
};

export function useSuppliers(params: SupplierListParams) {
  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/suppliers', {
          params: {
            query: {
              q: params.q || undefined,
              isActive: params.isActive,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => unwrap(api.GET('/suppliers/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSupplierInput) => unwrap(api.POST('/suppliers', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: supplierKeys.lists() }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSupplierInput }) =>
      unwrap(api.PATCH('/suppliers/{id}', { params: { path: { id } }, body })),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      void qc.invalidateQueries({ queryKey: supplierKeys.detail(id) });
    },
  });
}

/** Ngừng hợp tác = PATCH isActive=false — vẫn hiện trong danh sách (lọc "Ngừng hợp tác"), bật lại được. */
export function useDeactivateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.PATCH('/suppliers/{id}', { params: { path: { id } }, body: { isActive: false } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      void qc.invalidateQueries({ queryKey: supplierKeys.detail(id) });
    },
  });
}

/**
 * DELETE = xóa mềm (2026-10-20): ẩn khỏi danh sách / chi tiết / chọn NCC; lịch sử PO, phiếu nhập,
 * công nợ giữ nguyên. Tạo lại cùng mã hoặc nhập Excel trúng mã → khôi phục.
 */
export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/suppliers/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      void qc.invalidateQueries({ queryKey: supplierKeys.detail(id) });
    },
  });
}

/** Serializer giữ nguyên FormData — để browser tự đặt boundary multipart. */
const asFormData = (body: unknown) => body as FormData;

/**
 * POST /suppliers/import — file Excel "Danh sách nhà cung cấp" (.xlsx/.xls/.csv ≤ 5MB). Server
 * khớp theo mã: đã có → chỉ ghi đè, chưa có → tạo; trả số dòng tạo/ghi đè/bỏ qua + lỗi theo dòng.
 */
export function useImportSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return unwrap(
        api.POST('/suppliers/import', {
          body: fd as never,
          bodySerializer: asFormData,
          // Bỏ Content-Type mặc định (json) để browser tự đặt multipart boundary
          headers: { 'Content-Type': null },
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      void qc.invalidateQueries({ queryKey: supplierKeys.details() });
    },
  });
}

export function useAddSupplierAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddressInput }) =>
      unwrap(api.POST('/suppliers/{id}/addresses', { params: { path: { id } }, body })),
    onSuccess: (_d, { id }) => void qc.invalidateQueries({ queryKey: supplierKeys.detail(id) }),
  });
}
