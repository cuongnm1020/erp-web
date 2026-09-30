import { ComboFormScreen } from '@/features/catalog/components/combo-form-screen';

export const metadata = { title: 'Sửa combo — ERP' };

/** Luật 12: page chỉ đọc params rồi render một feature component. Không fetch ở đây (luật 14). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComboFormScreen comboId={id} />;
}
