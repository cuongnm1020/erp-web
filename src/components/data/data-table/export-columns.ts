import type { ColumnDef } from '@tanstack/react-table';
import type { XlsxCell } from '@/lib/xlsx-writer';
import type { ExportColumn } from '../export-excel-button';

type AnyColumn<T> = ColumnDef<T, unknown> & {
  accessorKey?: string;
  accessorFn?: (row: T, index: number) => unknown;
};

function columnId<T>(c: AnyColumn<T>): string | undefined {
  return c.id ?? c.accessorKey;
}

function columnTitle<T>(c: AnyColumn<T>): string | null {
  if (c.meta?.title) return c.meta.title;
  return typeof c.header === 'string' && c.header ? c.header : null;
}

function primitive(v: unknown): XlsxCell {
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  return null;
}

function readPath(row: unknown, path: string): unknown {
  let cur: unknown = row;
  for (const k of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/**
 * Cột xuất Excel lấy thẳng từ cột của DataTable (cùng thứ tự, bỏ cột đang ẩn) — file luôn khớp
 * bảng đang xem. Cột có `meta.exportValue` dùng hàm đó; cột accessor thì lấy giá trị thô; cột
 * không có tiêu đề chữ (ô chọn, thao tác) hoặc `exportValue: false` bị bỏ.
 */
export function exportColumnsOf<T>(
  columns: ColumnDef<T, unknown>[],
  hidden: string[] = [],
): ExportColumn<T>[] {
  const hide = new Set(hidden);
  const out: ExportColumn<T>[] = [];
  for (const raw of columns) {
    const c = raw as AnyColumn<T>;
    const id = columnId(c);
    if (id && hide.has(id)) continue;
    const ev = c.meta?.exportValue;
    if (ev === false) continue;
    const header = columnTitle(c);
    if (!header) continue;
    if (ev) {
      out.push({ header, value: ev });
    } else if (c.accessorFn) {
      const fn = c.accessorFn;
      out.push({ header, value: (row) => primitive(fn(row, 0)) });
    } else if (c.accessorKey) {
      const key = c.accessorKey;
      out.push({ header, value: (row) => primitive(readPath(row, key)) });
    }
  }
  return out;
}
