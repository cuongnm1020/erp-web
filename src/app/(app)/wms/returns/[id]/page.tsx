import { ReturnDetailScreen } from '@/features/wms/components/return-detail-screen';

export const metadata = { title: 'Chi tiết phiếu nhập hàng hoàn — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnDetailScreen id={id} />;
}
