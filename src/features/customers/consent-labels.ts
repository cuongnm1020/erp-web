import type { StatusTone } from '@/components/data/status-badge';
import { CONSENT_CHANNEL_LABEL, CONSENT_CHANNELS } from '@/lib/shared';
import type { ConsentChannel, ConsentSource } from './api/use-consents';

export { CONSENT_CHANNEL_LABEL, CONSENT_CHANNELS };

export const CONSENT_SOURCE_LABEL: Record<ConsentSource, string> = {
  FORM: 'Form đăng ký',
  PHONE: 'Cuộc gọi',
  ZALO_OA: 'Zalo OA',
  IMPORT: 'Nhập từ file',
  UNSUBSCRIBE_LINK: 'Khách bấm link hủy',
  ADMIN: 'Nhân viên ghi tay',
};

/** Nguồn nhân viên được chọn khi ghi tay — UNSUBSCRIBE_LINK chỉ do khách bấm link tạo ra. */
export const MANUAL_CONSENT_SOURCES: ConsentSource[] = [
  'FORM',
  'PHONE',
  'ZALO_OA',
  'IMPORT',
  'ADMIN',
];

/** `source` trong response là string tự do (bản ghi cũ có thể khác) — lạ thì giữ nguyên. */
export function consentSourceLabel(s: string | null): string {
  if (s === null) return '—';
  return (CONSENT_SOURCE_LABEL as Record<string, string>)[s] ?? s;
}

export function consentChannelLabel(c: ConsentChannel): string {
  return CONSENT_CHANNEL_LABEL[c];
}

export function consentPurposeLabel(p: string): string {
  return p === 'MARKETING' ? 'Marketing' : p;
}

/** null = chưa từng ghi nhận → coi như KHÔNG nhận tin (không được gửi marketing). */
export function consentStateLabel(granted: boolean | null): string {
  if (granted === null) return 'Chưa ghi nhận';
  return granted ? 'Đồng ý' : 'Từ chối';
}

export function consentStateTone(granted: boolean | null): StatusTone {
  if (granted === null) return 'neutral';
  return granted ? 'ok' : 'err';
}

/**
 * Bằng chứng: `{ note }` khi nhân viên ghi, `{ ip, userAgent }` khi khách bấm link hủy.
 * Khoá lạ (bản ghi cũ) hiện dạng "khoá: giá trị" — không bỏ sót dữ liệu pháp lý.
 */
export function formatConsentEvidence(e: Record<string, unknown> | null): string | null {
  if (!e) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(e)) {
    if (v === null || v === undefined || v === '') continue;
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    if (k === 'note') parts.push(text);
    else if (k === 'ip') parts.push(`IP ${text}`);
    else if (k === 'userAgent') parts.push(`Trình duyệt: ${text}`);
    else parts.push(`${k}: ${text}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
