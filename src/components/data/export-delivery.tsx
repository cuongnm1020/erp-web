'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { csvBlob, csvFileName, type CsvCell } from '@/lib/export-csv';
import { openDownload, saveBlob } from '@/lib/xlsx-writer';

/**
 * Xuất Excel có kiểm soát (2026-11-02): người có quyền `export.direct` tải file ngay (ghi nhật ký);
 * người khác nhập email cá nhân → file chờ quản trị duyệt rồi mới gửi qua email. Logic gọi API nằm
 * ở provider của `features/admin` (luật 3, 12) — màn và `ExportExcelButton` chỉ gọi
 * `useExportDelivery()`.
 */

/** Thông tin chung của một lần xuất — để người duyệt biết file là gì. */
export interface ExportInfo {
  /** Khoá màn / loại dữ liệu: chữ thường, số, gạch ngang (vd `orders`). */
  resource: string;
  /** Tên hiển thị (vd "Đơn hàng"). */
  title: string;
  rowCount?: number;
  /** Bộ lọc đang xem lúc xuất (ghi kèm yêu cầu / nhật ký). */
  filters?: Record<string, unknown>;
}

/** File do trình duyệt tạo (xlsx / csv). */
export interface ExportFile extends ExportInfo {
  blob: Blob;
  fileName: string;
}

/** File do server tạo: `href` = link tải trực tiếp; `requestByEmail` = gửi yêu cầu chờ duyệt. */
export interface ServerExport extends ExportInfo {
  href: string;
  requestByEmail: (email: string) => Promise<unknown>;
}

export type ExportOutcome = 'downloaded' | 'requested' | 'cancelled';

export interface ExportDelivery {
  /** Có quyền tải ngay không (không thì phải nhập email chờ duyệt). */
  canDirect: boolean;
  deliverFile: (file: ExportFile) => Promise<ExportOutcome>;
  deliverServer: (exp: ServerExport) => Promise<ExportOutcome>;
}

/**
 * Không có provider (test đơn lẻ, Storybook): tải thẳng như trước, không ghi nhật ký. Trong app
 * provider luôn bọc mọi màn đã đăng nhập (`app/(app)/layout.tsx`).
 */
const FALLBACK: ExportDelivery = {
  canDirect: true,
  deliverFile: (f) => {
    saveBlob(f.blob, f.fileName);
    return Promise.resolve('downloaded');
  },
  deliverServer: (s) => {
    openDownload(s.href);
    return Promise.resolve('downloaded');
  },
};

const ExportDeliveryContext = createContext<ExportDelivery | null>(null);

export function ExportDeliveryContextProvider({
  value,
  children,
}: {
  value: ExportDelivery;
  children: ReactNode;
}) {
  return <ExportDeliveryContext.Provider value={value}>{children}</ExportDeliveryContext.Provider>;
}

export function useExportDelivery(): ExportDelivery {
  return useContext(ExportDeliveryContext) ?? FALLBACK;
}

/** Tên file / tiêu đề → khoá `resource` hợp lệ cho API (`^[a-z0-9][a-z0-9-]{0,63}$`). */
export function exportResourceKey(name: string): string {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return key || 'export';
}

/**
 * Thay `downloadCsv` ở các màn báo cáo: cùng chữ ký `(tênFile, header, rows)` nhưng đi qua luồng
 * xuất có kiểm soát. `resource` lấy phần tên file trước dấu `_` đầu (vd `doanh-thu-theo-ncc`).
 */
export function useCsvExport(
  title: string,
): (filename: string, header: string[], rows: CsvCell[][]) => void {
  const delivery = useExportDelivery();
  return (filename, header, rows) => {
    void delivery.deliverFile({
      blob: csvBlob(header, rows),
      fileName: csvFileName(filename),
      resource: exportResourceKey(filename.split('_')[0] ?? filename),
      title,
      rowCount: rows.length,
    });
  };
}

/**
 * Nút tải file do server tạo (tồn kho Excel, file MISA, danh mục…). Có `export.direct` → anchor thật
 * (cookie phiên đi kèm, server ghi nhật ký); không → hỏi email, gửi yêu cầu chờ duyệt.
 * `onDone` chạy sau khi tải / gửi yêu cầu (vd làm mới danh sách vì server đánh dấu đã xuất).
 */
export function ServerExportButton({
  exp,
  onDone,
  children,
  variant = 'outline',
  size,
  title,
}: {
  exp: ServerExport;
  onDone?: () => void;
  children: ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  title?: string;
}) {
  const delivery = useExportDelivery();
  const [busy, setBusy] = useState(false);
  if (delivery.canDirect) {
    return (
      <Button variant={variant} size={size} asChild>
        {/* Anchor thật: tải file qua cookie phiên; <Link> sẽ client-navigate, hỏng download. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={exp.href} download title={title} onClick={onDone}>
          {children}
        </a>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      title={title}
      loading={busy}
      onClick={() => {
        setBusy(true);
        void delivery.deliverServer(exp).then((o) => {
          setBusy(false);
          if (o !== 'cancelled') onDone?.();
        });
      }}
    >
      {children}
    </Button>
  );
}
