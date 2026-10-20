'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PancakeStaffTable } from './pancake-staff-table';

/**
 * Khối "Nhân viên Pancake" trong Kết nối Pancake (quản trị) — mọi nhân viên Pancake và tài khoản
 * ERP đang gắn. Bảng + hộp gắn dùng chung với màn /crm/pancake-staff của trưởng nhóm
 * (2026-10-20): nhân viên có fb_id khai trên hồ sơ hoặc email trùng email ERP được gắn tự động;
 * người chốt đơn chưa có tài khoản được tạo tự động (pc.*); gắn tài khoản tự tạo vào người thật →
 * đơn + khách chuyển ngay, pc.* xoá mềm.
 */
export function PancakeStaffSection() {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Nhân viên Pancake</h2>
          <p className="text-sm text-muted-foreground">
            Người chốt đơn trên Pancake là người phụ trách đơn trong ERP (dùng để tính hoa hồng).
            Người có email Pancake trùng email tài khoản ERP được gán tự động; người chưa có tài
            khoản được tạo tự động; gắn tài khoản tự tạo vào người thật thì đơn và khách chuyển
            ngay, tài khoản tự tạo bị xóa.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/crm/pancake-staff">
            Màn chờ xử lý cho trưởng nhóm
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </div>
      <PancakeStaffTable pending={false} />
    </section>
  );
}
