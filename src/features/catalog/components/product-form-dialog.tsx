'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import type { ApiError } from '@/lib/api/errors';
import {
  useBrands,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  type ProductListItem,
  type TrackingMode,
} from '../api/use-products';
import { createProductSchema, updateProductSchema } from '../schema';

const NONE = '__none__';

const TRACKING_LABELS: Record<TrackingMode, string> = {
  NONE: 'Không theo dõi',
  LOT: 'Theo lô + hạn dùng',
  SERIAL: 'Theo serial',
};

/**
 * Một form cho cả hai mode (schema hợp thành từ schema chung — luật 11, không định nghĩa lại):
 * create validate đủ CreateProductDto; edit thêm isActive, mã khóa lại (mã không đổi sau khi tạo).
 */
const productFormSchema = createProductSchema.extend({
  isActive: updateProductSchema.shape.isActive,
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const KNOWN_FIELDS = [
  'code',
  'name',
  'categoryId',
  'brandId',
  'trackingMode',
  'shelfLifeDays',
  'isActive',
] as const;

function initialValues(product?: ProductListItem): ProductFormValues {
  return {
    code: product?.code ?? '',
    name: product?.name ?? '',
    categoryId: product?.categoryId ?? '',
    brandId: product?.brandId ?? '',
    trackingMode: product?.trackingMode ?? 'NONE',
    shelfLifeDays: product?.shelfLifeDays == null ? '' : String(product.shelfLifeDays),
    isActive: product?.isActive ?? true,
  };
}

/** Số nguyên ngày (không phải decimal tiền/số lượng) → parseInt là đúng chỗ. */
function toShelfLifeDays(v: string): number | undefined {
  return v === '' ? undefined : Number.parseInt(v, 10);
}

/**
 * C-01b Thêm / sửa sản phẩm — POST /products · PATCH /products/{id}.
 * SKU không tạo ở đây: sản phẩm mới chưa có SKU, thêm ở màn chi tiết.
 */
export function ProductFormDialog({
  mode,
  product,
  open,
  onOpenChange,
}: {
  mode: 'create' | 'edit';
  /** Bắt buộc khi mode = 'edit' — form nạp sẵn giá trị của dòng. */
  product?: ProductListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const categories = useCategories();
  const brands = useBrands();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues(product),
  });

  // Mở lại dialog → bỏ bản nháp dở, nạp lại giá trị hiện tại của dòng (edit) / form trắng (create).
  useEffect(() => {
    if (open) form.reset(initialValues(product));
  }, [open, product, form]);

  const onSubmit = form.handleSubmit((v) => {
    const mutationOpts = {
      onSuccess: () => {
        toast.success(mode === 'create' ? 'Đã thêm sản phẩm' : 'Đã lưu thay đổi', {
          description: `${mode === 'create' ? v.code : (product?.code ?? '')} · ${v.name.trim()}`,
        });
        form.reset(initialValues(mode === 'edit' ? product : undefined));
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        applyServerErrors(form, err as ApiError, { knownFields: KNOWN_FIELDS });
      },
    };
    if (mode === 'create') {
      create.mutate(
        {
          code: v.code,
          name: v.name.trim(),
          categoryId: v.categoryId || undefined,
          brandId: v.brandId || undefined,
          trackingMode: v.trackingMode,
          shelfLifeDays: toShelfLifeDays(v.shelfLifeDays),
        },
        mutationOpts,
      );
    } else {
      update.mutate(
        {
          name: v.name.trim(),
          // UpdateProductDto nhận null để bỏ gán danh mục / thương hiệu.
          categoryId: v.categoryId || null,
          brandId: v.brandId || null,
          trackingMode: v.trackingMode,
          shelfLifeDays: toShelfLifeDays(v.shelfLifeDays),
          isActive: v.isActive,
        },
        mutationOpts,
      );
    }
  });

  const isPending = mode === 'create' ? create.isPending : update.isPending;
  const rootError = form.formState.errors.root?.server?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Thêm sản phẩm' : 'Sửa sản phẩm'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Sản phẩm mới chưa có SKU — thêm SKU và barcode ở màn chi tiết sau khi tạo.'
              : 'Mã sản phẩm không đổi sau khi tạo. SKU và barcode sửa ở màn chi tiết.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required={mode === 'create'}>Mã sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus={mode === 'create'}
                      disabled={mode === 'edit'}
                      placeholder="vd: TL08"
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus={mode === 'edit'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Không phân loại" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Không phân loại</SelectItem>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thương hiệu</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Không có thương hiệu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Không có thương hiệu</SelectItem>
                      {(brands.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trackingMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theo dõi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(TRACKING_LABELS) as TrackingMode[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {TRACKING_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shelfLifeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hạn dùng (ngày)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" placeholder="vd: 365" />
                  </FormControl>
                  <FormDescription>Chỉ có nghĩa khi theo dõi theo lô + hạn dùng.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === 'edit' ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        aria-label="Đang bán"
                      />
                      Đang bán
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {mode === 'create'
                  ? isPending
                    ? 'Đang thêm…'
                    : 'Thêm sản phẩm'
                  : isPending
                    ? 'Đang lưu…'
                    : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
