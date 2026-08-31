import Decimal from 'decimal.js';
import { z } from 'zod';
import { idSchema, moneySchema, quantitySchema } from '@/lib/shared';

/**
 * Khớp CreateOrderDto của apps/api (luật 11 — không chặt/lỏng hơn DTO).
 * CK% trên form nhập theo PHẦN TRĂM ("5" = 5%); API nhận TỈ LỆ chuỗi ("0.05").
 * Quy đổi bằng decimal.js ở toCreateOrderBody (luật 10 — cấm number cho tiền).
 */

export const ORDER_CHANNELS = ['DIRECT', 'MARKETPLACE', 'WEBSITE', 'POS'] as const;

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

export const createOrderSchema = z.object({
  customerId: idSchema.or(z.literal('')).refine((v) => v !== '', 'Chọn khách hàng'),
  channel: z.enum(ORDER_CHANNELS),
  shippingFee: moneySchema.optional().or(z.literal('')),
  lines: z.array(orderLineSchema).min(1, 'Đơn phải có ít nhất một dòng hàng'),
});

export type OrderLineValues = z.infer<typeof orderLineSchema>;
export type CreateOrderValues = z.infer<typeof createOrderSchema>;

export const EMPTY_LINE: OrderLineValues = { skuId: '', uomId: '', qty: '1', discountPercent: '' };

/** Form values → body POST /sales-orders. CK% "5" → "0.05" qua decimal.js. */
export function toCreateOrderBody(v: CreateOrderValues) {
  return {
    customerId: v.customerId,
    channel: v.channel,
    ...(v.shippingFee ? { shippingFee: v.shippingFee } : {}),
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
