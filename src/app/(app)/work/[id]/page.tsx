import { WorkDetailScreen } from '@/features/work/components/work-detail-screen';

export const metadata = { title: 'Chi tiết việc — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkDetailScreen id={id} />;
}
