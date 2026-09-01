import { z } from 'zod';
import { codeSchema } from '@/lib/shared';

/**
 * Khớp CreateProductDto của apps/api (luật 11 — không chặt/lỏng hơn DTO).
 * shelfLifeDays nhập dạng chuỗi số (input text/numeric), submit mới đổi sang number
 * (Number.parseInt — số nguyên ngày, không phải decimal); rỗng = không gửi.
 */
export const createProductSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên sản phẩm').max(300, 'Tối đa 300 ký tự'),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  trackingMode: z.enum(['NONE', 'LOT', 'SERIAL']),
  shelfLifeDays: z.string().trim().regex(/^\d*$/, 'Nhập số nguyên ngày, không âm'),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

/** Khớp UpdateProductDto — không đổi mã sau khi tạo; thêm được isActive (Đang bán / Ngừng bán). */
export const updateProductSchema = createProductSchema.omit({ code: true }).extend({
  isActive: z.boolean(),
});

export type UpdateProductValues = z.infer<typeof updateProductSchema>;

/**
 * Một dòng biến thể trên form sản phẩm (design/Products/ProductForm).
 * - skuId rỗng = dòng MỚI (sẽ POST /products/:id/skus); có = SKU sẵn có (PATCH khi đổi).
 * - barcode: một barcode lẻ, khớp BarcodeDto ([A-Za-z0-9-]{4,64}); SKU sẵn có mà thêm
 *   barcode mới → POST /skus/:id/barcodes.
 * - existingBarcode: barcode đầu tiên đã có (chỉ đọc — quản lý đầy đủ ở màn chi tiết).
 */
export const skuRowSchema = z.object({
  skuId: z.string(),
  code: codeSchema,
  name: z.string().trim().min(1, 'Nhập tên biến thể').max(300, 'Tối đa 300 ký tự'),
  barcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,64}$/, 'Barcode 4–64 ký tự chữ/số/gạch nối')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean(),
  existingBarcode: z.string(),
});

export const productFormSchema = createProductSchema.extend({
  baseUom: z.string().min(1, 'Chọn ĐVT cơ bản'),
  skus: z.array(skuRowSchema).min(1, 'Sản phẩm cần ít nhất một biến thể / SKU'),
});

export type SkuRowValues = z.infer<typeof skuRowSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const EMPTY_SKU_ROW: SkuRowValues = {
  skuId: '',
  code: '',
  name: '',
  barcode: '',
  isActive: true,
  existingBarcode: '',
};
