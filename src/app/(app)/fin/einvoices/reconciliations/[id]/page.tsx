import { CarrierReconScreen } from '@/features/fin/components/carrier-recon-screen';

export const metadata = { title: 'Đối soát hãng — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CarrierReconScreen id={id} />;
}
