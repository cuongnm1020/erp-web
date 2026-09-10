import { z } from 'zod';
import type { ShippingOptions } from './api/use-orders';

/**
 * Form "Gửi sang ĐVVC" — giá trị nhập trên màn hình (chuỗi/boolean) và cách đổi sang
 * `ShippingOptionsDto` của API. Luật nghiệp vụ (giới hạn, kiểu) do backend giữ; ở đây chỉ là
 * định dạng nhập liệu (luật 11: luật riêng của form đặt ngoài schema chung).
 */

/** Ca lấy hàng: '' = theo ca của hãng; 1 sáng, 2 chiều, 3 tối. */
export const PICK_SHIFTS = [
  { value: '', label: 'Theo ca' },
  { value: '1', label: 'Sáng' },
  { value: '2', label: 'Chiều' },
  { value: '3', label: 'Tối' },
] as const;

const decimalOrEmpty = (msg: string) =>
  z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d{1,4})?)?$/, msg)
    .transform((v) => v.replace(',', '.'));

const intOrEmpty = z
  .string()
  .trim()
  .regex(/^\d{0,5}$/, 'Nhập số nguyên (cm)');

export const shippingOptionsFormSchema = z.object({
  shopPaysFee: z.boolean(),
  byAir: z.boolean(),
  dropAtPostOffice: z.boolean(),
  allowInspection: z.boolean(),
  callShopOnFailure: z.boolean(),
  serviceCode: z.string().trim().max(50, 'Tối đa 50 ký tự'),
  /** Mã dịch vụ bổ sung, cách nhau dấu phẩy. */
  extraServices: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  pickWorkShift: z.enum(['', '1', '2', '3']),
  pickDate: z.string(),
  insuranceValue: z.string().trim(),
  maxWeightKg: decimalOrEmpty('Nhập số kg, tối đa 4 số lẻ (vd 1 hoặc 1,5)'),
  lengthCm: intOrEmpty,
  widthCm: intOrEmpty,
  heightCm: intOrEmpty,
  note: z.string().max(500, 'Tối đa 500 ký tự'),
  /** Bật "Tùy chọn địa chỉ lấy hàng" → chọn kho cho cả lô. */
  customPickup: z.boolean(),
  warehouseId: z.string(),
});

export type ShippingOptionsFormValues = z.infer<typeof shippingOptionsFormSchema>;

export const DEFAULT_SHIPPING_OPTIONS_FORM: ShippingOptionsFormValues = {
  shopPaysFee: true,
  byAir: false,
  dropAtPostOffice: false,
  allowInspection: true,
  callShopOnFailure: true,
  serviceCode: '',
  extraServices: '',
  pickWorkShift: '',
  pickDate: '',
  insuranceValue: '',
  maxWeightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  note: '',
  customPickup: false,
  warehouseId: '',
};

const intOrUndefined = (v: string): number | undefined => (v === '' ? undefined : Number(v));

/** Form values → `ShippingOptionsDto`. Trống = không gửi (server về mặc định của hãng). */
export function toShippingOptions(v: ShippingOptionsFormValues): ShippingOptions {
  const extras = v.extraServices
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return {
    shopPaysFee: v.shopPaysFee,
    ...(v.byAir ? { transport: 'fly' as const } : {}),
    dropAtPostOffice: v.dropAtPostOffice,
    allowInspection: v.allowInspection,
    callShopOnFailure: v.callShopOnFailure,
    ...(v.serviceCode ? { serviceCode: v.serviceCode } : {}),
    ...(extras.length ? { extraServices: extras } : {}),
    ...(v.pickWorkShift ? { pickWorkShift: Number(v.pickWorkShift) as 1 | 2 | 3 } : {}),
    ...(v.pickDate ? { pickDate: v.pickDate } : {}),
    ...(v.insuranceValue ? { insuranceValue: v.insuranceValue } : {}),
    ...(v.maxWeightKg ? { maxWeightKg: v.maxWeightKg } : {}),
    ...(intOrUndefined(v.lengthCm) ? { lengthCm: intOrUndefined(v.lengthCm) } : {}),
    ...(intOrUndefined(v.widthCm) ? { widthCm: intOrUndefined(v.widthCm) } : {}),
    ...(intOrUndefined(v.heightCm) ? { heightCm: intOrUndefined(v.heightCm) } : {}),
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
  };
}

/**
 * Danh mục dịch vụ theo hãng để dựng ô chọn — mã theo tài liệu công khai của hãng; hãng
 * không có trong bảng thì nhập mã tay. Chỉ là gợi ý nhập liệu, server không kiểm tra mã.
 */
export const CARRIER_SERVICES: Record<string, { value: string; label: string }[]> = {
  GHTK: [{ value: 'xteam', label: 'Giao nhanh (Xteam)' }],
  VTP: [
    { value: 'VCN', label: 'Chuyển phát nhanh (VCN)' },
    { value: 'VTK', label: 'Chuyển phát tiết kiệm (VTK)' },
    { value: 'VHT', label: 'Hỏa tốc (VHT)' },
    { value: 'PHS', label: 'Chuyển phát hồ sơ (PHS)' },
    { value: 'VBS', label: 'Bưu kiện nhanh (VBS)' },
    { value: 'VBE', label: 'Bưu kiện tiết kiệm (VBE)' },
  ],
  GHN: [
    { value: '2', label: 'Hàng nhẹ (≤ 20 kg)' },
    { value: '5', label: 'Hàng nặng' },
  ],
};

/**
 * Ô "đường bay / gửi bưu cục / ca lấy / hẹn ngày lấy" chỉ hiện cho GHTK — hãng duy nhất có
 * trường API tương ứng (adapter đọc `transport`, `pick_option`, `pick_work_shift`, `pick_date`).
 * Hãng khác ẩn để không hứa thứ không gửi được.
 */
export function hasPickupOptions(carrierCode: string): boolean {
  return carrierCode === 'GHTK';
}
