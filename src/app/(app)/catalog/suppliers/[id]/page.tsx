import { SupplierDetailScreen } from '@/features/supplier/components/supplier-detail-screen';

export const metadata = { title: 'Chi tiết nhà cung cấp — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetailScreen supplierId={id} />;
}
