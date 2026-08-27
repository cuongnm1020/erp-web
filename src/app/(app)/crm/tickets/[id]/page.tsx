import { TicketDetailScreen } from '@/features/tickets/components/ticket-detail-screen';

export const metadata = { title: 'Chi tiết ticket — ERP' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailScreen id={id} />;
}
