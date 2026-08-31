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
