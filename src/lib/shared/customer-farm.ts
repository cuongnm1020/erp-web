import { z } from 'zod';

/**
 * Thông tin khai thác khách hàng (2026-11-02) — khớp CustomerFarmProfileDto của apps/api:
 * diện tích Decimal(14,2) > 0 + đơn vị, cây trồng 1..20 mục (mỗi mục 1..100 ký tự), độ tuổi cây
 * 1..100 ký tự, lịch sử bệnh 1..2000 ký tự. Bắt buộc ở POST /customers; PATCH phải để khách đủ.
 */
export const FARM_AREA_UNITS = ['M2', 'SAO', 'MAU', 'HA'] as const;
export type FarmAreaUnit = (typeof FARM_AREA_UNITS)[number];

export const FARM_AREA_UNIT_LABEL: Record<FarmAreaUnit, string> = {
  M2: 'm²',
  SAO: 'sào',
  MAU: 'mẫu',
  HA: 'ha',
};

/** Diện tích > 0, tối đa 12 chữ số phần nguyên + 2 thập phân — như FARM_AREA của API. */
export const FARM_AREA_RE = /^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,2})?$/;

export const farmAreaSchema = z
  .string()
  .trim()
  .regex(FARM_AREA_RE, 'Diện tích phải là số > 0, tối đa 2 chữ số thập phân');

export const cropsSchema = z
  .array(z.string().trim().min(1).max(100, 'Mỗi cây tối đa 100 ký tự'))
  .min(1, 'Chọn hoặc gõ ít nhất một cây trồng')
  .max(20, 'Tối đa 20 cây trồng');

export const customerFarmProfileSchema = z.object({
  farmArea: farmAreaSchema,
  farmAreaUnit: z.enum(FARM_AREA_UNITS, { message: 'Chọn đơn vị' }),
  crops: cropsSchema,
  treeAge: z.string().trim().min(1, 'Nhập độ tuổi cây').max(100, 'Tối đa 100 ký tự'),
  diseaseHistory: z
    .string()
    .trim()
    .min(1, 'Nhập lịch sử bệnh (chưa từng bị thì ghi "Chưa từng")')
    .max(2000, 'Tối đa 2000 ký tự'),
});

export type CustomerFarmProfile = z.infer<typeof customerFarmProfileSchema>;
