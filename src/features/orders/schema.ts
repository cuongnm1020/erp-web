import Decimal from 'decimal.js';
import { z } from 'zod';
import { idSchema, moneySchema, quantitySchema } from '@/lib/shared';

/**
 * Khớp CreateOrderDto của apps/api (luật 11 — không chặt/lỏng hơn DTO).
 * CK% trên form nhập theo PHẦN TRĂM ("5" = 5%); API nhận TỈ LỆ chuỗi ("0.05").
 * Quy đổi bằng decimal.js ở toCreateOrderBody (luật 10 — cấm number cho tiền).
 */

export const ORDER_CHANNELS = ['DIRECT', 'MARKETPLACE', 'WEBSITE', 'POS'] as const;

/** Giảm giá cấp đơn sale nhập tay: theo số tiền hoặc theo % (API manualDiscountType). */
export const MANUAL_DISCOUNT_TYPES = ['AMOUNT', 'PERCENT'] as const;
export type ManualDiscountType = (typeof MANUAL_DISCOUNT_TYPES)[number];
const PERCENT_RE = /^\d{1,2}(\.\d{1,2})?$/;

export const orderLineSchema = z.object({
  skuId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn sản phẩm'),
  uomId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn đơn vị'),
  qty: quantitySchema.refine((v) => !new Decimal(v).isZero(), 'Số lượng phải lớn hơn 0'),
  /** Phần trăm 0..<100, tối đa 2 số lẻ. Rỗng = không chiết khấu. */
  discountPercent: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, 'CK% từ 0 đến dưới 100')
    .optional()
    .or(z.literal('')),
});

export const createOrderSchema = z
  .object({
    customerId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn khách hàng'),
    /** Địa chỉ giao (CustomerAddress của khách đã chọn); '' = để server lấy mặc định của khách. */
    addressId: idSchema.or(z.literal('')).optional(),
    channel: z.enum(ORDER_CHANNELS),
    shippingFee: moneySchema.optional().or(z.literal('')),
    /**
     * Giảm giá cấp đơn: AMOUNT nhập số tiền (không âm); PERCENT nhập phần trăm 0..<100, tối đa
     * 2 số lẻ ("5" = 5%, API nhận tỉ lệ "0.05"). Rỗng = không giảm. Server tính trên tạm tính
     * SAU khuyến mãi và chặn 422 nếu vượt số tiền còn lại.
     */
    manualDiscountType: z.enum(MANUAL_DISCOUNT_TYPES),
    manualDiscountValue: z.string().trim().optional().or(z.literal('')),
    lines: z.array(orderLineSchema).min(1, 'Đơn phải có ít nhất một dòng hàng'),
  })
  .superRefine((v, ctx) => {
    const raw = v.manualDiscountValue ?? '';
    if (raw === '') return;
    const ok =
      v.manualDiscountType === 'PERCENT'
        ? PERCENT_RE.test(raw)
        : moneySchema.safeParse(raw).success && !raw.startsWith('-');
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['manualDiscountValue'],
        message:
          v.manualDiscountType === 'PERCENT'
            ? 'Giảm % từ 0 đến dưới 100'
            : 'Số tiền giảm không hợp lệ',
      });
    }
  });

export type OrderLineValues = z.infer<typeof orderLineSchema>;
export type CreateOrderValues = z.infer<typeof createOrderSchema>;

export const EMPTY_LINE: OrderLineValues = { skuId: '', uomId: '', qty: '1', discountPercent: '' };

/** Form values → body POST /sales-orders. CK% "5" → "0.05" qua decimal.js. */
export function toCreateOrderBody(v: CreateOrderValues) {
  return {
    customerId: v.customerId,
    ...(v.addressId ? { addressId: v.addressId } : {}),
    channel: v.channel,
    ...(v.shippingFee ? { shippingFee: v.shippingFee } : {}),
    ...manualDiscountBody(v),
    lines: v.lines.map((l) => ({
      skuId: l.skuId,
      uomId: l.uomId,
      qty: l.qty,
      ...(l.discountPercent && !new Decimal(l.discountPercent).isZero()
        ? { discountPercent: new Decimal(l.discountPercent).div(100).toString() }
        : {}),
    })),
  };
}

/** Giảm giá cấp đơn → trường body; 0 hoặc rỗng = không gửi. "%" → tỉ lệ qua decimal.js. */
function manualDiscountBody(v: CreateOrderValues) {
  const raw = v.manualDiscountValue ?? '';
  if (raw === '' || new Decimal(raw).isZero()) return {};
  return v.manualDiscountType === 'PERCENT'
    ? {
        manualDiscountType: 'PERCENT' as const,
        manualDiscountValue: new Decimal(raw).div(100).toString(),
      }
    : { manualDiscountType: 'AMOUNT' as const, manualDiscountValue: raw };
}

/**
 * Xem trước số tiền giảm tay trên `base` (tạm tính hiển thị — CHƯA trừ khuyến mãi, server tính
 * lại sau KM). null = chưa nhập / nhập sai.
 */
export function previewManualDiscount(
  type: ManualDiscountType,
  value: string | undefined,
  base: string | null,
): string | null {
  const raw = (value ?? '').trim();
  if (raw === '' || base === null) return null;
  if (type === 'PERCENT') {
    if (!PERCENT_RE.test(raw)) return null;
    return new Decimal(base).mul(raw).div(100).toDecimalPlaces(4).toFixed(4);
  }
  if (!moneySchema.safeParse(raw).success || raw.startsWith('-')) return null;
  return new Decimal(raw).toFixed(4);
}
