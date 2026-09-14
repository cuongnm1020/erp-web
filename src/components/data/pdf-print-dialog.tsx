'use client';

import { Printer } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PdfPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL trả `application/pdf` (đi qua proxy /api để mang cookie phiên). */
  url: string;
  title: string;
  description?: ReactNode;
  /** Tự gọi hộp thoại in của trình duyệt ngay khi PDF nạp xong (mặc định true). */
  autoPrint?: boolean;
  /** Nút phụ (ví dụ chọn khổ giấy) đặt cạnh nút In lại. */
  extra?: ReactNode;
  closeLabel?: string;
}

/**
 * In một file PDF từ URL ngay trong hộp thoại: nhúng `<iframe>` rồi gọi `print()` của chính
 * iframe (không phải của trang) — hộp thoại in của trình duyệt chỉ chứa PDF. Không biết gì về
 * nghiệp vụ (luật 12): nhãn vận đơn, phiếu PDF của hãng… đều dùng chung.
 *
 * `key={url}` ở iframe để đổi khổ giấy (URL khác) là nạp lại và in lại.
 */
export function PdfPrintDialog({
  open,
  onOpenChange,
  url,
  title,
  description,
  autoPrint = true,
  extra,
  closeLabel = 'Đóng',
}: PdfPrintDialogProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  const print = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    try {
      w.focus();
      w.print();
    } catch {
      // Trình duyệt chặn print() từ iframe khác nguồn — người dùng bấm In lại hoặc in từ PDF.
    }
  }, []);

  const onLoad = () => {
    setLoaded(true);
    if (autoPrint) print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="relative h-[60vh] min-h-64 overflow-hidden rounded-md border bg-muted">
          {!loaded ? (
            <p
              role="status"
              aria-label="Đang nạp PDF"
              className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
            >
              Đang nạp file in…
            </p>
          ) : null}
          <iframe
            key={url}
            ref={frame}
            src={url}
            title={title}
            data-testid="pdf-frame"
            className="h-full w-full"
            onLoad={onLoad}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex items-center gap-2">{extra}</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={print} disabled={!loaded}>
              <Printer aria-hidden />
              In lại
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {closeLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
