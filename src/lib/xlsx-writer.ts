/**
 * Ghi file .xlsx tối giản, không thư viện (luật stack: không thêm lib khi chưa hỏi).
 *
 * - Một sheet, ô chuỗi dạng `inlineStr` (không cần sharedStrings), ô số dạng `n`.
 * - Nén ZIP kiểu STORE (không nén) + CRC32 — Excel / LibreOffice / Google Sheets đều đọc được;
 *   file to hơn bản nén khoảng 5–8 lần, chấp nhận được với ≤ 20.000 dòng.
 * - Dòng tiêu đề in đậm + cố định khi cuộn; bề rộng cột tuỳ chọn (đơn vị ký tự).
 *
 * Tiền / số lượng đi qua API là chuỗi decimal → dùng `decimalCell()` để ghi thành ô số (Excel lưu
 * double nên đây chỉ là bước HIỂN THỊ, không tính toán tiền ở client).
 */

export type XlsxCell = string | number | null | undefined;

export interface XlsxSheet {
  /** Tên sheet (≤ 31 ký tự, bỏ ký tự cấm `[]:*?/\`). */
  name?: string;
  /** Dòng đầu = tiêu đề. */
  header: string[];
  rows: XlsxCell[][];
  /** Bề rộng cột (số ký tự). Không truyền = tự ước lượng theo nội dung (tối đa 60). */
  colWidths?: number[];
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Chuỗi decimal của API ("1234500.0000") → số cho ô Excel. Chuỗi không phải số giữ nguyên;
 * null/rỗng → ô trống. Chỉ dùng khi XUẤT file — không dùng để tính tiền.
 */
export function decimalCell(v: string | number | null | undefined): XlsxCell {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = v.trim();
  return DECIMAL_RE.test(s) ? Number(s) : s;
}

// ── XML ──────────────────────────────────────────────────────────────────────

// Ký tự điều khiển XML 1.0 không cho phép (trừ tab, LF, CR).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(s: string): string {
  return s
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetName(raw: string | undefined): string {
  const s = (raw ?? 'Sheet1').replace(/[[\]:*?/\\]/g, ' ').trim();
  return (s || 'Sheet1').slice(0, 31);
}

function cellXml(v: XlsxCell, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : '';
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : '';
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

function autoWidths(header: string[], rows: XlsxCell[][]): number[] {
  const w = header.map((h) => h.length + 2);
  // Ước lượng trên ≤ 500 dòng đầu là đủ.
  for (const r of rows.slice(0, 500)) {
    r.forEach((v, i) => {
      const len = v === null || v === undefined ? 0 : String(v).length;
      w[i] = Math.max(w[i] ?? 8, len + 2);
    });
  }
  return w.map((x) => Math.min(60, Math.max(6, x)));
}

function sheetXml(sheet: XlsxSheet): string {
  const widths = sheet.colWidths ?? autoWidths(sheet.header, sheet.rows);
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const out: string[] = [];
  const all = [sheet.header as XlsxCell[], ...sheet.rows];
  all.forEach((row, r) => {
    const cells = row.map((v, c) => cellXml(v, `${columnName(c)}${r + 1}`, r === 0 ? 1 : 0));
    out.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${out.join('')}</sheetData>` +
    '</worksheet>'
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

/** Style 0 = mặc định, 1 = đậm (tiêu đề). */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function workbookXml(name: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

// ── ZIP (STORE) ──────────────────────────────────────────────────────────────

let CRC_TABLE: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  // Ngày giờ DOS cố định 2026-01-01 00:00 — nội dung file không phụ thuộc giờ máy.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // cờ: tên file UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    locals.push(local, f.data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

/** Dựng nội dung file .xlsx (một sheet). */
export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  const enc = new TextEncoder();
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml(sheetName(sheet.name))) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(WORKBOOK_RELS) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml(sheet)) },
  ]);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Nội dung .xlsx dạng Blob — để tải về (`saveBlob`) hoặc gửi kèm yêu cầu xuất qua email. */
export function xlsxBlob(sheet: XlsxSheet): Blob {
  return new Blob([buildXlsx(sheet) as BlobPart], { type: XLSX_MIME });
}

/** Tên file luôn có đuôi `.xlsx`. */
export function xlsxFileName(filename: string): string {
  return filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
}

/** Lưu Blob thành file về máy (trình duyệt). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Mở link tải file do server tạo (anchor thật, cookie phiên đi kèm). */
export function openDownload(href: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Tải file .xlsx về máy (trình duyệt). */
export function downloadXlsx(filename: string, sheet: XlsxSheet): void {
  saveBlob(xlsxBlob(sheet), xlsxFileName(filename));
}
