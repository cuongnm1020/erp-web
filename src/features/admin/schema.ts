import { z } from 'zod';
import { codeSchema } from '@/lib/shared';

/** Khớp CreateUserDto của apps/api (luật 11 — không chặt/lỏng hơn DTO). */
export const createUserSchema = z.object({
  code: codeSchema,
  fullName: z.string().trim().min(1, 'Nhập họ tên').max(200, 'Tối đa 200 ký tự'),
  email: z.string().trim().min(1, 'Nhập email').email('Email không hợp lệ').max(200),
  password: z.string().min(8, 'Tối thiểu 8 ký tự').max(72, 'Tối đa 72 ký tự'),
  departmentId: z.string().optional(),
  roleCodes: z.array(z.string()),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

/**
 * Khớp CreateDepartmentDto / UpdateDepartmentDto (luật 11). `code` chỉ nhập lúc tạo (bất biến sau đó);
 * parentId / managerId để '' = không có → submit đổi thành undefined (tạo) hoặc null (sửa).
 */
export const departmentFormSchema = z.object({
  code: z.string().trim(),
  name: z.string().trim().min(1, 'Nhập tên phòng ban').max(200, 'Tối đa 200 ký tự'),
  parentId: z.string(),
  managerId: z.string(),
  isActive: z.boolean(),
});

export const createDepartmentSchema = departmentFormSchema.extend({ code: codeSchema });

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

/**
 * Khớp UpsertPancakeConfigDto (luật 11). Form giữ số dạng chuỗi để ô trống = "dùng mặc định";
 * submit đổi sang number / null. `apiKey` bắt buộc ≥ 8 ký tự khi tạo, để trống khi sửa = giữ khoá cũ.
 */
export const pancakeConfigFormSchema = z.object({
  shopId: z.string().trim().regex(/^\d+$/, 'Mã shop là số nguyên dương'),
  shopName: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  apiKey: z
    .string()
    .trim()
    .max(500, 'Tối đa 500 ký tự')
    .refine((v) => v === '' || v.length >= 8, 'Khoá API tối thiểu 8 ký tự'),
  baseUrl: z
    .string()
    .trim()
    .max(500, 'Tối đa 500 ký tự')
    .refine(
      (v) => v === '' || /^https?:\/\/\S+$/.test(v),
      'Địa chỉ phải bắt đầu bằng http:// hoặc https://',
    ),
  requestsPerSecond: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (Number(v) >= 0.1 && Number(v) <= 1000),
      'Từ 0.1 đến 1000 request/giây',
    ),
  burst: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1000),
      'Số nguyên từ 1 đến 1000',
    ),
  isActive: z.boolean(),
});

export const createPancakeConfigSchema = pancakeConfigFormSchema.extend({
  apiKey: z
    .string()
    .trim()
    .min(8, 'Nhập khoá API (tối thiểu 8 ký tự)')
    .max(500, 'Tối đa 500 ký tự'),
});

export type PancakeConfigFormValues = z.infer<typeof pancakeConfigFormSchema>;

/**
 * Sửa kết nối một hãng vận chuyển — khớp UpdateCarrierSettingDto (luật 11). Ô trống = giữ
 * nguyên; `clear` = các trường bỏ giá trị đã nhập ở màn hình (rơi về env). Trường hiện ra tuỳ
 * hãng (server trả `fields`) nên `values` là record theo khoá trường.
 */
export const carrierSettingFormSchema = z
  .object({
    values: z.record(z.string(), z.string().max(2000, 'Tối đa 2000 ký tự')),
    clear: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    const url = v.values.baseUrl?.trim() ?? '';
    if (url && !/^https?:\/\/\S+$/.test(url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['values', 'baseUrl'],
        message: 'Địa chỉ phải bắt đầu bằng http:// hoặc https://',
      });
    }
  });

export type CarrierSettingFormValues = z.infer<typeof carrierSettingFormSchema>;

/**
 * Khớp RegisterDeviceDto / UpdateDeviceDto (luật 11): mã `^[A-Za-z0-9._-]{1,50}$`, serial ≤ 100
 * (khớp nguyên văn với máy lúc đăng nhập), model ≤ 100. warehouseId / boundUserId '' = không gán.
 */
export const pdaDeviceFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Nhập mã máy')
    .max(50, 'Tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9._-]+$/, 'Chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới'),
  serialNumber: z.string().trim().min(1, 'Nhập serial của máy').max(100, 'Tối đa 100 ký tự'),
  model: z.string().trim().max(100, 'Tối đa 100 ký tự'),
  warehouseId: z.string(),
  boundUserId: z.string(),
  status: z.enum(['ACTIVE', 'LOST', 'MAINTENANCE', 'RETIRED']),
});

export type PdaDeviceFormValues = z.infer<typeof pdaDeviceFormSchema>;
