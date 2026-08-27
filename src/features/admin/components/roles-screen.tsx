'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search } from 'lucide-react';
import { Fragment } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

interface RoleColumn {
  name: string;
  memberCount: number;
}

interface PermissionRow {
  label: string;
  code: string;
  /** Giá trị theo thứ tự cột vai trò (bỏ Admin — Admin luôn có mọi quyền). */
  granted: boolean[];
  /** Chỉ số cột (trong `granted`) vừa đổi, chưa lưu. */
  changedAt?: number;
}

interface PermissionGroup {
  module: string;
  rows: PermissionRow[];
}

const SAMPLE_ROLES: RoleColumn[] = [
  { name: 'Admin', memberCount: 2 },
  { name: 'Sale leader', memberCount: 2 },
  { name: 'Sale', memberCount: 9 },
  { name: 'CSKH', memberCount: 5 },
  { name: 'Quản lý kho', memberCount: 2 },
  { name: 'NV kho', memberCount: 11 },
  { name: 'Kế toán', memberCount: 3 },
  { name: 'Mua hàng', memberCount: 2 },
];

const SAMPLE_MATRIX: PermissionGroup[] = [
  {
    module: 'Bán hàng',
    rows: [
      {
        label: 'Xem đơn hàng',
        code: 'order.read',
        granted: [true, true, true, true, false, true, false],
      },
      {
        label: 'Tạo đơn',
        code: 'order.create',
        granted: [true, true, true, false, false, false, false],
      },
      {
        label: 'Duyệt đơn vượt trần',
        code: 'order.approve',
        granted: [true, false, false, false, false, false, false],
      },
      {
        label: 'Hủy đơn',
        code: 'order.cancel',
        granted: [true, false, false, false, false, true, false],
        changedAt: 0,
      },
      {
        label: 'CK vượt trần không cần duyệt',
        code: 'order.discount.override',
        granted: [false, false, false, false, false, false, false],
      },
    ],
  },
  {
    module: 'Khách hàng',
    rows: [
      {
        label: 'Xem khách (theo scope)',
        code: 'customer.read',
        granted: [true, true, true, true, false, true, false],
      },
      {
        label: 'Tạo/sửa khách',
        code: 'customer.write',
        granted: [true, true, true, false, false, false, false],
      },
      {
        label: 'Phân công khách',
        code: 'customer.assign',
        granted: [true, false, false, false, false, false, false],
      },
      {
        label: 'Gộp khách trùng',
        code: 'customer.merge',
        granted: [true, false, true, false, false, false, false],
        changedAt: 0,
      },
      {
        label: 'Sửa hạn mức công nợ',
        code: 'customer.credit.edit',
        granted: [false, false, false, false, false, true, false],
      },
    ],
  },
  {
    module: 'Kho',
    rows: [
      {
        label: 'Xem tồn thực / đang giữ',
        code: 'stock.read',
        granted: [false, false, false, true, true, true, false],
      },
      {
        label: 'Post phiếu nhập',
        code: 'receipt.post',
        granted: [false, false, false, true, true, false, false],
      },
      {
        label: 'Post phiếu xuất',
        code: 'issue.post',
        granted: [false, false, false, true, true, false, false],
      },
      {
        label: 'Gán task kho',
        code: 'task.assign',
        granted: [false, false, false, true, false, false, false],
      },
      {
        label: 'Điều chỉnh tồn',
        code: 'stock.adjust',
        granted: [false, false, false, true, false, false, false],
      },
      {
        label: 'Duyệt chênh lệch kiểm kê',
        code: 'count.approve',
        granted: [false, false, false, true, false, true, false],
      },
    ],
  },
  {
    module: 'Tài chính',
    rows: [
      {
        label: 'Phát hành hóa đơn',
        code: 'invoice.issue',
        granted: [false, false, false, false, false, true, false],
      },
      {
        label: 'Ghi nhận thanh toán',
        code: 'payment.record',
        granted: [false, false, false, false, false, true, false],
      },
      {
        label: 'Khóa kỳ kế toán',
        code: 'period.lock',
        granted: [false, false, false, false, false, true, false],
      },
      {
        label: 'Xem giá vốn',
        code: 'cogs.read',
        granted: [false, false, false, false, false, true, true],
      },
    ],
  },
  {
    module: 'Quản trị',
    rows: [
      {
        label: 'Quản lý nhân viên',
        code: 'user.manage',
        granted: [false, false, false, false, false, false, false],
      },
      {
        label: 'Sửa ma trận quyền',
        code: 'role.manage',
        granted: [false, false, false, false, false, false, false],
      },
      {
        label: 'Xem audit log',
        code: 'audit.read',
        granted: [false, false, false, false, false, true, false],
      },
      {
        label: 'Sửa cấu hình hệ thống',
        code: 'config.edit',
        granted: [false, false, false, false, false, false, false],
      },
    ],
  },
];

export function RolesScreen() {
  return (
    <>
      <PageHeader
        title="Vai trò & quyền"
        description="8 vai trò · 24 quyền · Đổi lần cuối 11/08/2026 bởi Lê Quang Huy"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Hệ thống' }, { label: 'Vai trò & quyền' }]}
        actions={
          <>
            <StatusBadge tone="warn">2 thay đổi chưa lưu</StatusBadge>
            <Button variant="outline">Thêm vai trò</Button>
            <Button variant="ghost">Hoàn tác</Button>
            <Button>
              Lưu thay đổi
              <kbd className="rounded-sm bg-primary-foreground/20 px-1 text-xs">Ctrl S</kbd>
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input className="h-7 pl-8 text-xs" placeholder="Tìm quyền…" />
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Module: Tất cả
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary px-2.5 text-xs font-semibold text-primary"
        >
          Chỉ quyền đã đổi ✕
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          Nhấn ô để bật/tắt · Admin luôn có mọi quyền
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="min-w-64 px-2.5">Quyền</TableHead>
              {SAMPLE_ROLES.map((r) => (
                <TableHead key={r.name} className="px-2.5 text-center">
                  {r.name}
                  <span className="block font-normal text-muted-foreground">
                    {r.memberCount} NV
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_MATRIX.map((group) => (
              <Fragment key={group.module}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell
                    colSpan={SAMPLE_ROLES.length + 1}
                    className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {group.module}
                  </TableCell>
                </TableRow>
                {group.rows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="px-2.5 py-1.5">
                      {row.label}{' '}
                      <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-center">
                      <Checkbox checked disabled aria-label={`Admin · ${row.label}`} />
                    </TableCell>
                    {row.granted.map((on, i) => {
                      const role = SAMPLE_ROLES[i + 1];
                      return (
                        <TableCell
                          key={role?.name ?? i}
                          className={cn(
                            'px-2.5 py-1.5 text-center',
                            row.changedAt === i && 'bg-warning/10',
                          )}
                        >
                          <Checkbox checked={on} aria-label={`${role?.name} · ${row.label}`} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Ô vàng = đã đổi chưa lưu. Lưu là một lần cho toàn ma trận; quyền dữ liệu (scope khách) không
        nằm ở đây mà theo team.
      </p>
    </>
  );
}
