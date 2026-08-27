import { GdnDetailScreen } from '@/features/wms/components/gdn-detail-screen';

export const metadata = { title: 'Chi tiết phiếu xuất — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GdnDetailScreen id={id} />;
}
