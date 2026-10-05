'use client';

import { LayoutDashboard, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EmptyState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatDate, toLocalDateKey } from '@/lib/format';
import { Can, useAbility } from '@/lib/permission';
import { PendingOrdersWidget, ShippingWidget } from './ops-widgets';
import { RevenueChartWidget, SalesKpiWidget, TopProductsWidget } from './sales-widgets';

/**
 * Tổng quan (RPT-08) — chỉ số thật, ghép theo quyền của người xem (không còn nút đổi góc nhìn
 * Sale / Quản lý của bản UI-first):
 * - `report.sales`: KPI hôm nay so hôm qua + tháng này, doanh thu 30 ngày, top 5 bán chạy tháng —
 *   mỗi ô link sang /reports/sales đúng tab + khoảng. Phạm vi số do API scope (D-CR2).
 * - `sales_order.read`: đơn chờ duyệt. `shipment.read`: giao hàng trong ngày.
 * Bỏ hẳn các ô chưa có API (mục tiêu doanh thu, công nợ quá hạn, KH lâu không mua, ngoại lệ, task
 * quá SLA, đơn theo trạng thái) — không hiện số giả. Dashboard cổ đông chưa quyết định, không dựng.
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
  const monthStart = `${today.slice(0, 8)}01`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tổng quan"
        description={`Hôm nay ${formatDate(today)}`}
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

      {canSales ? (
        <>
          <SalesKpiWidget
            title="Hôm nay"
            range={{ from: today, to: today }}
            previousLabel="Hôm qua"
            emptyTitle="Hôm nay và hôm qua chưa có đơn đã chốt"
          />
          <SalesKpiWidget
            title={`Tháng ${today.slice(5, 7)}/${today.slice(0, 4)}`}
            range={{ from: monthStart, to: today }}
            previousLabel="Kỳ trước"
            emptyTitle="Tháng này và kỳ trước chưa có đơn đã chốt"
          />
          <div className="grid gap-3 xl:grid-cols-3">
            <RevenueChartWidget today={today} />
            <TopProductsWidget today={today} />
          </div>
        </>
      ) : null}

      {canOrders || canShipping ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {canShipping ? <ShippingWidget today={today} /> : null}
          {canOrders ? <PendingOrdersWidget /> : null}
        </div>
      ) : null}

      {!canSales && !canOrders && !canShipping ? (
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
