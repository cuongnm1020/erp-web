'use client';

import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/cn';
import { CarrierSettingsSection } from './carrier-settings-section';

/**
 * Cấu hình hệ thống (/admin/settings). Tab chỉ gồm phần ĐÃ nối API — bản UI-first cũ (dải số
 * chứng từ, kỳ kế toán… với dữ liệu mẫu) đã gỡ khi mở lại menu 2026-10-04 để admin không
 * nhầm dữ liệu mẫu là cấu hình thật; thêm tab khi backend có API tương ứng.
 */
const CONFIG_TABS = [{ key: 'carriers', label: 'Đơn vị vận chuyển' }] as const;

export function SettingsScreen() {
  const active = CONFIG_TABS[0].key;
  return (
    <>
      <PageHeader
        title="Cấu hình hệ thống"
        description="Thay đổi có hiệu lực ngay, được ghi vào nhật ký audit"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Cấu hình hệ thống' }]}
      />
      <div className="grid items-start gap-3 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Nhóm cấu hình" className="rounded-md border bg-card p-2">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={tab.key === active ? 'page' : undefined}
              className={cn(
                'block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted',
                tab.key === active && 'bg-secondary font-semibold text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <CarrierSettingsSection />
      </div>
    </>
  );
}
