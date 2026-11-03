import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { productKeys } from './use-products';

/** Tag sản phẩm (2026-11-03) — luật 2: shape từ schema.d.ts. */
export type ProductTag = components['schemas']['ProductTagDto'];
export type ProductTagRef = components['schemas']['ProductTagRefDto'];
export type BulkProductTagsInput = components['schemas']['BulkProductTagsDto'];

export const productTagKeys = {
  all: ['catalog', 'product-tags'] as const,
};

/** GET /product-tags — danh mục tag + số sản phẩm đang gắn. */
export function useProductTags(enabled = true) {
  return useQuery({
    enabled,
    queryKey: productTagKeys.all,
    queryFn: () => unwrap(api.GET('/product-tags')),
    staleTime: 60 * 1000,
  });
}

/** Tag đổi → danh sách tag + danh sách / chi tiết sản phẩm (chip tag) đều cũ. */
function useInvalidateTags() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: productTagKeys.all });
    void qc.invalidateQueries({ queryKey: productKeys.all });
  };
}

export function useCreateProductTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (body: components['schemas']['CreateProductTagDto']) =>
      unwrap(api.POST('/product-tags', { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateProductTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: components['schemas']['UpdateProductTagDto'];
    }) => unwrap(api.PATCH('/product-tags/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

export function useDeleteProductTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/product-tags/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

/** POST /products/bulk-tags — gắn / gỡ tag cho các sản phẩm đang chọn. */
export function useBulkProductTags() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (body: BulkProductTagsInput) => unwrap(api.POST('/products/bulk-tags', { body })),
    onSuccess: invalidate,
  });
}
