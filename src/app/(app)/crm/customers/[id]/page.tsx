import { Customer360Screen } from '@/features/customers/components/customer-360-screen';

export const metadata = { title: 'Hồ sơ khách hàng — ERP' };

/** Luật 12: page chỉ đọc params rồi render một feature component. Không fetch ở đây (luật 14). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Customer360Screen id={id} />;
}
