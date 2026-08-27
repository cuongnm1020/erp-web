import { SupplierDetailScreen } from '@/features/catalog/components/supplier-detail-screen';

export const metadata = { title: 'Chi tiết nhà cung cấp — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <SupplierDetailScreen />;
}
