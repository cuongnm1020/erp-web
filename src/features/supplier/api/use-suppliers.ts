import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Supplier = components['schemas']['SupplierDto'];
export type SupplierDetail = components['schemas']['SupplierDetailDto'];
export type SupplierAddress = components['schemas']['SupplierAddressDto'];
export type CreateSupplierInput = components['schemas']['CreateSupplierDto'];
export type UpdateSupplierInput = components['schemas']['UpdateSupplierDto'];
export type AddressInput = components['schemas']['AddressDto'];

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

/** DELETE = ngừng giao dịch (isActive=false) — lịch sử PO/công nợ giữ nguyên. */
export function useDeactivateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/suppliers/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      void qc.invalidateQueries({ queryKey: supplierKeys.detail(id) });
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
