import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Mã đơn Pancake bấm được → mở đúng đơn trên POS tương ứng ở tab mới (2026-10-19). Link là
 * `order_link` Pancake trả kèm đơn (`pos.pages.fm/shop/<shop>/order?order_id=…`) — API chuyển
 * nguyên văn qua `pancakeOrderLink`, web không tự ghép URL. Không có link (đơn cũ) → chữ thường.
 *
 * Nằm trong dòng bấm được (danh sách đơn mở xem nhanh) → chặn nổi bọt click để chỉ mở Pancake.
 */
export function PancakeOrderLink({
  orderId,
  link,
  className,
}: {
  orderId: string;
  link: string | null;
  className?: string;
}) {
  const label = `Pancake #${orderId}`;
  if (!link) return <span className={className}>{label}</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      title="Mở đơn trên Pancake POS"
      onClick={(e) => e.stopPropagation()}
      className={cn('inline-flex items-center gap-0.5 text-primary hover:underline', className)}
    >
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
