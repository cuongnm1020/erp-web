import { z } from 'zod';
import { codeSchema, idSchema, moneySchema, phoneSchema } from '@/lib/shared';
import type { CreateCustomerInput, Customer, UpdateCustomerInput } from './api/use-customers';

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

/** Các field sửa được qua UpdateCustomerDto (trừ isActive — đã có luồng Ngừng hợp tác riêng). */
const customerBaseSchema = z.object({
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
  };
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
  };
}
