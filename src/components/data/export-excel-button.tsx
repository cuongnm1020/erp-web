'use client';

import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { messageFor } from '@/lib/error-messages';
import { groupVi, toLocalDateKey } from '@/lib/format';
import { xlsxBlob, xlsxFileName, type XlsxCell } from '@/lib/xlsx-writer';
import { exportResourceKey, useExportDelivery } from './export-delivery';

/** Một cột của file xuất — giá trị thô (tiền: `decimalCell(...)`, ngày: `formatDateTime(...)`). */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => XlsxCell;
  /** Bề rộng cột (ký tự); bỏ trống = tự ước lượng. */
  width?: number;
}

export interface ExportPage<T> {
  items: T[];
  total: number;
}

/** Cỡ trang khi kéo dữ liệu xuất — trần `take ≤ 200` của API. */
export const EXPORT_PAGE_SIZE = 200;
/** Trần số dòng một lần xuất. */
export const EXPORT_MAX_ROWS = 20_000;

type Source<T> =
  | {
      /**
       * Lấy một trang theo ĐÚNG bộ lọc đang xem (trang đếm từ 1). Hàm nằm ở `features/<mod>/api`
       * (luật 3) — màn chỉ truyền vào.
       */
      fetchPage: (page: number, size: number) => Promise<ExportPage<T>>;
      rows?: never;
    }
  | {
      /** Bảng không phân trang (đã có đủ dòng trên màn). */
      rows: T[];
      fetchPage?: never;
    };

export type ExportExcelButtonProps<T> = Source<T> & {
  /** Tên file không kèm đuôi — tự thêm `_YYYY-MM-DD.xlsx`. */
  fileName: string;
  /** Tên sheet; mặc định = fileName. */
  sheetName?: string;
  /** Tên màn cho người duyệt / nhật ký (vd "Đơn hàng"); mặc định = sheetName ?? fileName. */
  title?: string;
  /** Bộ lọc đang xem — ghi kèm yêu cầu xuất / nhật ký. */
  filters?: Record<string, unknown>;
  columns: ExportColumn<T>[];
  disabled?: boolean;
  /** Nhãn nút; mặc định "Xuất Excel". */
  label?: string;
  size?: 'default' | 'sm';
};

/** Trang (đếm từ 1) + cỡ → `take` / `skip` của API offset. */
export function takeSkip(page: number, size: number): { take: number; skip: number } {
  return { take: size, skip: (page - 1) * size };
}

/** Kéo hết các trang (tuần tự) tới đủ `total` hoặc chạm trần. */
export async function collectExportRows<T>(
  fetchPage: (page: number, size: number) => Promise<ExportPage<T>>,
  max = EXPORT_MAX_ROWS,
): Promise<{ rows: T[]; total: number; truncated: boolean }> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const res = await fetchPage(page, EXPORT_PAGE_SIZE);
    total = res.total;
    rows.push(...res.items);
    if (rows.length >= max) {
      return { rows: rows.slice(0, max), total, truncated: total > max };
    }
    if (res.items.length < EXPORT_PAGE_SIZE || rows.length >= total) break;
  }
  return { rows, total, truncated: false };
}

/**
 * Nút "Xuất Excel" dùng chung (design system actions.md: hành động cả màn → PageHeader bên phải,
 * nút phụ). Xuất TOÀN BỘ kết quả khớp bộ lọc hiện tại (không chỉ trang đang xem), cột đầu STT.
 * Có quyền `export.direct` → tải ngay; không → hỏi email, file chờ quản trị duyệt (2026-11-02).
 */
export function ExportExcelButton<T>(props: ExportExcelButtonProps<T>) {
  const { fileName, sheetName, columns, disabled, label = 'Xuất Excel', size } = props;
  const delivery = useExportDelivery();
  const run = useMutation({
    mutationFn: async () => {
      const got = props.fetchPage
        ? await collectExportRows(props.fetchPage)
        : { rows: props.rows ?? [], total: props.rows?.length ?? 0, truncated: false };
      const blob = xlsxBlob({
        name: sheetName ?? fileName,
        header: ['STT', ...columns.map((c) => c.header)],
        rows: got.rows.map((r, i) => [i + 1, ...columns.map((c) => c.value(r))]),
        colWidths: [
          6,
          ...columns.map((c) => c.width ?? Math.min(40, Math.max(10, c.header.length + 4))),
        ],
      });
      const outcome = await delivery.deliverFile({
        blob,
        fileName: xlsxFileName(`${fileName}_${toLocalDateKey(new Date()) ?? ''}`),
        resource: exportResourceKey(fileName),
        title: props.title ?? sheetName ?? fileName,
        rowCount: got.rows.length,
        filters: props.filters,
      });
      return { ...got, outcome };
    },
    onSuccess: (got) => {
      // Gửi yêu cầu / bỏ ngang: provider đã báo kết quả.
      if (got.outcome !== 'downloaded') return;
      if (got.truncated) {
        toast.warning(
          `Đã xuất Excel ${groupVi(String(EXPORT_MAX_ROWS))} / ${groupVi(String(got.total))} dòng — thu hẹp bộ lọc để xuất phần còn lại.`,
        );
      } else {
        toast.success(`Đã xuất Excel ${groupVi(String(got.rows.length))} dòng`);
      }
    },
    onError: (err) => toast.error(messageFor(err)),
  });
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled}
      loading={run.isPending}
      loadingText="Đang xuất…"
      onClick={() => run.mutate()}
    >
      <Download aria-hidden />
      {label}
    </Button>
  );
}
