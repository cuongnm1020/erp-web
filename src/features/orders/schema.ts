import Decimal from 'decimal.js';
import { z } from 'zod';
import { dateKeySchema, idSchema, moneySchema, phoneSchema, quantitySchema } from '@/lib/shared';

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

/** Nguồn đơn — khách tìm đến qua đâu (khớp enum OrderSource của API). */
export const ORDER_SOURCES = [
  'FACEBOOK',
  'ZALO',
  'TIKTOK',
  'PHONE',
  'WEBSITE',
  'WALK_IN',
  'REFERRAL',
  'OTHER',
] as const;
export type OrderSourceValue = (typeof ORDER_SOURCES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type GenderValue = (typeof GENDERS)[number];

/** Chuỗi SĐT người dùng gõ ("0912 345 678", "+84 912…") → dạng 0xxxxxxxxx để so / gửi. */
export function normalizePhoneInput(raw: string): string {
  let d = raw.replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('84') && (d.length === 11 || d.length === 12)) d = `0${d.slice(2)}`;
  if (d.length === 9 && d[0] !== '0') d = `0${d}`;
  return d;
}

const optionalMoney = moneySchema
  .refine((v) => !v.startsWith('-'), 'Không được âm')
  .optional()
  .or(z.literal(''));
const optionalId = idSchema.or(z.literal(''));
const cmSchema = z
  .string()
  .trim()
  .regex(/^\d{0,5}$/, 'Số nguyên cm')
  .refine((v) => v === '' || Number.parseInt(v, 10) <= 10_000, 'Tối đa 10.000 cm');

/**
 * Form màn tạo đơn mới (2026-10-17) — khớp CreateOrderDto của apps/api (luật 11). Khách: chọn
 * sẵn (`customerId`) hoặc gõ tên + SĐT (server tìm / tạo theo SĐT). Địa chỉ nhận: chọn địa chỉ đã
 * lưu (`addressId`) hoặc gõ tay (server lưu thành địa chỉ của khách).
 */
export const createOrderSchema = z
  .object({
    customerId: optionalId,
    customerName: z.string().trim().max(300, 'Tối đa 300 ký tự'),
    customerPhone: z.string().trim().max(20, 'Tối đa 20 ký tự'),
    customerEmail: z.string().trim().email('Email không hợp lệ').max(200).or(z.literal('')),
    customerBirthday: dateKeySchema.or(z.literal('')),
    customerGender: z.enum(GENDERS).or(z.literal('')),
    /** Địa chỉ đã lưu của khách; '' = gõ tay bên dưới (hoặc để server lấy mặc định của khách). */
    addressId: optionalId,
    recipient: z.string().trim().max(200, 'Tối đa 200 ký tự'),
    recipientPhone: z.string().trim().max(20, 'Tối đa 20 ký tự'),
    line1: z.string().trim().max(300, 'Tối đa 300 ký tự'),
    ward: z.string().trim().max(100, 'Tối đa 100 ký tự'),
    district: z.string().trim().max(100, 'Tối đa 100 ký tự'),
    province: z.string().trim().max(100, 'Tối đa 100 ký tự'),
    expectedDeliveryDate: dateKeySchema.or(z.literal('')),
    /** Kho xuất (khớp CreateOrderDto.warehouseId); '' = server lấy kho mặc định của tài khoản. */
    warehouseId: optionalId,
    channel: z.enum(ORDER_CHANNELS),
    source: z.enum(ORDER_SOURCES).or(z.literal('')),
    shippingFee: optionalMoney,
    freeShipping: z.boolean(),
    shipFeeOnReturnOnly: z.boolean(),
    surcharge: optionalMoney,
    prepaidAmount: optionalMoney,
    /**
     * Giảm giá cấp đơn: AMOUNT nhập số tiền (không âm); PERCENT nhập phần trăm 0..<100, tối đa
     * 2 số lẻ ("5" = 5%, API nhận tỉ lệ "0.05"). Rỗng = không giảm. Server tính trên tạm tính
     * SAU khuyến mãi và chặn 422 nếu vượt số tiền còn lại.
     */
    manualDiscountType: z.enum(MANUAL_DISCOUNT_TYPES),
    manualDiscountValue: z.string().trim().optional().or(z.literal('')),
    couponCode: z.string().trim().max(50, 'Tối đa 50 ký tự'),
    /** Giờ tạo đơn `YYYY-MM-DDTHH:mm` (giờ máy); '' = lúc bấm chốt. */
    orderDate: z.string().trim(),
    ownerId: optionalId,
    packerId: optionalId,
    careStaffId: optionalId,
    marketerId: optionalId,
    tagIds: z.array(idSchema).max(20, 'Tối đa 20 thẻ'),
    internalNote: z.string().max(2000, 'Tối đa 2.000 ký tự'),
    printNote: z.string().max(500, 'Tối đa 500 ký tự'),
    carrierId: optionalId,
    carrierAccountId: optionalId,
    shippingWeightKg: z
      .string()
      .trim()
      .regex(/^(\d{1,8}(\.\d{1,4})?)?$/, 'Cân nặng kg, tối đa 4 số lẻ'),
    lengthCm: cmSchema,
    widthCm: cmSchema,
    heightCm: cmSchema,
    lines: z.array(orderLineSchema).min(1, 'Đơn phải có ít nhất một dòng hàng'),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!v.customerId) {
      if (v.customerName === '') issue('customerName', 'Nhập tên khách hàng');
      if (!phoneSchema.safeParse(normalizePhoneInput(v.customerPhone)).success) {
        issue('customerPhone', 'Số điện thoại không hợp lệ');
      }
    }
    // Địa chỉ gõ tay: điền một ô là phải đủ người nhận, SĐT, địa chỉ, tỉnh/thành.
    const typed = [v.recipient, v.recipientPhone, v.line1, v.ward, v.district, v.province].some(
      (x) => x !== '',
    );
    if (!v.addressId && typed) {
      if (v.recipient === '') issue('recipient', 'Nhập tên người nhận');
      if (!phoneSchema.safeParse(normalizePhoneInput(v.recipientPhone)).success) {
        issue('recipientPhone', 'Số điện thoại không hợp lệ');
      }
      if (v.line1 === '') issue('line1', 'Nhập địa chỉ chi tiết');
      if (v.province === '') issue('province', 'Nhập tỉnh/thành');
    }
    if (v.carrierAccountId && !v.carrierId) issue('carrierAccountId', 'Chọn hãng trước');

    const raw = v.manualDiscountValue ?? '';
    if (raw === '') return;
    const ok =
      v.manualDiscountType === 'PERCENT'
        ? PERCENT_RE.test(raw)
        : moneySchema.safeParse(raw).success && !raw.startsWith('-');
    if (!ok) {
      issue(
        'manualDiscountValue',
        v.manualDiscountType === 'PERCENT'
          ? 'Giảm % từ 0 đến dưới 100'
          : 'Số tiền giảm không hợp lệ',
      );
    }
  });

export type OrderLineValues = z.infer<typeof orderLineSchema>;
export type CreateOrderValues = z.infer<typeof createOrderSchema>;

export const EMPTY_LINE: OrderLineValues = { skuId: '', uomId: '', qty: '1', discountPercent: '' };

/** Giá trị trống của form tạo đơn — tab nháp mới. */
export function emptyOrderValues(warehouseId = ''): CreateOrderValues {
  return {
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerBirthday: '',
    customerGender: '',
    addressId: '',
    recipient: '',
    recipientPhone: '',
    line1: '',
    ward: '',
    district: '',
    province: '',
    expectedDeliveryDate: '',
    warehouseId,
    channel: 'DIRECT',
    source: '',
    shippingFee: '',
    freeShipping: false,
    shipFeeOnReturnOnly: false,
    surcharge: '',
    prepaidAmount: '',
    manualDiscountType: 'AMOUNT',
    manualDiscountValue: '',
    couponCode: '',
    orderDate: '',
    ownerId: '',
    packerId: '',
    careStaffId: '',
    marketerId: '',
    tagIds: [],
    internalNote: '',
    printNote: '',
    carrierId: '',
    carrierAccountId: '',
    shippingWeightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    lines: [],
  };
}

const nonZero = (v: string | undefined): v is string => !!v && !new Decimal(v).isZero();
const cm = (v: string): number | undefined => (v === '' ? undefined : Number.parseInt(v, 10));

/** Form values → body POST /sales-orders. CK% "5" → "0.05" qua decimal.js. */
export function toCreateOrderBody(v: CreateOrderValues) {
  const customer = v.customerId
    ? undefined
    : { name: v.customerName.trim(), phone: normalizePhoneInput(v.customerPhone) };
  const profile = {
    ...(v.customerEmail ? { email: v.customerEmail } : {}),
    ...(v.customerBirthday ? { birthday: v.customerBirthday } : {}),
    ...(v.customerGender ? { gender: v.customerGender } : {}),
  };
  // Khách chọn sẵn: chỉ gửi kèm hồ sơ (email / ngày sinh / giới tính) để server cập nhật — API
  // vẫn đòi tên + SĐT hợp lệ trong khối `customer`, khách cũ thiếu SĐT thì bỏ qua phần này.
  const sendProfile =
    !!v.customerId &&
    Object.keys(profile).length > 0 &&
    v.customerName.trim() !== '' &&
    normalizePhoneInput(v.customerPhone).length >= 8;
  const typedAddress = !v.addressId && v.recipient !== '' && v.line1 !== '' && v.province !== '';
  const size = Object.fromEntries(
    (['lengthCm', 'widthCm', 'heightCm'] as const)
      .map((k) => [k, cm(v[k])] as const)
      .filter(([, n]) => n !== undefined),
  ) as { lengthCm?: number; widthCm?: number; heightCm?: number };
  const hasSize = Object.keys(size).length > 0;
  return {
    ...(v.customerId ? { customerId: v.customerId } : {}),
    ...(customer || sendProfile
      ? {
          customer: {
            name: customer?.name ?? v.customerName.trim(),
            phone: customer?.phone ?? normalizePhoneInput(v.customerPhone),
            ...profile,
          },
        }
      : {}),
    ...(v.addressId ? { addressId: v.addressId } : {}),
    ...(typedAddress
      ? {
          address: {
            recipient: v.recipient,
            phone: normalizePhoneInput(v.recipientPhone),
            line1: v.line1,
            ...(v.ward ? { ward: v.ward } : {}),
            ...(v.district ? { district: v.district } : {}),
            province: v.province,
          },
        }
      : {}),
    ...(v.warehouseId ? { warehouseId: v.warehouseId } : {}),
    channel: v.channel,
    ...(v.source ? { source: v.source } : {}),
    ...(v.shippingFee && !v.freeShipping && !v.shipFeeOnReturnOnly
      ? { shippingFee: v.shippingFee }
      : {}),
    ...(v.freeShipping ? { freeShipping: true } : {}),
    ...(v.shipFeeOnReturnOnly ? { shipFeeOnReturnOnly: true } : {}),
    ...(nonZero(v.surcharge) ? { surcharge: v.surcharge } : {}),
    ...(nonZero(v.prepaidAmount) ? { prepaidAmount: v.prepaidAmount } : {}),
    ...manualDiscountBody(v),
    ...(v.couponCode ? { couponCode: v.couponCode } : {}),
    ...(v.orderDate ? { orderDate: new Date(v.orderDate).toISOString() } : {}),
    ...(v.ownerId ? { ownerId: v.ownerId } : {}),
    ...(v.packerId ? { packerId: v.packerId } : {}),
    ...(v.careStaffId ? { careStaffId: v.careStaffId } : {}),
    ...(v.marketerId ? { marketerId: v.marketerId } : {}),
    ...(v.tagIds.length > 0 ? { tagIds: v.tagIds } : {}),
    ...(v.internalNote.trim() ? { internalNote: v.internalNote.trim() } : {}),
    ...(v.printNote.trim() ? { printNote: v.printNote.trim() } : {}),
    ...(v.expectedDeliveryDate ? { expectedDeliveryDate: v.expectedDeliveryDate } : {}),
    ...(v.carrierId ? { carrierId: v.carrierId } : {}),
    ...(v.carrierId && v.carrierAccountId ? { carrierAccountId: v.carrierAccountId } : {}),
    ...(nonZero(v.shippingWeightKg) ? { shippingWeightKg: v.shippingWeightKg } : {}),
    ...(hasSize ? { shippingOptions: size } : {}),
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
