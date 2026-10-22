import { redirect } from 'next/navigation';

/** Ticket CSKH (mock cũ, mã giả) đã thay bằng module Công việc — về hàng chờ yêu cầu. */
export default function Page() {
  redirect('/work/queue');
}
