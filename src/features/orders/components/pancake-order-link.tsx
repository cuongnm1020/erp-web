import { ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

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

/**
 * Đơn Pancake "ERP giữ" (2026-11-03): đã sửa trên ERP → không nhận cập nhật từ Pancake nữa, chỉ
 * đẩy ERP → Pancake. Hiện cạnh mã Pancake ở danh sách và chi tiết đơn.
 */
export function PancakeErpLockedBadge({ lockedAt }: { lockedAt: string | null }) {
  if (!lockedAt) return null;
  return (
    <span
      className="inline-flex"
      title={`Sửa trên ERP lúc ${formatDateTime(lockedAt)} — không nhận cập nhật từ Pancake, chỉ đẩy ERP → Pancake`}
    >
      <StatusBadge tone="warn">Sửa trên ERP</StatusBadge>
    </span>
  );
}
