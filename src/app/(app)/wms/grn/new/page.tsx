import { GrnCreateScreen } from '@/features/wms/components/grn-create-screen';

export const metadata = { title: 'Tạo phiếu nhập kho — ERP' };

/** `?from=<id>` = nhân bản phiếu nhập đó (form điền sẵn). Luật 12: chỉ đọc params. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  return <GrnCreateScreen copyFromId={typeof from === 'string' ? from : undefined} />;
}
