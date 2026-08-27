import { OrderDetailScreen } from '@/features/orders/components/order-detail-screen';

export const metadata = { title: 'Chi tiết đơn hàng — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailScreen orderId={id} />;
}
