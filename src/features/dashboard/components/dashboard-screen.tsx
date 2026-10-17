'use client';

import { LayoutDashboard, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EmptyState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate, formatTime, toLocalDateKey } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { PendingOrdersWidget, ShippingWidget } from './ops-widgets';
import { SalesWidget, TopProductsWidget } from './sales-widgets';
import { NeedsActionStrip, TodayCard } from './today-widgets';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
/** "Thứ Bảy, 17/10/2026" — thứ tính từ chính ngày YYYY-MM-DD (giờ VN), không theo múi giờ máy. */
const weekdayDate = (day: string) =>
  `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]}, ${formatDate(day)}`;

/**
 * Tổng quan (RPT-08, bố cục redesign 2026-10-17) — chỉ số thật, ghép theo quyền của người xem:
 * - `sales_order.read` / `stock.read`: tổng đơn hôm nay (gồm đơn hủy, theo kho đang chọn) + sản
 *   phẩm sắp hết + dải "Cần xử lý" (5 ô dẫn vào danh sách đã lọc).
 * - `report.sales`: bảng doanh số Hôm nay | Tháng này + doanh thu 30 ngày, top 5 bán chạy tháng —
 *   link sang /reports/sales đúng tab + khoảng. Phạm vi số do API scope (D-CR2).
 * - `sales_order.read`: đơn chờ duyệt. `shipment.read`: giao hàng trong ngày theo luồng + theo hãng.
 * Ô chưa có API (đơn theo giờ, sự cố đang mở) dựng khung + ghi "chờ API", không hiện số giả —
 * danh sách ở docs/UI-REDESIGN-2026-10-17.md. Dashboard cổ đông chưa quyết định, không dựng.
 */
export function DashboardScreen() {
  // Nhân viên kho sàn (PICKER / PACKER, 2026-09-15) không có màn nào ở dashboard: đưa thẳng vào
  // màn làm việc — đóng hàng (shipment.pack) → trạm đóng gói; còn lại có task.execute → màn pick.
  const ability = useAbility();
  const router = useRouter();
  const floorHome = floorRoute(ability);
  useEffect(() => {
    if (floorHome) router.replace(floorHome);
  }, [floorHome, router]);

  const today = toLocalDateKey(new Date()) ?? '';
  if (floorHome || !today) return null;

  const canSales = ability.can('sales', 'Report');
  const canOrders = ability.can('read', 'SalesOrder');
  const canShipping = ability.can('read', 'Shipment');
  const canStock = ability.can('read', 'Stock');

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tổng quan"
        description={`${weekdayDate(today)} · mở lúc ${formatTime(new Date())}`}
        breadcrumb={[{ label: 'Tổng quan' }]}
        actions={
          <>
            <Can I="read" a="Customer">
              <Button variant="outline" size="sm" asChild>
                <Link href="/crm/customers">
                  <Users />
                  Khách hàng
                </Link>
              </Button>
            </Can>
            <Can I="create" a="SalesOrder">
              <Button size="sm" asChild>
                <Link href="/crm/orders/new">
                  <Plus />
                  Tạo đơn
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      {canOrders || canStock ? (
        <>
          <TodayCard today={today} canOrders={canOrders} canStock={canStock} />
          <NeedsActionStrip canOrders={canOrders} canStock={canStock} />
        </>
      ) : null}

      {canSales ? (
        <div className="grid gap-3 xl:grid-cols-3">
          <SalesWidget today={today} className="xl:col-span-2" />
          <TopProductsWidget today={today} />
        </div>
      ) : null}

      {canOrders || canShipping ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {canShipping ? <ShippingWidget today={today} /> : null}
          {canOrders ? <PendingOrdersWidget /> : null}
        </div>
      ) : null}

      {!canSales && !canOrders && !canShipping && !canStock ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Chưa có chỉ số tổng quan cho vai trò của bạn"
          description="Mở màn làm việc từ menu bên trái. Cần xem doanh thu thì nhờ quản trị viên cấp quyền báo cáo."
        />
      ) : null}
    </div>
  );
}

/** Trang làm việc cho người chỉ có quyền kho sàn — null = người dùng bình thường, ở lại dashboard. */
export function floorRoute(ability: {
  can: (action: string, subject: string) => boolean;
}): string | null {
  if (!ability.can('execute', 'Task')) return null;
  const hasOffice =
    ability.can('read', 'Customer') ||
    ability.can('read', 'SalesOrder') ||
    ability.can('read', 'Stock');
  if (hasOffice) return null;
  return ability.can('pack', 'Shipment') ? '/wms/pack' : '/pda/pick';
}
