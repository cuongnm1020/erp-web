import { GrnDetailScreen } from '@/features/wms/components/grn-detail-screen';

export const metadata = { title: 'Chi tiết phiếu nhập — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GrnDetailScreen id={id} />;
}
