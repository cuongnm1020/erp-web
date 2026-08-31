import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type ProductListItem = components['schemas']['ProductListItemDto'];
export type ProductListResponse = components['schemas']['ProductListResponseDto'];
export type ProductDetail = components['schemas']['ProductDetailDto'];
export type CreateProductInput = components['schemas']['CreateProductDto'];
export type UpdateProductInput = components['schemas']['UpdateProductDto'];
export type Brand = components['schemas']['BrandDto'];
export type ProductCategory = components['schemas']['ProductCategoryDto'];
export type TrackingMode = ProductListItem['trackingMode'];

export interface ProductListParams {
  q?: string;
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['catalog','products','list', params]. */
export const productKeys = {
  all: ['catalog', 'products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (p: ProductListParams) => [...productKeys.lists(), p] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

/**
 * GET /products — q khớp tên/mã sản phẩm, mã/tên SKU và barcode (backend tìm hộ, luật 8).
 * API không nhận sortBy/sortDir — màn hình không đánh cột sortable, không hứa hão.
 */
export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/products', {
          params: {
            query: { q: params.q || undefined, take: params.take, skip: params.skip },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /products/{id} — chi tiết kèm SKU (barcode, quy đổi ĐVT). */
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => unwrap(api.GET('/products/{id}', { params: { path: { id } } })),
    enabled: id !== '',
  });
}

/** GET /brands — danh mục nhỏ, đổi hiếm → cache 60s cho form chọn nhanh. */
export function useBrands() {
  return useQuery({
    queryKey: ['catalog', 'brands'] as const,
    queryFn: () => unwrap(api.GET('/brands')),
    staleTime: 60 * 1000,
  });
}

/** GET /categories — danh mục nhỏ, đổi hiếm → cache 60s cho form chọn nhanh. */
export function useCategories() {
  return useQuery({
    queryKey: ['catalog', 'categories'] as const,
    queryFn: () => unwrap(api.GET('/categories')),
    staleTime: 60 * 1000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => unwrap(api.POST('/products', { body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProductInput) =>
      unwrap(api.PATCH('/products/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.lists() });
      void qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

/**
 * DELETE /products/{id} — soft delete: sản phẩm + toàn bộ SKU chuyển Ngừng bán,
 * tồn kho và chứng từ cũ giữ nguyên. Không optimistic (luật 5: ảnh hưởng tồn/đơn).
 */
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/products/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: productKeys.lists() });
      void qc.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}
