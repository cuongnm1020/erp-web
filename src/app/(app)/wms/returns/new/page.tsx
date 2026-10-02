import { Suspense } from 'react';
import { ReturnCreateScreen } from '@/features/wms/components/return-create-screen';

export const metadata = { title: 'Lập phiếu nhập hàng hoàn — ERP' };

export default function Page() {
  return (
    <Suspense>
      <ReturnCreateScreen />
    </Suspense>
  );
}
