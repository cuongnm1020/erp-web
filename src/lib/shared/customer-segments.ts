import { z } from 'zod';
import { moneySchema } from './common';

/**
 * Nhóm / cấp độ / tag khách hàng — khớp apps/api `customer-groups.dto.ts` (CRM-01):
 * - code: /^[A-Za-z0-9._-]{1,50}$/ (khác codeSchema chung: cho phép tới 50 ký tự, không cấm
 *   ký tự đầu là dấu chấm/gạch — giữ đúng DTO backend, không chặt hơn).
 * - name ≤ 200, description ≤ 500.
 * - minRevenue: Decimal(18,4) string; discountRate: Decimal(6,4) string ("0.05" = 5%).
 * - color: #rrggbb.
 */
export const segmentCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,50}$/, 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới (≤ 50 ký tự)');

export const segmentNameSchema = z
  .string()
  .trim()
  .min(1, 'Không được để trống')
  .max(200, 'Tối đa 200 ký tự');

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Màu dạng #rrggbb');

/** Decimal(6,4) — tỷ lệ 0..9.9999 (thực tế ≤ 1). */
export const rateSchema = z
  .string()
  .trim()
  .regex(/^\d(\.\d{1,4})?$/, 'Tỷ lệ không hợp lệ (tối đa 4 số lẻ)');

export const customerGroupSchema = z.object({
  code: segmentCodeSchema,
  name: segmentNameSchema,
  description: z.string().trim().max(500, 'Tối đa 500 ký tự'),
});

export const customerTierSchema = z.object({
  code: segmentCodeSchema,
  name: segmentNameSchema,
  minRevenue: moneySchema,
  /** Số nguyên 0..1000 — nhập dạng chuỗi (input text), đổi sang number lúc build body. */
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, 'Nhập số nguyên')
    .refine((v) => Number(v) <= 1000, 'Tối đa 1000'),
});

export const customerTagSchema = z.object({
  code: segmentCodeSchema,
  name: segmentNameSchema,
  color: hexColorSchema,
});

/** POST /customer-tiers/promotion/run — periodMonths 1..120. */
export const tierPromotionSchema = z.object({
  periodMonths: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Nhập số tháng (số nguyên)')
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, 'Từ 1 đến 120 tháng'),
  allowDemotion: z.boolean(),
});
