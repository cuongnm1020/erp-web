'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-5).

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

// ---------- Dữ liệu mẫu — góc nhìn Sale ----------

interface PendingOrderRow {
  code: string;
  customer: string;
  total: string;
  status: { tone: StatusTone; label: string };
  nextStep: string;
}

const SAMPLE_PENDING_ORDERS: PendingOrderRow[] = [
  {
    code: 'SO-2608-01241',
    customer: 'Cửa hàng Minh Tâm',
    total: '1596400',
    status: { tone: 'warn', label: 'Chờ duyệt' },
    nextStep: 'Trần Thị Bình đang duyệt',
  },
  {
    code: 'SO-2608-01238',
    customer: 'Nhà sách Tiền Phong Hà Đông',
    total: '4210000',
    status: { tone: 'err', label: 'Thiếu hàng' },
    nextStep: 'Thiếu 2 dòng tại Kho HN-1',
  },
  {
    code: 'SO-2608-01235',
    customer: 'Cửa hàng Hồng Hà Cầu Giấy',
    total: '820000',
    status: { tone: 'draft', label: 'Nháp' },
    nextStep: 'Chưa xác nhận · tạo 09:12',
  },
  {
    code: 'SO-2608-01229',
    customer: 'Trường THCS Nguyễn Du',
    total: '12480000',
    status: { tone: 'warn', label: 'Chờ duyệt' },
    nextStep: 'Vượt ngưỡng 10.000.000',
  },
  {
    code: 'SO-2608-01220',
    customer: 'Cửa hàng Ngọc Linh Long Biên',
    total: '2350000',
    status: { tone: 'brand', label: 'Đã giữ hàng' },
    nextStep: 'Chờ kho pick',
  },
  {
    code: 'SO-2608-01217',
    customer: 'Cửa hàng Thanh Bình Đống Đa',
    total: '640000',
    status: { tone: 'draft', label: 'Nháp' },
    nextStep: 'Chưa xác nhận · tạo hôm qua',
  },
  {
    code: 'SO-2608-01203',
    customer: 'Công ty TNHH Đại Phát Office',
    total: '7900000',
    status: { tone: 'err', label: 'Bị từ chối' },
    nextStep: 'Lý do: CK 20% không hợp lệ',
  },
  {
    code: 'SO-2608-01198',
    customer: 'Cửa hàng VPP Kim Ngân',
    total: '1120000',
    status: { tone: 'brand', label: 'Đã giữ hàng' },
    nextStep: 'Chờ kho pick',
  },
  {
    code: 'SO-2608-01190',
    customer: 'Cửa hàng Gia Bảo',
    total: '3460000',
    status: { tone: 'err', label: 'Thiếu hàng' },
    nextStep: 'Thiếu 1 dòng',
  },
  {
    code: 'SO-2608-01184',
    customer: 'Nhà sách Tuổi Trẻ Q.3',
    total: '980000',
    status: { tone: 'draft', label: 'Nháp' },
    nextStep: 'Chưa xác nhận',
  },
];

interface InactiveCustomerRow {
  name: string;
  daysSince: number;
  revenue6m: string;
}

const SAMPLE_INACTIVE_CUSTOMERS: InactiveCustomerRow[] = [
  { name: 'Công ty CP Giáo dục Ánh Dương', daysSince: 62, revenue6m: '18400000' },
  { name: 'Cửa hàng VPP Thành Đạt', daysSince: 48, revenue6m: '6250000' },
  { name: 'Nhà sách Phương Nam Q.1', daysSince: 45, revenue6m: '32100000' },
  { name: 'Siêu thị VPP Bình Minh', daysSince: 41, revenue6m: '9800000' },
  { name: 'Công ty TNHH Tân Hưng Phát', daysSince: 38, revenue6m: '4120000' },
  { name: 'Cửa hàng Thanh Bình Đống Đa', daysSince: 35, revenue6m: '2300000' },
  { name: 'Công ty TNHH Nam Việt Stationery', daysSince: 33, revenue6m: '11750000' },
  { name: 'Cửa hàng Hồng Hà Cầu Giấy', daysSince: 31, revenue6m: '5640000' },
  { name: 'Nhà sách Tiền Phong Hà Đông', daysSince: 30, revenue6m: '7900000' },
  { name: 'Cửa hàng Ngọc Linh Long Biên', daysSince: 30, revenue6m: '1980000' },
];

// ---------- Dữ liệu mẫu — góc nhìn Quản lý ----------

interface DayBar {
  label: string;
  value: number;
  partial?: boolean;
}

const SAMPLE_ORDERS_BY_DAY: DayBar[] = [
  { label: '17/08', value: 312 },
  { label: '18/08', value: 428 },
  { label: '19/08', value: 395 },
  { label: '20/08', value: 471 },
  { label: '21/08', value: 510 },
  { label: '22/08', value: 287 },
  { label: '23/08', value: 164, partial: true },
];

interface StatusCountRow {
  status: { tone: StatusTone; label: string };
  count: number;
  pct: number;
}

const SAMPLE_ORDERS_BY_STATUS: StatusCountRow[] = [
  { status: { tone: 'draft', label: 'Nháp' }, count: 38, pct: 10 },
  { status: { tone: 'warn', label: 'Chờ duyệt' }, count: 12, pct: 3 },
  { status: { tone: 'brand', label: 'Đã giữ hàng' }, count: 96, pct: 25 },
  { status: { tone: 'brand', label: 'Đang pick' }, count: 54, pct: 14 },
  { status: { tone: 'ok', label: 'Đã đóng gói' }, count: 41, pct: 10 },
  { status: { tone: 'ok', label: 'Đã giao ĐVVC' }, count: 118, pct: 31 },
  { status: { tone: 'err', label: 'Thiếu hàng' }, count: 9, pct: 2 },
  { status: { tone: 'neutral', label: 'Đã hủy' }, count: 6, pct: 1 },
];

interface ExceptionRow {
  type: string;
  detail: string;
  reporter: string;
  time: string;
}

const SAMPLE_EXCEPTIONS: ExceptionRow[] = [
  {
    type: 'Thiếu hàng tại vị trí',
    detail: 'A-03-02-B · TL08-BLUE thiếu 14',
    reporter: 'Trịnh Thị Mai',
    time: '10:05',
  },
  {
    type: 'Sai lô (FEFO)',
    detail: 'L2608 → quét L2610 · có lý do',
    reporter: 'Đinh Văn Phúc',
    time: '09:48',
  },
  {
    type: 'Hàng hỏng khi nhận',
    detail: 'GRN-2608-00087 dòng 3 · 2 thùng',
    reporter: 'Lương Thị Hoa',
    time: '09:30',
  },
  {
    type: 'Công nợ vượt hạn mức',
    detail: 'Nhà sách Phương Nam Q.1 · 52.000.000 / 50.000.000',
    reporter: 'Hệ thống',
    time: '09:12',
  },
  {
    type: 'Webhook thất bại',
    detail: 'GHN tạo vận đơn · retry 3/5',
    reporter: 'Hệ thống',
    time: '08:55',
  },
];

interface OverdueTaskRow {
  code: string;
  type: string;
  doc: string;
  worker: string;
  overdue: { tone: StatusTone; label: string };
}

const SAMPLE_OVERDUE_TASKS: OverdueTaskRow[] = [
  {
    code: 'TK-2608-00412',
    type: 'Pick',
    doc: 'SO-2608-01102',
    worker: 'Trịnh Thị Mai',
    overdue: { tone: 'err', label: '48 phút' },
  },
  {
    code: 'TK-2608-00407',
    type: 'Pick',
    doc: 'SO-2608-01098',
    worker: 'Đinh Văn Phúc',
    overdue: { tone: 'err', label: '35 phút' },
  },
  {
    code: 'TK-2608-00398',
    type: 'Cất',
    doc: 'GRN-2608-00087',
    worker: 'Cao Thị Yến',
    overdue: { tone: 'err', label: '22 phút' },
  },
  {
    code: 'TK-2608-00391',
    type: 'Đóng',
    doc: 'SO-2608-01090',
    worker: 'Trịnh Thị Mai',
    overdue: { tone: 'warn', label: '15 phút' },
  },
  {
    code: 'TK-2608-00388',
    type: 'Pick',
    doc: 'SO-2608-01084',
    worker: 'Chưa gán',
    overdue: { tone: 'warn', label: '12 phút' },
  },
  {
    code: 'TK-2608-00380',
    type: 'Nhận',
    doc: 'PO-2608-00031',
    worker: 'Lương Thị Hoa',
    overdue: { tone: 'warn', label: '9 phút' },
  },
];

const MAX_BAR_VALUE = Math.max(...SAMPLE_ORDERS_BY_DAY.map((d) => d.value));

const DENSE_HEAD = 'h-8 px-2.5 text-xs';
const DENSE_CELL = 'whitespace-nowrap px-2.5 py-1.5';

type ViewMode = 'sale' | 'manager';

export function DashboardScreen() {
  const [view, setView] = useState<ViewMode>('sale');

  return (
    <>
      <div className="mb-2 flex justify-end">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Góc nhìn:</span>
          {(
            [
              { key: 'sale', label: 'Sale' },
              { key: 'manager', label: 'Quản lý' },
            ] as { key: ViewMode; label: string }[]
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'flex h-7 items-center rounded-md border border-input bg-background px-2.5 text-sm',
                view === v.key && 'border-primary bg-secondary font-semibold text-primary',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'sale' ? <SaleView /> : <ManagerView />}
    </>
  );
}

function SaleView() {
  return (
    <>
      <PageHeader
        title="Chào An, hôm nay 23/08/2026"
        description="Khách hàng được phân: 38 · Team Sale Hà Nội · Leader: Trần Thị Bình"
        breadcrumb={[{ label: 'Tổng quan' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Users />
              Khách hàng của tôi
            </Button>
            <Button size="sm">
              <Plus />
              Tạo đơn
              <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                N
              </kbd>
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Đơn hôm nay" value="14" detail="Hôm qua 11 · giá trị 28.640.000" />
        <KpiCard
          label="Doanh thu tháng 08"
          value={formatMoney('412380000')}
          detail="Mục tiêu 500.000.000 · đạt 82%"
        />
        <KpiCard
          label="Đơn chờ duyệt của tôi"
          value={<span className="text-warning">2</span>}
          detail="Lâu nhất chờ 3 giờ 20 phút"
        />
        <KpiCard
          label="Công nợ quá hạn của KH tôi"
          value={<span className="text-destructive">{formatMoney('46200000')}</span>}
          detail="4 khách hàng · lâu nhất 38 ngày"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <div className="rounded-md border bg-card xl:col-span-3">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">
              Đơn cần xử lý <span className="font-normal text-muted-foreground">· 10</span>
            </span>
            <Link href="#" className="text-primary hover:underline">
              Xem tất cả đơn của tôi
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className={DENSE_HEAD}>Số đơn</TableHead>
                  <TableHead className={DENSE_HEAD}>Khách hàng</TableHead>
                  <TableHead className={cn(DENSE_HEAD, 'text-right')}>Giá trị</TableHead>
                  <TableHead className={DENSE_HEAD}>Trạng thái</TableHead>
                  <TableHead className={DENSE_HEAD}>Việc tiếp theo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_PENDING_ORDERS.map((o) => (
                  <TableRow key={o.code}>
                    <TableCell className={cn(DENSE_CELL, 'font-mono text-xs')}>
                      <Link href="#" className="text-primary hover:underline">
                        {o.code}
                      </Link>
                    </TableCell>
                    <TableCell className={cn(DENSE_CELL, 'max-w-56 truncate')}>
                      {o.customer}
                    </TableCell>
                    <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                      {formatMoney(o.total)}
                    </TableCell>
                    <TableCell className={DENSE_CELL}>
                      <StatusBadge tone={o.status.tone}>{o.status.label}</StatusBadge>
                    </TableCell>
                    <TableCell className={cn(DENSE_CELL, 'text-muted-foreground')}>
                      {o.nextStep}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-md border bg-card xl:col-span-2">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">
              KH lâu không mua{' '}
              <span className="font-normal text-muted-foreground">· ≥ 30 ngày</span>
            </span>
            <Link href="#" className="text-primary hover:underline">
              Xuất danh sách
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className={DENSE_HEAD}>Khách hàng</TableHead>
                  <TableHead className={cn(DENSE_HEAD, 'text-right')}>Từ lần cuối</TableHead>
                  <TableHead className={cn(DENSE_HEAD, 'text-right')}>DT 6 tháng</TableHead>
                  <TableHead className={DENSE_HEAD} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_INACTIVE_CUSTOMERS.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className={cn(DENSE_CELL, 'max-w-56 truncate')}>
                      <Link href="#" className="text-primary hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                      {c.daysSince} ngày
                    </TableCell>
                    <TableCell className={cn(DENSE_CELL, 'text-right tabular-nums')}>
                      {formatMoney(c.revenue6m)}
                    </TableCell>
                    <TableCell className={DENSE_CELL}>
                      <Link href="#" className="text-primary hover:underline">
                        Gọi lại
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">10 / 12 khách</div>
        </div>
      </div>
    </>
  );
}

function ManagerView() {
  return (
    <>
      <PageHeader
        title="Tổng quan vận hành"
        description="Cập nhật 10:14 · tự làm mới mỗi 60 giây"
        breadcrumb={[{ label: 'Tổng quan' }]}
        actions={
          <>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm"
            >
              Hôm nay 23/08/2026 <span className="text-muted-foreground">▾</span>
            </button>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm"
            >
              Tất cả kho <span className="text-muted-foreground">▾</span>
            </button>
            <Button variant="outline" size="sm">
              Xuất báo cáo
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Đơn hôm nay" value="164" detail="Cùng giờ hôm qua 151 · +8,6%" />
        <KpiCard
          label="Doanh thu tháng 08"
          value={formatMoney('6842150000')}
          detail="Mục tiêu 8.000.000.000 · 85%"
        />
        <KpiCard
          label="Đơn chờ duyệt"
          value={<span className="text-warning">12</span>}
          detail="3 đơn chờ quá 2 giờ"
        />
        <KpiCard
          label="Task kho quá hạn"
          value={<span className="text-destructive">6</span>}
          detail="Kho HN-1: 4 · Kho HCM-2: 2"
        />
        <KpiCard
          label="Công nợ quá hạn"
          value={<span className="text-destructive">{formatMoney('384600000')}</span>}
          detail="27 khách · 4 khách > 60 ngày"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
              <span className="font-semibold">Đơn theo ngày · 7 ngày</span>
              <span className="text-muted-foreground">hôm nay chưa hết ngày</span>
            </div>
            <div className="px-3 pb-6 pt-8">
              <div className="flex h-36 items-end gap-1.5">
                {SAMPLE_ORDERS_BY_DAY.map((d) => (
                  <div key={d.label} className="relative flex-1">
                    <div
                      className={cn(
                        'w-full rounded-t-sm',
                        d.partial ? 'bg-primary/40' : 'bg-primary',
                      )}
                      style={{ height: `${Math.round((d.value / MAX_BAR_VALUE) * 128)}px` }}
                    />
                    <span className="absolute bottom-full left-0 right-0 mb-0.5 text-center text-xs text-muted-foreground tabular-nums">
                      {d.value}
                    </span>
                    <span className="absolute left-0 right-0 top-full mt-1 text-center text-xs text-muted-foreground">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
              <span className="font-semibold">
                Ngoại lệ chưa xử lý <span className="font-normal text-muted-foreground">· 5</span>
              </span>
              <Link href="#" className="text-primary hover:underline">
                Tất cả
              </Link>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className={DENSE_HEAD}>Loại</TableHead>
                    <TableHead className={DENSE_HEAD}>Chi tiết</TableHead>
                    <TableHead className={DENSE_HEAD}>Báo bởi</TableHead>
                    <TableHead className={cn(DENSE_HEAD, 'text-right')}>Lúc</TableHead>
                    <TableHead className={DENSE_HEAD} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_EXCEPTIONS.map((e) => (
                    <TableRow key={e.time}>
                      <TableCell className={cn(DENSE_CELL, 'font-semibold')}>{e.type}</TableCell>
                      <TableCell className={cn(DENSE_CELL, 'max-w-64 truncate')}>
                        {e.detail}
                      </TableCell>
                      <TableCell className={DENSE_CELL}>{e.reporter}</TableCell>
                      <TableCell
                        className={cn(DENSE_CELL, 'text-right text-muted-foreground tabular-nums')}
                      >
                        {e.time}
                      </TableCell>
                      <TableCell className={DENSE_CELL}>
                        <Link href="#" className="text-primary hover:underline">
                          Xử lý
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card self-start">
          <div className="border-b px-3 py-2 text-sm font-semibold">
            Đơn theo trạng thái{' '}
            <span className="font-normal text-muted-foreground">· 374 đơn đang mở</span>
          </div>
          <div>
            {SAMPLE_ORDERS_BY_STATUS.map((s) => (
              <div
                key={s.status.label}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b px-3 py-1.5 text-sm last:border-0"
              >
                <span>
                  <StatusBadge tone={s.status.tone}>{s.status.label}</StatusBadge>
                </span>
                <span className="text-right font-semibold tabular-nums">{s.count}</span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-card self-start">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">
              Task kho quá hạn SLA <span className="font-normal text-muted-foreground">· 6</span>
            </span>
            <Link href="#" className="text-primary hover:underline">
              Mở điều phối
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className={DENSE_HEAD}>Task</TableHead>
                  <TableHead className={DENSE_HEAD}>Loại</TableHead>
                  <TableHead className={DENSE_HEAD}>Chứng từ</TableHead>
                  <TableHead className={DENSE_HEAD}>Nhân viên</TableHead>
                  <TableHead className={cn(DENSE_HEAD, 'text-right')}>Quá hạn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_OVERDUE_TASKS.map((t) => (
                  <TableRow key={t.code}>
                    <TableCell className={cn(DENSE_CELL, 'font-mono text-xs')}>
                      <Link href="#" className="text-primary hover:underline">
                        {t.code}
                      </Link>
                    </TableCell>
                    <TableCell className={DENSE_CELL}>{t.type}</TableCell>
                    <TableCell className={cn(DENSE_CELL, 'font-mono text-xs')}>{t.doc}</TableCell>
                    <TableCell className={DENSE_CELL}>{t.worker}</TableCell>
                    <TableCell className={cn(DENSE_CELL, 'text-right')}>
                      <StatusBadge tone={t.overdue.tone}>{t.overdue.label}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            SLA pick 30 phút · cất 45 phút · đóng gói 20 phút. Quá hạn &gt; 20 phút hiện đỏ.
          </div>
        </div>
      </div>
    </>
  );
}
