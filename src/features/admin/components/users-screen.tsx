'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
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
import { formatDateTime } from '@/lib/format';

interface EmployeeRow {
  code: string;
  name: string;
  email: string;
  department: string;
  team: string | null;
  role: string;
  status: 'active' | 'pending' | 'locked';
  lastLoginAt: string;
}

const STATUS_LABEL: Record<EmployeeRow['status'], { label: string; tone: StatusTone }> = {
  active: { label: 'Hoạt động', tone: 'ok' },
  pending: { label: 'Chờ kích hoạt', tone: 'warn' },
  locked: { label: 'Đã khóa', tone: 'neutral' },
};

const SAMPLE_EMPLOYEES: EmployeeRow[] = [
  {
    code: 'NV-0001',
    name: 'Lê Quang Huy',
    email: 'huy.lq@congty.vn',
    department: 'Ban giám đốc',
    team: null,
    role: 'Admin',
    status: 'active',
    lastLoginAt: '2026-08-23T10:02:00+07:00',
  },
  {
    code: 'NV-0002',
    name: 'Trần Thị Bình',
    email: 'binh.tt@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale Hà Nội',
    role: 'Sale leader',
    status: 'active',
    lastLoginAt: '2026-08-23T09:48:00+07:00',
  },
  {
    code: 'NV-0003',
    name: 'Nguyễn Văn An',
    email: 'an.nv@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale Hà Nội',
    role: 'Sale',
    status: 'active',
    lastLoginAt: '2026-08-23T09:41:00+07:00',
  },
  {
    code: 'NV-0004',
    name: 'Phạm Thu Hà',
    email: 'ha.pt@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale Hà Nội',
    role: 'Sale',
    status: 'active',
    lastLoginAt: '2026-08-23T08:55:00+07:00',
  },
  {
    code: 'NV-0005',
    name: 'Đỗ Minh Tuấn',
    email: 'tuan.dm@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale HCM',
    role: 'Sale leader',
    status: 'active',
    lastLoginAt: '2026-08-23T08:30:00+07:00',
  },
  {
    code: 'NV-0006',
    name: 'Vũ Thị Lan',
    email: 'lan.vt@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale HCM',
    role: 'Sale',
    status: 'active',
    lastLoginAt: '2026-08-22T17:50:00+07:00',
  },
  {
    code: 'NV-0008',
    name: 'Bùi Thị Hạnh',
    email: 'hanh.bt@congty.vn',
    department: 'CSKH',
    team: 'CSKH miền Bắc',
    role: 'CSKH',
    status: 'active',
    lastLoginAt: '2026-08-23T09:12:00+07:00',
  },
  {
    code: 'NV-0010',
    name: 'Lý Văn Sơn',
    email: 'son.lv@congty.vn',
    department: 'Kho vận',
    team: 'Kho HN-1',
    role: 'Quản lý kho',
    status: 'active',
    lastLoginAt: '2026-08-23T06:30:00+07:00',
  },
  {
    code: 'NV-0011',
    name: 'Trịnh Thị Mai',
    email: 'mai.tt@congty.vn',
    department: 'Kho vận',
    team: 'Kho HN-1',
    role: 'Nhân viên kho',
    status: 'active',
    lastLoginAt: '2026-08-23T06:32:00+07:00',
  },
  {
    code: 'NV-0013',
    name: 'Cao Thị Yến',
    email: 'yen.ct@congty.vn',
    department: 'Kho vận',
    team: 'Kho HN-1',
    role: 'Nhân viên kho',
    status: 'pending',
    lastLoginAt: '2026-08-22T14:10:00+07:00',
  },
  {
    code: 'NV-0014',
    name: 'Mai Văn Đức',
    email: 'duc.mv@congty.vn',
    department: 'Kho vận',
    team: 'Kho HCM-2',
    role: 'Quản lý kho',
    status: 'active',
    lastLoginAt: '2026-08-23T06:28:00+07:00',
  },
  {
    code: 'NV-0017',
    name: 'Đặng Thị Thu',
    email: 'thu.dt@congty.vn',
    department: 'Kế toán',
    team: null,
    role: 'Kế toán',
    status: 'active',
    lastLoginAt: '2026-08-23T08:05:00+07:00',
  },
  {
    code: 'NV-0018',
    name: 'Tạ Văn Kiên',
    email: 'kien.tv@congty.vn',
    department: 'Kế toán',
    team: null,
    role: 'Kế toán trưởng',
    status: 'active',
    lastLoginAt: '2026-08-23T08:20:00+07:00',
  },
  {
    code: 'NV-0021',
    name: 'Nguyễn Thị Hường',
    email: 'huong.nt@congty.vn',
    department: 'Kinh doanh',
    team: 'Sale Hà Nội',
    role: 'Sale',
    status: 'locked',
    lastLoginAt: '2026-07-12T11:20:00+07:00',
  },
  {
    code: 'NV-0024',
    name: 'Trần Văn Bảo',
    email: 'bao.tv@congty.vn',
    department: 'Mua hàng',
    team: null,
    role: 'Mua hàng',
    status: 'active',
    lastLoginAt: '2026-08-23T08:10:00+07:00',
  },
];

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={
        active
          ? 'inline-flex h-7 items-center gap-1 rounded-md bg-secondary px-2.5 text-xs font-semibold text-primary'
          : 'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted'
      }
    >
      {label}
      <ChevronDown className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function UsersScreen() {
  return (
    <>
      <PageHeader
        title="Nhân viên"
        description="57 tài khoản · 52 hoạt động · 3 chờ kích hoạt · 2 đã khóa"
        breadcrumb={[{ label: 'Quản trị' }, { label: 'Nhân viên' }]}
        actions={
          <>
            <Button variant="outline">Import CSV</Button>
            <Button variant="outline">Xuất CSV</Button>
            <Button>
              Thêm nhân viên
              <kbd className="rounded-sm bg-primary-foreground/20 px-1 text-xs">N</kbd>
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input className="h-7 pl-8 text-xs" placeholder="Tìm mã, tên, email…" />
        </div>
        <FilterChip label="Phòng ban: Tất cả" />
        <FilterChip label="Team: Tất cả" />
        <FilterChip label="Vai trò: Tất cả" />
        <FilterChip label="Trạng thái: Hoạt động" active />
        <Button variant="ghost" size="sm">
          + Lọc
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Đã lưu: <span className="font-semibold text-foreground">Mặc định</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-8 px-2.5">
                <Checkbox aria-label="Chọn tất cả" />
              </TableHead>
              <TableHead className="px-2.5">Mã NV ↑</TableHead>
              <TableHead className="px-2.5">Họ tên</TableHead>
              <TableHead className="px-2.5">Email</TableHead>
              <TableHead className="px-2.5">Phòng ban</TableHead>
              <TableHead className="px-2.5">Team</TableHead>
              <TableHead className="px-2.5">Vai trò</TableHead>
              <TableHead className="px-2.5">Trạng thái</TableHead>
              <TableHead className="px-2.5 text-right">Đăng nhập gần nhất</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_EMPLOYEES.map((e) => {
              const s = STATUS_LABEL[e.status];
              return (
                <TableRow key={e.code}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Chọn ${e.code}`} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    <Link href={`/admin/users/${e.code}`} className="text-primary hover:underline">
                      {e.code}
                    </Link>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-semibold">{e.name}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{e.email}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{e.department}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{e.team ?? '—'}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone="neutral">{e.role}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatDateTime(e.lastLoginAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–24 / 57</span>
          <span className="flex items-center gap-1">
            <span className="px-1.5">‹</span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold text-primary">
              1
            </span>
            <span className="px-1.5">2</span>
            <span className="px-1.5">3</span>
            <span className="px-1.5">›</span>
            <span className="ml-2">40 dòng/trang</span>
          </span>
        </div>
      </div>
    </>
  );
}
