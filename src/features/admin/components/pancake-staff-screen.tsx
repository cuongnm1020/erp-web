'use client';

import { Eraser } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { KpiCard } from '@/components/data/kpi-card';
import { ForbiddenState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import { useListState } from '@/lib/url-state';
import { useCleanupPancakeStaff, usePancakeStaff } from '../api/use-pancake-staff';
import { count, PancakeStaffTable } from './pancake-staff-table';

const DEFAULTS = { filterKeys: ['tab'] as const };
type Filter = (typeof DEFAULTS.filterKeys)[number];

/**
 * Nhân viên Pancake (`/crm/pancake-staff`, 2026-10-20 — spec docs/screens/FE-PANCAKE-STAFF-1).
 *
 * Trưởng nhóm kinh doanh (sync.staff_read) thấy người chốt / tạo / chăm sóc đơn trên Pancake CHƯA
 * có tài khoản thật trong ERP — đang ở tài khoản tự tạo `pc.*` hoặc còn chờ — kèm số đơn / khách
 * đang treo trên tài khoản tự tạo và gợi ý tài khoản trùng email, để gắn họ vào nhân sự phòng mình
 * (sync.staff_map). Gắn xong: đơn + khách chuyển ngay, tài khoản tự tạo bị xoá.
 * Tab "Chờ xử lý" / "Tất cả" nằm trên URL (luật 8). Quản trị (sync.map) có thêm nút dọn tài khoản
 * tự tạo đã khoá từ trước.
 */
export function PancakeStaffScreen() {
  const ability = useAbility();
  const { state, set } = useListState<Filter>(DEFAULTS);
  const tab = state.filters.tab === 'all' ? 'all' : 'pending';
  const canRead = ability.can('staff_read', 'Sync');
  const pending = usePancakeStaff(true, canRead);
  const [cleaning, setCleaning] = useState(false);
  const cleanup = useCleanupPancakeStaff();

  if (!canRead) return <ForbiddenState />;

  const rows = pending.data ?? [];
  const autoRows = rows.filter((r) => r.autoCreated);
  const orders = autoRows.reduce((n, r) => n + r.orderCount, 0);
  const customers = autoRows.reduce((n, r) => n + r.customerCount, 0);
  const suggested = rows.filter((r) => r.suggestedUser).length;

  const runCleanup = async () => {
    try {
      const r = await cleanup.mutateAsync();
      const done = r.items.filter((i) => !i.skipped);
      const skipped = r.items.length - done.length;
      toast.success('Đã dọn tài khoản tự tạo', {
        description: `${done.length} tài khoản gộp xong (${count(
          done.reduce((n, i) => n + i.orders, 0),
        )} đơn, ${count(done.reduce((n, i) => n + i.customers, 0))} khách)${
          skipped ? `; ${skipped} tài khoản không rõ người nhận — gắn tay bên dưới` : ''
        }`,
      });
    } catch (err) {
      toast.error(messageFor(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Nhân viên Pancake"
        description="Người chốt đơn trên Pancake chưa có tài khoản thật trong ERP — gắn họ vào nhân sự để đơn, khách và hoa hồng về đúng người."
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Nhân viên Pancake' },
        ]}
        actions={
          <Can I="map" a="Sync">
            <Button variant="outline" size="sm" onClick={() => setCleaning(true)}>
              <Eraser aria-hidden />
              Dọn tài khoản tự tạo đã khóa
            </Button>
          </Can>
        }
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <KpiCard
          label="Chưa có tài khoản thật"
          value={pending.isPending ? '…' : count(rows.length)}
          detail={suggested ? `${count(suggested)} người có gợi ý trùng email` : undefined}
        />
        <KpiCard
          label="Đơn đang treo ở tài khoản tự tạo"
          value={pending.isPending ? '…' : count(orders)}
          detail="Chuyển sang người thật ngay khi gắn"
        />
        <KpiCard
          label="Khách đang treo ở tài khoản tự tạo"
          value={pending.isPending ? '…' : count(customers)}
          detail="Người thật thành người phụ trách khách"
        />
      </div>
      <div className="mt-4 flex items-center gap-1" role="tablist" aria-label="Lọc nhân viên">
        {(
          [
            ['pending', 'Chờ xử lý'],
            ['all', 'Tất cả'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={cn(
              'h-8 rounded-md px-3 text-sm font-medium',
              tab === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => set({ filters: key === 'all' ? { tab: 'all' } : {} })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <PancakeStaffTable pending={tab === 'pending'} />
      </div>
      <ConfirmDialog
        open={cleaning}
        onOpenChange={setCleaning}
        title="Dọn tài khoản tự tạo đã khóa?"
        description="Tài khoản pc.* đã khóa trước đây (POS đã chuyển sang người thật nhưng đơn / khách còn đứng tên nó) sẽ được gộp nốt: đơn và khách chuyển sang người đã nhận POS, tài khoản bị xóa khỏi danh sách. Tài khoản không rõ người nhận được giữ lại để gắn tay."
        confirmLabel="Dọn ngay"
        destructive={false}
        onConfirm={runCleanup}
      />
    </>
  );
}
