import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type CategoryTreeNode = components['schemas']['CategoryTreeNodeDto'];
export type CreateCategoryInput = components['schemas']['CreateCategoryDto'];
export type UpdateCategoryInput = components['schemas']['UpdateCategoryDto'];
export type CreateBrandInput = components['schemas']['CreateBrandDto'];
export type UpdateBrandInput = components['schemas']['UpdateBrandDto'];

/**
 * F1 — hooks CRUD danh mục & thương hiệu (màn /catalog/categories).
 * Query key theo phễu (luật 3); mutation invalidate CẢ key phẳng
 * ['catalog','categories'] / ['catalog','brands'] mà picker form sản phẩm dùng.
 */
export const taxonomyKeys = {
  tree: ['catalog', 'categories', 'tree'] as const,
  categories: ['catalog', 'categories'] as const,
  brands: ['catalog', 'brands'] as const,
};

/** GET /categories/tree — cây lồng nhau (con của cha đã xóa nổi lên gốc). */
export function useCategoryTree() {
  return useQuery({
    queryKey: taxonomyKeys.tree,
    queryFn: () => unwrap(api.GET('/categories/tree')),
  });
}

function useInvalidateCategories() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: taxonomyKeys.categories });
    // Sản phẩm hiển thị tên danh mục — đổi tên/xóa phải làm tươi list.
    void qc.invalidateQueries({ queryKey: ['catalog', 'products'] });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (body: CreateCategoryInput) => unwrap(api.POST('/categories', { body })),
    onSuccess: invalidate,
  });
}

/** PATCH /categories/{id} — optimistic lock: body bắt buộc mang version đang cầm. */
export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryInput }) =>
      unwrap(api.PATCH('/categories/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** DELETE /categories/{id} — xóa mềm; còn con/sản phẩm → 409. */
export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/categories/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

function useInvalidateBrands() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: taxonomyKeys.brands });
    void qc.invalidateQueries({ queryKey: ['catalog', 'products'] });
  };
}

export function useCreateBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (body: CreateBrandInput) => unwrap(api.POST('/brands', { body })),
    onSuccess: invalidate,
  });
}

/** PATCH /brands/{id} — optimistic lock như danh mục. */
export function useUpdateBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBrandInput }) =>
      unwrap(api.PATCH('/brands/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  });
}

/** DELETE /brands/{id} — xóa mềm; còn sản phẩm → 409 (gợi ý Ngừng hợp tác). */
export function useDeleteBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/brands/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}
