import { PriceListDetailScreen } from '@/features/pricing/components/price-list-detail-screen';

export const metadata = { title: 'Chi tiết bảng giá — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PriceListDetailScreen id={id} />;
}
