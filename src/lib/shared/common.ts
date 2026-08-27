import { z } from 'zod';

/**
 * Schema zod nghiệp vụ của web (apps/web/CLAUDE.md luật 11) — vendored từ package
 * `@erp/shared` cũ khi tách repo (2026-08-27); giờ mỗi repo tự giữ bản của mình.
 * Nguyên tắc: luật nghiệp vụ sống ở đây, component chỉ bọc .superRefine cho định dạng nhập liệu.
 *
 * Ghi chú: apps/api validate DTO bằng class-validator — các ràng buộc ở đây phải khớp
 * với DTO backend (Decimal(18,4) tiền, Decimal(18,6) số lượng, take ≤ 200...).
 * Đổi luật nghiệp vụ = đổi CẢ HAI repo.
 */

/** UUID v4 (Prisma @default(uuid())). */
export const idSchema = z.string().uuid({ message: 'ID không hợp lệ' });

/** Mã nghiệp vụ (code) — chữ/số/./-/_ , 1–64 ký tự, khớp quy ước seed (sale.hn.1, SALES-HN). */
export const codeSchema = z
  .string()
  .trim()
  .min(1, 'Không được để trống')
  .max(64, 'Tối đa 64 ký tự')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới');

/**
 * Tiền: string decimal tối đa 4 lẻ (Decimal(18,4)). KHÔNG dùng z.number() cho tiền.
 * Khớp ListQueryDto/Decimal của backend: "1234.5000", "-10", "0".
 */
export const moneySchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,14}(\.\d{1,4})?$/, 'Số tiền không hợp lệ (tối đa 4 số lẻ)');

/** Số lượng: string decimal tối đa 6 lẻ (Decimal(18,6)), không âm. */
export const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'Số lượng không hợp lệ (tối đa 6 số lẻ)');

/** SĐT Việt Nam đã chuẩn hóa: 0 + 9–10 số. */
export const phoneSchema = z.string().regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ');

/** Ngày dạng yyyy-mm-dd (input[type=date], query theo ngày). */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Ngày không tồn tại');

/** Tham số danh sách offset — khớp apps/api ListQueryDto (take ≤ 200, skip ≥ 0). */
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
