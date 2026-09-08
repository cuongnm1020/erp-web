import { OrderEditScreen } from '@/features/orders/components/order-edit-screen';

export const metadata = { title: 'Sửa đơn hàng — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderEditScreen orderId={id} />;
}
