import Decimal from 'decimal.js';
import { z } from 'zod';
import {
  codeSchema,
  customerFarmProfileSchema,
  customerGroupSchema,
  FARM_AREA_RE,
  FARM_AREA_UNITS,
  type FarmAreaUnit,
  customerTagSchema,
  customerTierSchema,
  idSchema,
  moneySchema,
  phoneSchema,
} from '@/lib/shared';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from './api/use-customers';
import type { CreateCustomerTierInput, UpdateCustomerTierInput } from './api/use-segments';

/**
 * Khớp CreateCustomerDto / UpdateCustomerDto của apps/api (luật 11 — luật nghiệp vụ lấy từ
 * lib/shared, không chặt/lỏng hơn DTO; phần định dạng nhập liệu riêng của form nằm ở đây).
 * - Tiền (creditLimit) là STRING decimal qua moneySchema — không bao giờ number (luật 10).
 * - paymentTerm nhập dạng chuỗi chữ số (input text), đổi sang number lúc build body.
 * - Field optional để trống = '' trên form, bị BỎ khỏi body (API chưa có cách xóa trắng
 *   taxCode/phone/email/creditLimit qua PATCH — DTO không nhận null cho các field này).
 */

/** Giá trị hợp lệ của CustomerDto.type — `satisfies` để lệch enum sinh máy là lỗi compile. */
export const CUSTOMER_TYPE_VALUES = [
  'RETAIL',
  'WHOLESALE',
  'DISTRIBUTOR',
  'KEY_ACCOUNT',
] as const satisfies readonly Customer['type'][];

/** Ô diện tích cho gõ dấu phẩy thập phân kiểu Việt: "2,5" → "2.5". */
export const normalizeFarmArea = (v: string) => v.trim().replace(',', '.');

/**
 * Thông tin khai thác (2026-11-02) — luật ở lib/shared/customer-farm; form chỉ thêm định dạng nhập:
 * diện tích gõ "2,5" thành "2.5", đơn vị '' (khách cũ chưa khai) báo "Chọn đơn vị".
 */
const farmFormSchema = customerFarmProfileSchema.extend({
  farmArea: z
    .string()
    .trim()
    .refine(
      (v) => FARM_AREA_RE.test(normalizeFarmArea(v)),
      'Diện tích phải là số > 0, tối đa 2 chữ số thập phân',
    ),
  farmAreaUnit: z
    .enum(FARM_AREA_UNITS)
    .or(z.literal(''))
    // `: boolean` — để TS không suy ra type predicate làm output mất '' (lệch input/output của RHF).
    .refine((v): boolean => v !== '', 'Chọn đơn vị'),
});

/** Các field sửa được qua UpdateCustomerDto (trừ isActive — đã có luồng Ngừng hợp tác riêng). */
const customerBaseSchema = farmFormSchema.extend({
  name: z.string().trim().min(1, 'Nhập tên khách').max(300, 'Tối đa 300 ký tự'),
  taxCode: z.string().trim().max(20, 'Tối đa 20 ký tự'),
  phone: phoneSchema.or(z.literal('')),
  email: z.string().trim().email('Email không hợp lệ').or(z.literal('')),
  type: z.enum(CUSTOMER_TYPE_VALUES),
  creditLimit: moneySchema.or(z.literal('')),
  paymentTerm: z
    .string()
    .trim()
    .regex(/^\d{0,5}$/, 'Chỉ nhập số ngày (số nguyên)'),
});

export const createCustomerSchema = customerBaseSchema.extend({
  code: codeSchema,
  teamId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn team chăm sóc'),
});

export const updateCustomerSchema = customerBaseSchema;

/**
 * Form sửa dùng CHUNG shape values với form tạo (một component hai mode); mã KH và team
 * bị khóa nên chỉ giữ nguyên chuỗi, không validate lại và không bao giờ gửi lên PATCH.
 */
export const editCustomerFormSchema = customerBaseSchema.extend({
  code: z.string(),
  teamId: z.string(),
});

export type CustomerFormValues = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerValues = z.infer<typeof updateCustomerSchema>;

/** Form values → body POST /customers. Optional để trống thì bỏ hẳn field. */
export function toCreateCustomerBody(v: CustomerFormValues): CreateCustomerInput {
  return {
    code: v.code,
    name: v.name,
    teamId: v.teamId,
    type: v.type,
    ...(v.taxCode ? { taxCode: v.taxCode } : {}),
    ...(v.phone ? { phone: v.phone } : {}),
    ...(v.email ? { email: v.email } : {}),
    ...(v.creditLimit ? { creditLimit: v.creditLimit } : {}),
    // Số nguyên ngày (không phải tiền/số lượng) → Number.parseInt là đúng chỗ (luật 10).
    ...(v.paymentTerm ? { paymentTerm: Number.parseInt(v.paymentTerm, 10) } : {}),
    ...farmBody(v),
  };
}

/** 5 trường khai thác của body — form đã validate nên đơn vị không còn ''. */
function farmBody(v: CustomerFormValues) {
  return {
    farmArea: normalizeFarmArea(v.farmArea),
    farmAreaUnit: v.farmAreaUnit as FarmAreaUnit,
    crops: v.crops,
    treeAge: v.treeAge,
    diseaseHistory: v.diseaseHistory,
  };
}

/** Diện tích từ API ("2.50") → ô nhập ("2.5"); null → ''. Chỉ bỏ số 0 thừa, không tính toán. */
export function farmAreaInput(v: string | null): string {
  if (v === null) return '';
  return v.includes('.') ? v.replace(/0+$/, '').replace(/\.$/, '') : v;
}

/**
 * Form values → body PATCH /customers/{id}: CHỈ field người dùng đã đổi (dirtyFields của RHF).
 * code/teamId không nằm trong UpdateCustomerDto nên không bao giờ vào body.
 */
export function toUpdateCustomerBody(
  v: CustomerFormValues,
  dirty: Partial<Record<keyof CustomerFormValues, unknown>>,
): UpdateCustomerInput {
  return {
    ...(dirty.name ? { name: v.name } : {}),
    ...(dirty.type ? { type: v.type } : {}),
    ...(dirty.taxCode && v.taxCode ? { taxCode: v.taxCode } : {}),
    ...(dirty.phone && v.phone ? { phone: v.phone } : {}),
    ...(dirty.email && v.email ? { email: v.email } : {}),
    ...(dirty.creditLimit && v.creditLimit ? { creditLimit: v.creditLimit } : {}),
    ...(dirty.paymentTerm && v.paymentTerm
      ? { paymentTerm: Number.parseInt(v.paymentTerm, 10) }
      : {}),
    // API đòi khách SAU khi sửa đủ 4 mục — form đã bắt đủ, gửi mục nào người dùng đổi.
    ...(dirty.farmArea ? { farmArea: normalizeFarmArea(v.farmArea) } : {}),
    ...(dirty.farmAreaUnit ? { farmAreaUnit: v.farmAreaUnit as FarmAreaUnit } : {}),
    ...(dirty.crops ? { crops: v.crops } : {}),
    ...(dirty.treeAge ? { treeAge: v.treeAge } : {}),
    ...(dirty.diseaseHistory ? { diseaseHistory: v.diseaseHistory } : {}),
  };
}

// ─────────────── Nhóm / cấp độ / tag (CRM-02) ───────────────
// Luật nghiệp vụ lấy từ lib/shared/customer-segments; ở đây chỉ thêm định dạng nhập liệu
// riêng của form (CK nhập theo %, API nhận tỷ lệ Decimal(6,4)).

export const groupFormSchema = customerGroupSchema;
export type GroupFormValues = z.infer<typeof groupFormSchema>;

export const tierFormSchema = customerTierSchema.extend({
  /** % chiết khấu, '' = không có ưu đãi. 0–100, tối đa 2 số lẻ (= 4 số lẻ của tỷ lệ). */
  discountPercent: z
    .string()
    .trim()
    .regex(/^(\d{1,3}(\.\d{1,2})?)?$/, 'Nhập % (tối đa 2 số lẻ)')
    .refine((v) => v === '' || new Decimal(v).lte(100), 'Tối đa 100%'),
});
export type TierFormValues = z.infer<typeof tierFormSchema>;

export const tagFormSchema = customerTagSchema;
export type TagFormValues = z.infer<typeof tagFormSchema>;

/** "5" (%) → "0.0500" (tỷ lệ Decimal(6,4)); '' → undefined. */
export function percentToRate(percent: string): string | undefined {
  if (percent.trim() === '') return undefined;
  return new Decimal(percent).div(100).toFixed(4);
}

/** "0.0500" → "5"; null → ''. */
export function rateToPercent(rate: string | null): string {
  if (rate === null) return '';
  return new Decimal(rate).mul(100).toDecimalPlaces(2).toString();
}

export function toTierBody(v: TierFormValues): CreateCustomerTierInput {
  const rate = percentToRate(v.discountPercent);
  return {
    code: v.code,
    name: v.name,
    minRevenue: v.minRevenue,
    // Số thứ hạng (không phải tiền/số lượng) → Number.parseInt là đúng chỗ (luật 10).
    sortOrder: Number.parseInt(v.sortOrder, 10),
    ...(rate !== undefined ? { discountRate: rate } : {}),
  };
}

/**
 * PATCH tier: UpdateCustomerTierDto không nhận null cho discountRate → xóa trắng ô % nghĩa là
 * gửi "0.0000" (không ưu đãi), không có cách trả về null qua PATCH.
 */
export function toUpdateTierBody(v: TierFormValues): UpdateCustomerTierInput {
  return {
    name: v.name,
    minRevenue: v.minRevenue,
    sortOrder: Number.parseInt(v.sortOrder, 10),
    discountRate: percentToRate(v.discountPercent) ?? '0.0000',
  };
}
