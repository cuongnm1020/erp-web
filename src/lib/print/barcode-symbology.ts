/**
 * Chọn ký hiệu mã vạch để RENDER từ dữ liệu API (`Barcode.type` + chuỗi mã).
 *
 * Quyết định PLAN-barcode-pick-pack (3): mặc định CODE128 cho mọi mã nội bộ (mã SKU,
 * số chứng từ…); EAN13 chỉ khi mã đúng 13 chữ số VÀ check digit hợp lệ — mã khai sai
 * rơi về CODE128 để tem vẫn quét được thay vì render ra mã EAN sai.
 * QR giữ QR (máy PDA 2D đọc được cả hai).
 */
export type Symbology = 'code128' | 'ean13' | 'qrcode';

/** `Barcode.type` của API — không tự khai lại shape, chỉ liệt kê giá trị enum để map. */
export type ApiBarcodeType = 'EAN13' | 'CODE128' | 'QR' | 'INTERNAL';

/** Check digit EAN-13 (GS1 mod 10) cho 12 chữ số đầu. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = first12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Đúng 13 chữ số và chữ số cuối là check digit hợp lệ. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Ký hiệu render cho một mã của SKU. Số chứng từ / mã bất kỳ → gọi với type `INTERNAL`. */
export function symbologyFor(type: ApiBarcodeType, code: string): Symbology {
  if (type === 'QR') return 'qrcode';
  if (type === 'EAN13' && isValidEan13(code)) return 'ean13';
  return 'code128';
}
