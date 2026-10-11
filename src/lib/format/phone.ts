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

/** Đầu số di động → nhà mạng (tên rút gọn hiển thị cạnh SĐT trên danh sách đơn). */
const MOBILE_PREFIX: Record<string, string> = {
  // Viettel
  '086': 'Viettel',
  '096': 'Viettel',
  '097': 'Viettel',
  '098': 'Viettel',
  '032': 'Viettel',
  '033': 'Viettel',
  '034': 'Viettel',
  '035': 'Viettel',
  '036': 'Viettel',
  '037': 'Viettel',
  '038': 'Viettel',
  '039': 'Viettel',
  // Vinaphone
  '088': 'Vina',
  '091': 'Vina',
  '094': 'Vina',
  '081': 'Vina',
  '082': 'Vina',
  '083': 'Vina',
  '084': 'Vina',
  '085': 'Vina',
  // Mobifone
  '089': 'Mobi',
  '090': 'Mobi',
  '093': 'Mobi',
  '070': 'Mobi',
  '076': 'Mobi',
  '077': 'Mobi',
  '078': 'Mobi',
  '079': 'Mobi',
  // Vietnamobile
  '092': 'Vnmb',
  '056': 'Vnmb',
  '058': 'Vnmb',
  // Gmobile, iTel
  '099': 'Gmobile',
  '059': 'Gmobile',
  '087': 'iTel',
};

/** Nhà mạng theo đầu số (chỉ số di động 10 chữ số); không nhận ra → null. */
export function phoneCarrier(raw: string | null | undefined): string | null {
  const s = normalizePhone(raw);
  if (!s || s.length !== 10) return null;
  return MOBILE_PREFIX[s.slice(0, 3)] ?? null;
}

export function formatPhone(raw: string | null | undefined): string {
  const s = normalizePhone(raw);
  if (!s) return raw?.trim() ? raw.trim() : EMPTY;
  if (s.length === 10) return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
  // 11 số (cố định có mã vùng 3 số): 0xxx xxxx xxxx
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`;
}
