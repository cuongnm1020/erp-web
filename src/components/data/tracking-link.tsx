'use client';

import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { CopyText } from './copy-text';

export interface TrackingLinkProps {
  /** Mã vận đơn hiển thị / sao chép. */
  trackingNo: string;
  /** Link tra cứu của hãng (API `shipment.trackingUrl`); null = không có → chỉ sao chép. */
  url: string | null;
  /** false = trang tra cứu không nhận mã qua URL → sao chép mã trước rồi mới mở. */
  prefilled: boolean;
  children?: ReactNode;
  className?: string;
  /** Ẩn icon mở tab (chỗ chật, vd nhãn màu trên thẻ hãng). */
  hideIcon?: boolean;
}

/**
 * Mã vận đơn bấm vào mở trang tra cứu của hãng ở tab mới (2026-11-03). Hãng không nhận mã qua URL
 * (Viettel Post, VNPost) thì sao chép mã vào clipboard trước, toast nhắc dán. Không có link → giống
 * `CopyText` (bấm là sao chép). Chặn click lan lên dòng bảng để không mở xem nhanh.
 */
export function TrackingLink({
  trackingNo,
  url,
  prefilled,
  children,
  className,
  hideIcon,
}: TrackingLinkProps) {
  if (!url) {
    return (
      <CopyText value={trackingNo} what="mã vận đơn" className={className}>
        {children}
      </CopyText>
    );
  }
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (prefilled) return;
    void navigator.clipboard
      ?.writeText(trackingNo)
      .then(() => toast.success(`Đã sao chép mã ${trackingNo} — dán vào ô tra cứu của hãng`))
      .catch(() => undefined);
  };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={
        prefilled
          ? 'Mở đơn này trên trang tra cứu của hãng (tab mới)'
          : 'Mở trang tra cứu của hãng (tab mới) — mã được sao chép sẵn để dán'
      }
      aria-label={`Tra cứu vận đơn ${trackingNo} trên trang hãng`}
      onClick={onClick}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children ?? trackingNo}
      {hideIcon ? null : <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />}
    </a>
  );
}
