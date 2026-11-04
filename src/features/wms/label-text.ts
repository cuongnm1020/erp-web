/**
 * Ước lượng chữ trên tem vận đơn (2026-11-04) — tem in ẩn (`display: none`) nên không đo DOM
 * lúc in được; tên sản phẩm in ĐỦ (không cắt) nên phải đoán mỗi tên chiếm mấy dòng để biết
 * in được bao nhiêu món. Hệ số đo canvas Arial đậm trên Chrome: ~0,187 mm × pt mỗi ký tự, chữ
 * hoa rộng thêm ~0,027 mm × pt (chuỗi toàn hoa 64 ký tự 7,5 pt = 97 mm). Lấy hơi dư để tên
 * thật không bao giờ cần nhiều dòng hơn ước lượng (thừa chỗ còn hơn xén dòng cuối).
 */

const MM_PER_PT_CHAR = 0.187;
const MM_PER_PT_UPPER = 0.027;
/** Ngắt theo từ bỏ phí tới ~một từ cuối dòng. */
const WRAP_WASTE_MM = 4;

/** Bề ngang (mm) của chuỗi in Arial đậm cỡ `pt`. */
export function estimateTextWidthMm(text: string, pt: number): number {
  const upper = (text.match(/[A-ZÀ-Ỹ]/g) ?? []).length;
  return text.length * MM_PER_PT_CHAR * pt + upper * MM_PER_PT_UPPER * pt;
}

/** Số dòng chuỗi chiếm khi xuống dòng trong cột rộng `widthMm` (luôn ≥ 1). */
export function estimateLines(text: string, pt: number, widthMm: number): number {
  const usable = Math.max(1, widthMm - WRAP_WASTE_MM);
  return Math.max(1, Math.ceil(estimateTextWidthMm(text.trim(), pt) / usable));
}

export interface FitItemsOptions {
  /** Chỗ trống dành cho các dòng hàng (mm). */
  availableMm: number;
  /** Chiều cao một dòng chữ (mm) — cỡ chữ × line-height. */
  lineMm: number;
  /** Phần cố định mỗi hàng ngoài chữ: padding + viền + khoảng cách (mm). */
  rowExtraMm: number;
  pt: number;
  /** Bề ngang cột tên (mm). */
  widthMm: number;
}

/**
 * Số món in được khi mỗi tên in đủ (xuống dòng): cộng dồn chiều cao từng hàng tới khi hết chỗ.
 * Luôn ≥ 1 — món đầu không vừa vẫn in (hiếm: tên dài 7+ dòng).
 */
export function fitItems(items: { name: string }[], opts: FitItemsOptions): number {
  let used = 0;
  let count = 0;
  for (const it of items) {
    const h = estimateLines(it.name, opts.pt, opts.widthMm) * opts.lineMm + opts.rowExtraMm;
    if (count > 0 && used + h > opts.availableMm) break;
    used += h;
    count += 1;
  }
  return count;
}
