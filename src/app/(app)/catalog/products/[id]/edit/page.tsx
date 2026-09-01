import { ProductFormScreen } from '@/features/catalog/components/product-form-screen';

export const metadata = { title: 'Sửa sản phẩm — ERP' };

/** Luật 12: page chỉ đọc params rồi render một feature component. Không fetch ở đây (luật 14). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductFormScreen productId={id} />;
}
