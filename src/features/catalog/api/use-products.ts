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
export type SkuListRow = components['schemas']['SkuListRowDto'];
export type Uom = components['schemas']['UomDto'];
export type CreateSkuInput = components['schemas']['CreateSkuDto'];
export type UpdateSkuInput = components['schemas']['UpdateSkuDto'];

export interface ProductListParams {
  q?: string;
  /** Lọc theo danh mục — server gộp CẢ danh mục con (recursive CTE). */
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  trackingMode?: TrackingMode;
  /** true = chỉ sản phẩm còn ít nhất một SKU có tồn (onHand > 0). */
  hasStock?: boolean;
  sortBy?: 'createdAt' | 'name' | 'code';
  sortDir?: 'asc' | 'desc';
  take: number;
  skip: number;
}

export interface SkuListParams {
  q?: string;
  status?: 'active' | 'inactive';
  take: number;
  skip: number;
}

/** Query key theo phễu (luật 3): ['catalog','products','list', params]. */
export const productKeys = {
  all: ['catalog', 'products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (p: ProductListParams) => [...productKeys.lists(), p] as const,
  skuLists: () => [...productKeys.all, 'sku-list'] as const,
  skuList: (p: SkuListParams) => [...productKeys.skuLists(), p] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

/**
 * GET /skus — danh sách SKU phẳng cho màn Sản phẩm (design/Products/ProductList):
 * mỗi dòng một SKU kèm 3 số tồn gộp mọi kho; q ăn mã/tên SKU, mã/tên sản phẩm, barcode.
 * Sắp cố định theo mã SKU — API không nhận sort, không đánh cột sortable.
 */
export function useSkus(params: SkuListParams) {
  return useQuery({
    queryKey: productKeys.skuList(params),
    queryFn: () =>
      unwrap(
        api.GET('/skus', {
          params: {
            query: {
              q: params.q || undefined,
              status: params.status,
              take: params.take,
              skip: params.skip,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export type WarehouseSummary = components['schemas']['WarehouseSummaryDto'];

/** GET /warehouses — select "Kho mặc định". Lưu ý: cần stock.read (quyền kho, không phải product). */
export function useWarehouses() {
  return useQuery({
    queryKey: ['catalog', 'warehouses'] as const,
    queryFn: () => unwrap(api.GET('/warehouses')),
    staleTime: 60 * 1000,
  });
}

/** GET /uoms — danh mục ĐVT cho select "ĐVT cơ bản" của form sản phẩm. */
export function useUoms() {
  return useQuery({
    queryKey: ['catalog', 'uoms'] as const,
    queryFn: () => unwrap(api.GET('/uoms')),
    staleTime: 60 * 1000,
  });
}

/** POST /products/{id}/skus — thêm biến thể; barcode lẻ gắn luôn nếu nhập. */
export function useCreateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, body }: { productId: string; body: CreateSkuInput }) =>
      unwrap(api.POST('/products/{id}/skus', { params: { path: { id: productId } }, body })),
    onSuccess: (_d, { productId }) => {
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
      void qc.invalidateQueries({ queryKey: productKeys.detail(productId) });
    },
  });
}

/** PATCH /skus/{id} — đổi tên / Ngừng bán từng biến thể. */
export function useUpdateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skuId, body }: { skuId: string; body: UpdateSkuInput }) =>
      unwrap(api.PATCH('/skus/{id}', { params: { path: { id: skuId } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
      void qc.invalidateQueries({ queryKey: productKeys.details() });
    },
  });
}

export type ProductImage = components['schemas']['ProductImageDto'];

function imageForm(file: File): FormData {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

/** Serializer giữ nguyên FormData — để browser tự đặt boundary multipart. */
const asFormData = (body: unknown) => body as FormData;

/**
 * Upload ảnh (multipart 'file', jpg/png/webp ≤ 5MB) cho sản phẩm cha hoặc một SKU.
 * `url` trả về là presigned S3 hết hạn ~1h — hiển thị ngay, đừng cất lâu.
 */
export function useUploadProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, file }: { productId: string; file: File }) =>
      unwrap(
        api.POST('/products/{id}/images', {
          params: { path: { id: productId } },
          body: imageForm(file) as never,
          bodySerializer: asFormData,
          // Bỏ Content-Type mặc định (json) để browser tự đặt multipart boundary
          headers: { 'Content-Type': null },
        }),
      ),
    onSuccess: (_d, { productId }) => {
      void qc.invalidateQueries({ queryKey: productKeys.detail(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
    },
  });
}

export function useUploadSkuImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skuId, file }: { skuId: string; file: File }) =>
      unwrap(
        api.POST('/skus/{id}/images', {
          params: { path: { id: skuId } },
          body: imageForm(file) as never,
          bodySerializer: asFormData,
          headers: { 'Content-Type': null },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.details() });
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
    },
  });
}

/** PUT /product-images/{id}/primary — đặt ảnh chính trong nhóm của ảnh đó. */
export function useSetPrimaryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      unwrap(api.PUT('/product-images/{id}/primary', { params: { path: { id: imageId } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.details() });
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
    },
  });
}

/** DELETE /product-images/{id} — xóa cả S3 lẫn DB; ảnh chính bị xóa thì ảnh cũ nhất lên thay. */
export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      unwrap(api.DELETE('/product-images/{id}', { params: { path: { id: imageId } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.details() });
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
    },
  });
}

/** POST /skus/{id}/barcodes — bổ sung barcode; `uom` = mã ĐVT phụ (F3), bỏ trống = ĐVT cơ sở. */
export function useAddBarcode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skuId, code, uom }: { skuId: string; code: string; uom?: string }) =>
      unwrap(
        api.POST('/skus/{id}/barcodes', {
          params: { path: { id: skuId } },
          body: { code, ...(uom ? { uom } : {}) },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.skuLists() });
      void qc.invalidateQueries({ queryKey: productKeys.details() });
    },
  });
}

/**
 * POST /skus/{id}/conversions — khai "1 uom = factor × ĐVT cơ sở" (F3).
 * Server đóng băng factor khi (sku, uom) đã lên chứng từ (409 — Q5).
 */
export function useSetConversion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skuId, uom, factor }: { skuId: string; uom: string; factor: string }) =>
      unwrap(
        api.POST('/skus/{id}/conversions', {
          params: { path: { id: skuId } },
          body: { uom, factor },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.details() });
    },
  });
}

export type UpdateUomInput = components['schemas']['UpdateUomDto'];
export type CreateUomInput = components['schemas']['CreateUomDto'];

/** POST /uoms — thêm ĐVT mới (F3, dialog Quản lý ĐVT). */
export function useCreateUom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUomInput) => unwrap(api.POST('/uoms', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', 'uoms'] }),
  });
}

/** PATCH /uoms/{id} — đổi tên/số lẻ, version lock; mã ĐVT bất biến. */
export function useUpdateUom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUomInput }) =>
      unwrap(api.PATCH('/uoms/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', 'uoms'] }),
  });
}

/**
 * GET /products — q khớp tên/mã sản phẩm, tên dân dã (searchAliases), mã/tên SKU và
 * barcode (backend tìm hộ, luật 8). Filter danh mục/thương hiệu/theo dõi lô/còn tồn và
 * sort (code/name/createdAt) đều phía server.
 */
export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () =>
      unwrap(
        api.GET('/products', {
          params: {
            query: {
              q: params.q || undefined,
              categoryId: params.categoryId,
              brandId: params.brandId,
              isActive: params.isActive,
              trackingMode: params.trackingMode,
              hasStock: params.hasStock,
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
