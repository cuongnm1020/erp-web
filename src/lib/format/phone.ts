import { EMPTY } from './money';

/**
 * SĐT Việt Nam: chuẩn hóa về 0xxxxxxxxx (10 số) và hiển thị 0xxx xxx xxx.
 * Không validate nghiệp vụ ở đây (luật 11) — chỉ định dạng hiển thị.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, '');
  if (s.startsWith('+84')) s = `0${s.slice(3)}`;
  else if (s.startsWith('84') && s.length === 11) s = `0${s.slice(2)}`;
  if (!/^0\d{9,10}$/.test(s)) return null;
  return s;
}

export function formatPhone(raw: string | null | undefined): string {
  const s = normalizePhone(raw);
  if (!s) return raw?.trim() ? raw.trim() : EMPTY;
  if (s.length === 10) return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
  // 11 số (cố định có mã vùng 3 số): 0xxx xxxx xxxx
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`;
}
