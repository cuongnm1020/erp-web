import { toDecimal, type MoneyInput } from './money';

/**
 * Số tiền viết bằng chữ trên hóa đơn GTGT: 69300 → "Sáu mươi chín nghìn ba trăm đồng chẵn."
 * Làm tròn tới đồng; đọc thuần trên chuỗi chữ số (luật 10 — không qua Number).
 */
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ'];

function readGroup(g: string, full: boolean): string[] {
  const [h, t, u] = g.padStart(3, '0').split('').map(Number) as [number, number, number];
  const out: string[] = [];
  if (h > 0 || full) out.push(DIGITS[h]!, 'trăm');
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) out.push('lẻ');
  } else if (t === 1) {
    out.push('mười');
  } else {
    out.push(DIGITS[t]!, 'mươi');
  }
  if (u === 0) return out;
  if (u === 1 && t > 1) out.push('mốt');
  else if (u === 5 && t > 0) out.push('lăm');
  else out.push(DIGITS[u]!);
  return out;
}

/** Đọc số nguyên không âm (chuỗi chữ số) thành chữ, chưa viết hoa. */
export function readIntegerVi(digits: string): string {
  const s = digits.replace(/^0+/, '');
  if (!s) return DIGITS[0]!;
  const groups: string[] = [];
  for (let end = s.length; end > 0; end -= 3) groups.unshift(s.slice(Math.max(0, end - 3), end));
  const words: string[] = [];
  groups.forEach((g, i) => {
    const pos = groups.length - 1 - i;
    if (Number(g) === 0) {
      // Hết một cụm tỷ mà cả cụm bằng 0 vẫn phải nói "tỷ" nếu phía trước có số (1.000.000.000.000).
      if (pos > 0 && pos % 3 === 0 && words.length && !words.at(-1)?.endsWith('tỷ')) {
        words.push('tỷ');
      }
      return;
    }
    words.push(...readGroup(g, words.length > 0));
    const unit = pos === 0 ? '' : UNITS[pos % 3 === 0 ? 3 : pos % 3]!;
    if (unit) words.push(unit);
  });
  return words.join(' ');
}

export function moneyInWordsVi(v: MoneyInput): string {
  const d = toDecimal(v);
  if (d === null) return '';
  const n = d.abs().toDecimalPlaces(0).toFixed(0);
  const text = `${d.isNegative() && !d.isZero() ? 'âm ' : ''}${readIntegerVi(n)} đồng chẵn.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
