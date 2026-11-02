import { z } from 'zod';

/**
 * Yêu cầu xuất Excel qua email (2026-11-02) — khớp `CreateExportRequestDto` / `ExportDeliveryQueryDto`
 * của api (`@IsEmail() @MaxLength(254)`).
 */
export const exportEmailSchema = z
  .string()
  .trim()
  .min(1, 'Nhập email nhận file')
  .email('Email không hợp lệ')
  .max(254, 'Email tối đa 254 ký tự');

export const exportRequestFormSchema = z.object({ email: exportEmailSchema });
export type ExportRequestFormValues = z.infer<typeof exportRequestFormSchema>;

/** Lý do từ chối — khớp `RejectExportRequestDto` (1–500 ký tự). */
export const exportRejectFormSchema = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do từ chối').max(500, 'Tối đa 500 ký tự'),
});
export type ExportRejectFormValues = z.infer<typeof exportRejectFormSchema>;
