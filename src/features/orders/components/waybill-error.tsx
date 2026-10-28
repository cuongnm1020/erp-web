import { StatusBadge } from '@/components/data/status-badge';
import { carrierSaid, messageForCode } from '@/lib/error-messages';

/**
 * Lỗi vận đơn + đơn sàn (tab "Lỗi vận đơn", 2026-10-28, mockup Vxt1vbkxBB3DKnHKYAdLzX). Dùng chung
 * cho danh sách đơn, hộp kết quả gửi hãng / đóng gói và màn sửa đơn.
 */

const MARKETPLACE_LABEL: Record<string, string> = {
  TIKTOK: 'TikTok',
  SHOPEE: 'Shopee',
  LAZADA: 'Lazada',
};

/** Câu lỗi vận đơn: câu chính theo mã (luật 6) + nguyên văn lời hãng khi hãng từ chối. */
export function waybillErrorText(code: string | null, carrierMessage: string | null): string {
  const base = messageForCode(code ?? 'CARRIER_API_ERROR');
  return code === 'CARRIER_REJECTED' && carrierMessage
    ? `${carrierSaid(carrierMessage)} ${base}`
    : base;
}

/** Chip sàn (TikTok…) cạnh nguồn đơn. */
export function MarketplaceBadge({ marketplace }: { marketplace: string | null | undefined }) {
  if (!marketplace) return null;
  return <StatusBadge tone="neutral">{MARKETPLACE_LABEL[marketplace] ?? marketplace}</StatusBadge>;
}

/** Chip "SĐT bị che" — hãng sẽ từ chối khi cấp vận đơn. */
export function MaskedPhoneBadge({ masked }: { masked: boolean | undefined }) {
  if (!masked) return null;
  return (
    <span title="SĐT người nhận bị sàn che — hãng sẽ từ chối. Nhập SĐT thật cho đơn ở màn sửa đơn.">
      <StatusBadge tone="warn">SĐT bị che</StatusBadge>
    </span>
  );
}
