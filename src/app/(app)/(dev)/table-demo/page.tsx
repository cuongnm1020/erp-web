import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ListSkeleton } from '@/components/data/states';
import { TableDemo } from './table-demo';

/** Chỉ dev: demo DataTable + URL state (FE-0-07 "Done khi"). Production → 404. */
export default function TableDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TableDemo />
    </Suspense>
  );
}
