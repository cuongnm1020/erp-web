import { notFound } from 'next/navigation';
import { StatesDemo } from './states-demo';

/** Chỉ dev: công tắc 4 trạng thái (FE-0-09 "Done khi"). Production → 404. */
export default function StatesDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StatesDemo />;
}
