import { redirect } from 'next/navigation';

/** Ticket CSKH (mock cũ) đã thay bằng module Công việc — hàng chờ yêu cầu (2026-10-22). */
export default function Page() {
  redirect('/work/queue');
}
