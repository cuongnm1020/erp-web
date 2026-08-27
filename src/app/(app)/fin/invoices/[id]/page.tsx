import { InvoiceDetailScreen } from '@/features/fin/components/invoice-detail-screen';

export const metadata = { title: 'Chi tiết hóa đơn — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailScreen id={id} />;
}
