import { EInvoiceDetailScreen } from '@/features/fin/components/einvoice-detail-screen';

export const metadata = { title: 'Hóa đơn điện tử — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EInvoiceDetailScreen id={id} />;
}
