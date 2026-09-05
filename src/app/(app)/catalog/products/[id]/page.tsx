import { ProductDetailScreen } from '@/features/catalog/components/product-detail-screen';

export const metadata = { title: 'Chi tiết sản phẩm — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailScreen productId={id} />;
}
