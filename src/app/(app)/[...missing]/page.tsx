import { NotFoundCard } from '@/components/layout/not-found-screen';

export const metadata = { title: 'Không tìm thấy — ERP' };

/**
 * Catch-all cho URL không khớp route nào TRONG shell (design/404.png) — 404 vẫn có sidebar,
 * không đá người dùng ra màn trắng. Luật 12: page chỉ đọc params rồi render.
 */
export default async function Page({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params;
  const path = `/${missing.join('/')}`;
  return (
    <>
      <h1 className="text-xl font-semibold">Không tìm thấy</h1>
      <NotFoundCard
        title="Không có trang này"
        path={path}
        description="Đường dẫn có thể gõ sai hoặc trang đã được chuyển đi. Kiểm tra lại liên kết, hoặc tìm nhanh thứ bạn cần."
        backHref="/"
        backLabel="Về Tổng quan"
      />
    </>
  );
}
