import { describe, expect, it } from 'vitest';
import { buildXlsx, columnName, crc32, decimalCell, escapeXml, zipStore } from './xlsx-writer';

/** Đọc ZIP STORE: duyệt central directory → { tên: nội dung UTF-8 }. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(dv.getUint32(localOff, true)).toBe(0x04034b50);
    expect(dv.getUint16(localOff + 8, true)).toBe(0); // STORE
    const localNameLen = dv.getUint16(localOff + 26, true);
    const start = localOff + 30 + localNameLen;
    const data = bytes.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out[name] = dec.decode(data);
    p += 46 + nameLen;
  }
  return out;
}

describe('xlsx-writer', () => {
  it('crc32 khớp giá trị chuẩn', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('columnName: A, Z, AA, AZ, BA', () => {
    expect([0, 25, 26, 51, 52].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA']);
  });

  it('escapeXml: ký tự đặc biệt + bỏ ký tự điều khiển', () => {
    expect(escapeXml('a<b>&"c"\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });

  it('decimalCell: chuỗi decimal → số; khác giữ nguyên; rỗng → null', () => {
    expect(decimalCell('1234500.0000')).toBe(1234500);
    expect(decimalCell('-12.5')).toBe(-12.5);
    expect(decimalCell('abc')).toBe('abc');
    expect(decimalCell('')).toBeNull();
    expect(decimalCell(null)).toBeNull();
  });

  it('zip hợp lệ: đủ 6 phần của gói xlsx, CRC đúng', () => {
    const files = unzip(buildXlsx({ name: 'Đơn hàng', header: ['STT', 'Tên'], rows: [[1, 'A']] }));
    expect(Object.keys(files).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
      ].sort(),
    );
    expect(files['xl/workbook.xml']).toContain('name="Đơn hàng"');
  });

  it('sheet: tiêu đề đậm, ô số kiểu n, chuỗi tiếng Việt UTF-8 và ký tự XML được thoát', () => {
    const files = unzip(
      buildXlsx({
        header: ['STT', 'Khách', 'Tổng tiền'],
        rows: [
          [1, 'Nguyễn Văn Ấn <A&B>', decimalCell('1500000.0000')],
          [2, null, 0],
        ],
      }),
    );
    const xml = files['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">STT</t>');
    expect(xml).toContain('<c r="A2"><v>1</v></c>');
    expect(xml).toContain('Nguyễn Văn Ấn &lt;A&amp;B&gt;');
    expect(xml).toContain('<c r="C2"><v>1500000</v></c>');
    expect(xml).toContain('<c r="C3"><v>0</v></c>');
    expect(xml).not.toContain('r="B3"'); // null → ô trống
    expect(xml).toContain('state="frozen"');
  });

  it('tên sheet bỏ ký tự cấm và cắt 31 ký tự', () => {
    const files = unzip(buildXlsx({ name: 'a/b:c'.padEnd(40, 'x'), header: ['A'], rows: [] }));
    const m = /name="([^"]*)"/.exec(files['xl/workbook.xml']!);
    expect(m?.[1]).toHaveLength(31);
    expect(m?.[1]).not.toMatch(/[/:]/);
  });

  it('zipStore rỗng → chỉ EOCD', () => {
    expect(zipStore([])).toHaveLength(22);
  });
});
