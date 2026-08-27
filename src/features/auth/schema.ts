import { z } from 'zod';

/**
 * Chỉ luật NHẬP LIỆU (field có mặt) — không phải luật nghiệp vụ (luật 11).
 * Luật nghiệp vụ của đăng nhập nằm ở apps/api.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Nhập mã nhân viên hoặc email'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

export type LoginInput = z.infer<typeof loginSchema>;
