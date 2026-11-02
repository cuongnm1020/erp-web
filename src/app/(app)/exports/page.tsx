import { ExportRequestsScreen } from '@/features/admin/components/export-requests-screen';

export const metadata = { title: 'Yêu cầu xuất Excel — ERP' };

/** Mọi người đăng nhập: yêu cầu xuất Excel của mình (API chỉ trả yêu cầu của người gọi). */
export default function Page() {
  return <ExportRequestsScreen mine />;
}
