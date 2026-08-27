import { ProductDetailScreen } from '@/features/catalog/components/product-detail-screen';

export const metadata = { title: 'Chi tiết sản phẩm — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <ProductDetailScreen />;
}
