import { ComboFormScreen } from '@/features/catalog/components/combo-form-screen';

export const metadata = { title: 'Tạo combo — ERP' };

/** `?from=<id>` = nhân bản combo đó (form điền sẵn, mã để trống). Luật 12: chỉ đọc params. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  return <ComboFormScreen copyFromId={typeof from === 'string' ? from : undefined} />;
}
