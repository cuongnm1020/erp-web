import { z } from 'zod';
import { codeSchema } from '@/lib/shared';

/** Khớp CreateUserDto của apps/api (luật 11 — không chặt/lỏng hơn DTO). */
export const createUserSchema = z.object({
  code: codeSchema,
  fullName: z.string().trim().min(1, 'Nhập họ tên').max(200, 'Tối đa 200 ký tự'),
  email: z.string().trim().min(1, 'Nhập email').email('Email không hợp lệ').max(200),
  password: z.string().min(8, 'Tối thiểu 8 ký tự').max(72, 'Tối đa 72 ký tự'),
  departmentId: z.string().optional(),
  /** Kho mặc định (wms.Warehouse.id) — '' = chưa gán; phải thuộc `warehouseIds` (server kiểm). */
  warehouseId: z.string().optional(),
  /** Kho được phép làm việc (PLAN-warehouse-context). */
  warehouseIds: z.array(z.string()),
  roleCodes: z.array(z.string()),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

/**
 * Sửa nhân sự từ Sơ đồ nhân sự — khớp UpdateUserDto. Mật khẩu để trống = giữ nguyên;
 * departmentId '' = bỏ khỏi phòng ban (chỉ người có user.update làm được, server kiểm).
 */
export const editStaffSchema = z.object({
  fullName: createUserSchema.shape.fullName,
  email: createUserSchema.shape.email,
  departmentId: z.string(),
  password: z.union([z.literal(''), createUserSchema.shape.password]),
});

export type EditStaffValues = z.infer<typeof editStaffSchema>;

/**
 * Khớp CreateDepartmentDto / UpdateDepartmentDto (luật 11). `code` chỉ nhập lúc tạo (bất biến sau đó);
 * parentId / managerId để '' = không có → submit đổi thành undefined (tạo) hoặc null (sửa).
 */
export const departmentFormSchema = z.object({
  code: z.string().trim(),
  name: z.string().trim().min(1, 'Nhập tên phòng ban').max(200, 'Tối đa 200 ký tự'),
  parentId: z.string(),
  managerId: z.string(),
  /** Thứ tự trên sơ đồ (0–9999, nhỏ đứng trước) — chuỗi để ô trống = 0. */
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, 'Nhập số nguyên 0–9999'),
  isActive: z.boolean(),
  /** SALES (mặc định) | CSKH — phòng chăm sóc khách hàng: team phòng ban mang loại CSKH (khớp DTO). */
  kind: z.enum(['SALES', 'CSKH']),
  /** Phòng CSKH đang sửa (2026-10-24): mọi trưởng phòng / trưởng nhóm — người trong phòng. */
  managerIds: z.array(z.string()).max(20, 'Tối đa 20 leader'),
  groupLeadIds: z.array(z.string()).max(50, 'Tối đa 50 trưởng nhóm'),
  /** POS lên đơn của phòng CSKH (shop_id, 2026-10-29) — '' = không tự điền. */
  defaultPosShopId: z.string().regex(/^(|[1-9]\d{0,17})$/, 'POS không hợp lệ'),
});

export const createDepartmentSchema = departmentFormSchema.extend({ code: codeSchema });

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

/**
 * Khớp UpsertPancakeConfigDto (luật 11). Form giữ số dạng chuỗi để ô trống = "dùng mặc định";
 * submit đổi sang number / null. `apiKey` bắt buộc ≥ 8 ký tự khi tạo, để trống khi sửa = giữ khoá cũ.
 */
/** Ô "Số điện thoại người gửi": mỗi dòng (hoặc dấu phẩy) một số, bỏ dòng trống. */
export function senderPhoneLines(v: string): string[] {
  return v
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

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
  /**
   * Số người gửi của POS, mỗi dòng một số, theo thứ tự chia đơn — khớp UpsertPancakeConfigDto
   * `senderPhones` (≤ 20 số). Server chuẩn hoá về 0… và bỏ trùng; ở đây chỉ chặn ký tự lạ.
   */
  senderPhones: z
    .string()
    .refine((v) => senderPhoneLines(v).length <= 20, 'Tối đa 20 số điện thoại')
    .refine(
      (v) => senderPhoneLines(v).every((l) => /^\+?[\d\s.()-]{9,20}$/.test(l)),
      'Mỗi dòng một số điện thoại (chỉ gồm số, dấu cách, chấm, gạch)',
    ),
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
 * Nhân bản kết nối sang shop mới — khớp DuplicatePancakeConfigDto (luật 11). Khoá trống = dùng
 * lại khoá shop gốc (server tự chép, không qua trình duyệt).
 */
export const duplicatePancakeConfigSchema = z.object({
  targetShopId: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,15}$/, 'Mã shop là số nguyên dương'),
  shopName: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  apiKey: pancakeConfigFormSchema.shape.apiKey,
  copyProducts: z.boolean(),
});

export type DuplicatePancakeConfigValues = z.infer<typeof duplicatePancakeConfigSchema>;

/**
 * Thêm / sửa một tài khoản hãng vận chuyển — khớp Create/UpdateCarrierAccountDto (luật 11): tên
 * 1..100 ký tự. Ô trống = giữ nguyên; `clear` = các trường bỏ giá trị đã nhập ở màn hình. Trường
 * hiện ra tuỳ hãng (server trả `fields`) nên `values` là record theo khoá trường.
 */
export const carrierSettingFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên tài khoản').max(100, 'Tối đa 100 ký tự'),
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

/** Tài khoản của tôi — khớp UpdateMyProfileDto (số điện thoại server chuẩn hoá + kiểm 10–11 số). */
export const myProfileSchema = z.object({
  fullName: createUserSchema.shape.fullName,
  phone: z.string().trim().max(30, 'Tối đa 30 ký tự'),
});
export type MyProfileValues = z.infer<typeof myProfileSchema>;

/** Đổi mật khẩu của chính mình — khớp ChangeMyPasswordDto; ô nhập lại chỉ kiểm ở web. */
export const changeMyPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại').max(72),
    newPassword: createUserSchema.shape.password,
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.confirmPassword !== v.newPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Mật khẩu nhập lại không khớp',
      });
    }
  });
export type ChangeMyPasswordValues = z.infer<typeof changeMyPasswordSchema>;
