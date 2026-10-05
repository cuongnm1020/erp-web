import type { Metadata } from 'next';
import { UnsubscribeScreen } from '@/features/unsubscribe/components/unsubscribe-screen';

/**
 * Trang CÔNG KHAI (CRM-13) — nằm ngoài route group (app)/(pda): không SessionProvider, không
 * app shell. Middleware cho qua nhờ `/unsubscribe/` trong PUBLIC_PREFIXES (route-guard.ts).
 * Luật 12: chỉ đọc params rồi render một feature component.
 */
export const metadata: Metadata = {
  // absolute: khách hàng xem, không gắn hậu tố "· ERP" của portal nội bộ.
  title: { absolute: 'Hủy nhận tin' },
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <UnsubscribeScreen token={token} />;
}
