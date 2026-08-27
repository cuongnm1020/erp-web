import { UserDetailScreen } from '@/features/admin/components/user-detail-screen';

export const metadata = { title: 'Chi tiết nhân viên — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailScreen id={id} />;
}
