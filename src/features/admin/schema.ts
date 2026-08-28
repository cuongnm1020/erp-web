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
