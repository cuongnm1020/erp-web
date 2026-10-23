import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type TaxRate = components['schemas']['TaxRateDto'];
export type TaxRateList = components['schemas']['TaxRateListResponseDto'];
export type CreateTaxRateInput = components['schemas']['CreateTaxRateDto'];
export type UpdateTaxRateInput = components['schemas']['UpdateTaxRateDto'];
export type AssignTaxRateInput = components['schemas']['AssignTaxRateDto'];

/**
 * Danh mục thuế suất (2026-10-23, docs/PLAN-einvoice-misa.md §11.3) — màn /catalog/tax-rates,
 * ô chọn trên form sản phẩm, cột + lọc + gán hàng loạt ở danh sách sản phẩm. Danh mục nhỏ
 * (vài dòng) → một query, không phân trang.
 */
export const taxRateKeys = {
  all: ['catalog', 'tax-rates'] as const,
  list: (includeInactive: boolean) =>
    ['catalog', 'tax-rates', 'list', { includeInactive }] as const,
};

export function useTaxRates(includeInactive = false) {
  return useQuery({
    queryKey: taxRateKeys.list(includeInactive),
    queryFn: () =>
      unwrap(
        api.GET('/tax-rates', { params: { query: includeInactive ? { includeInactive } : {} } }),
      ),
    staleTime: 5 * 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: taxRateKeys.all });
    // Danh sách sản phẩm hiện cột Thuế suất + đếm "Chưa gán".
    void qc.invalidateQueries({ queryKey: ['catalog', 'products'] });
  };
}

export function useCreateTaxRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateTaxRateInput) => unwrap(api.POST('/tax-rates', { body })),
    onSuccess: invalidate,
  });
}

/** PATCH /tax-rates/{id} — optimistic lock: body mang version đang cầm. */
export function useUpdateTaxRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaxRateInput }) =>
      unwrap(api.PATCH('/tax-rates/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** POST /tax-rates/assign — gán một mức cho nhiều sản phẩm (≤ 200). */
export function useAssignTaxRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AssignTaxRateInput) => unwrap(api.POST('/tax-rates/assign', { body })),
    onSuccess: invalidate,
  });
}

/** "8%" / "KCT" — nhãn ngắn hiện trong bảng và ô chọn. */
export function taxRateShort(r: Pick<TaxRate, 'misaName'>): string {
  return r.misaName;
}
