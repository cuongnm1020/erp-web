'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LABEL_SIZES, useTriggerPrint, type LabelSizeId } from '@/lib/print';

export interface PrintSheetProps {
  /** true = mount tờ in và gọi hộp thoại in. */
  open: boolean;
  /** Hộp thoại in đã đóng → cha unmount tờ in. */
  onDone: () => void;
  size: LabelSizeId;
  /** Nội dung in — mỗi phần tử con có `data-print-page` là một trang (ngắt trang sau). */
  children: ReactNode;
  /** Tự động gọi window.print() (mặc định true; test tắt để soi DOM). */
  autoPrint?: boolean;
}

/**
 * Tờ in qua trình duyệt. Render bằng portal ra ngay dưới `<body>`; `globals.css` có luật
 * `@media print` ẩn mọi thứ trừ `[data-print-root]`, còn `@page { size }` khai ngay tại đây
 * theo khổ đã chọn. Màn hình thường KHÔNG thấy tờ in (ẩn bằng `hidden`, chỉ hiện khi in).
 *
 * Preview trên màn hình dùng chính component nội dung (ví dụ `<SkuLabel>`), không dùng
 * tờ in này.
 */
export function PrintSheet({ open, onDone, size, children, autoPrint = true }: PrintSheetProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useTriggerPrint(open && autoPrint && host !== null, onDone);

  if (!open || !host) return null;
  const page = LABEL_SIZES[size];
  return createPortal(
    <div data-print-root data-print-size={page.id} className="hidden print:block">
      <style>{`@page { size: ${page.pageSize}; margin: 0; }`}</style>
      {children}
    </div>,
    host,
  );
}
