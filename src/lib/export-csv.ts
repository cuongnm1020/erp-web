/**
 * Xuất CSV phía client (UTF-8 có BOM để Excel mở đúng tiếng Việt). Repo chưa có thư viện xlsx
 * và api chưa có endpoint export cho báo cáo → CSV là định dạng Excel mở được ngay.
 *
 * Giá trị tiền / số lượng truyền vào là chuỗi decimal thô (dấu chấm thập phân, không nhóm nghìn)
 * để Excel / Google Sheets đọc thành số.
 */
export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  const blob = new Blob(['\uFEFF', toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
