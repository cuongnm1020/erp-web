import { z } from 'zod';

/**
 * Đồng ý nhận tin (CRM-11) — khớp apps/api `CreateCustomerConsentDto`:
 * - channel: EMAIL | SMS | ZALO | PHONE_CALL
 * - source: FORM | PHONE | ZALO_OA | IMPORT | UNSUBSCRIBE_LINK | ADMIN
 * - purpose: /^[A-Z][A-Z0-9_]{1,29}$/ (mặc định MARKETING ở server)
 * - evidence: ghi chú bằng chứng ≤ 1000 ký tự (tuỳ chọn)
 */
export const CONSENT_CHANNELS = ['EMAIL', 'SMS', 'ZALO', 'PHONE_CALL'] as const;
export const CONSENT_SOURCES = [
  'FORM',
  'PHONE',
  'ZALO_OA',
  'IMPORT',
  'UNSUBSCRIBE_LINK',
  'ADMIN',
] as const;

export type ConsentChannelValue = (typeof CONSENT_CHANNELS)[number];

/** Tên kênh hiển thị — dùng chung cho màn nội bộ và trang hủy nhận tin công khai. */
export const CONSENT_CHANNEL_LABEL: Record<ConsentChannelValue, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  ZALO: 'Zalo',
  PHONE_CALL: 'Gọi điện',
};

export const consentPurposeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Chữ IN HOA, số, gạch dưới; bắt đầu bằng chữ (2–30 ký tự)');

export const consentRecordSchema = z.object({
  channel: z.enum(CONSENT_CHANNELS),
  /** 'true' | 'false' — radio trên form, đổi sang boolean lúc build body. */
  granted: z.enum(['true', 'false']),
  source: z.enum(CONSENT_SOURCES),
  purpose: consentPurposeSchema,
  evidence: z.string().trim().max(1000, 'Tối đa 1000 ký tự'),
});
