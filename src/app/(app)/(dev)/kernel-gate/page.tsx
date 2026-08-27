import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ListSkeleton } from '@/components/data/states';
import { CustomerListGate } from '@/features/customers';

/** Gate FE-0: danh sách khách hàng throwaway trên API thật (dev only). */
export default function KernelGatePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={<ListSkeleton rows={10} columns={6} />}>
      <CustomerListGate />
    </Suspense>
  );
}
