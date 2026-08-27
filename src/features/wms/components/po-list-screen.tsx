'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatMoney, formatQuantity } from '@/lib/format';

const qty = (n: number) => formatQuantity(String(n));

interface PoRow {
  docNo: string;
  supplier: string;
  warehouse: string;
  lineCount: number;
  qtyOrdered: number;
  qtyReceived: number;
  /** bậc tiến độ theo lớp tailwind w-* */
  progressClass: string;
  progressDone?: boolean;
  /** string decimal */
  value: string;
  status: string;
  statusTone: StatusTone;
  orderedAt: string;
  eta: string;
  createdBy: string;
}

const SAMPLE_POS: PoRow[] = [
  {
    docNo: 'PO-2608-00041',
    supplier: 'Công ty CP Tập đoàn Thiên Long',
    warehouse: 'Kho HN-1',
    lineCount: 3,
    qtyOrdered: 400,
    qtyReceived: 0,
    progressClass: 'w-0',
    value: '9000000',
    status: 'Đã gửi NCC',
    statusTone: 'brand',
    orderedAt: '23/08/2026',
    eta: '24/08',
    createdBy: 'Trần Văn Bảo',
  },
  {
    docNo: 'PO-2608-00040',
    supplier: 'Công ty TNHH Giấy Double A VN',
    warehouse: 'Kho HN-1',
    lineCount: 10,
    qtyOrdered: 797,
    qtyReceived: 0,
    progressClass: 'w-0',
    value: '10234567',
    status: 'Nháp',
    statusTone: 'draft',
    orderedAt: '22/08/2026',
    eta: '25/08',
    createdBy: 'Phạm Thị Hoa',
  },
  {
    docNo: 'PO-2608-00039',
    supplier: 'Tiến Phát Tape',
    warehouse: 'Kho HN-1',
    lineCount: 5,
    qtyOrdered: 1194,
    qtyReceived: 716,
    progressClass: 'w-7/12',
    value: '11469134',
    status: 'Nhận một phần',
    statusTone: 'warn',
    orderedAt: '21/08/2026',
    eta: '26/08',
    createdBy: 'Nguyễn Đức Thắng',
  },
  {
    docNo: 'PO-2608-00038',
    supplier: 'Deli Việt Nam',
    warehouse: 'Kho HN-1',
    lineCount: 12,
    qtyOrdered: 1591,
    qtyReceived: 477,
    progressClass: 'w-1/3',
    value: '12703701',
    status: 'Nhận một phần',
    statusTone: 'warn',
    orderedAt: '20/08/2026',
    eta: '27/08',
    createdBy: 'Hoàng Văn Long',
  },
  {
    docNo: 'PO-2608-00037',
    supplier: 'Plus Việt Nam',
    warehouse: 'Kho HN-1',
    lineCount: 7,
    qtyOrdered: 1988,
    qtyReceived: 1988,
    progressClass: 'w-full',
    progressDone: true,
    value: '13938268',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '19/08/2026',
    eta: '—',
    createdBy: 'Vũ Thị Lan',
  },
  {
    docNo: 'PO-2608-00036',
    supplier: 'Synnex FPT (HP)',
    warehouse: 'Kho HN-1',
    lineCount: 14,
    qtyOrdered: 2385,
    qtyReceived: 1431,
    progressClass: 'w-7/12',
    value: '15172835',
    status: 'Nhận một phần',
    statusTone: 'warn',
    orderedAt: '18/08/2026',
    eta: '24/08',
    createdBy: 'Trần Văn Bảo',
  },
  {
    docNo: 'PO-2608-00035',
    supplier: 'Kokuyo Việt Nam',
    warehouse: 'Kho HN-1',
    lineCount: 9,
    qtyOrdered: 2782,
    qtyReceived: 2782,
    progressClass: 'w-full',
    progressDone: true,
    value: '16407402',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '17/08/2026',
    eta: '—',
    createdBy: 'Phạm Thị Hoa',
  },
  {
    docNo: 'PO-2608-00034',
    supplier: 'Canon Marketing VN',
    warehouse: 'Kho HN-1',
    lineCount: 4,
    qtyOrdered: 3179,
    qtyReceived: 3179,
    progressClass: 'w-full',
    progressDone: true,
    value: '17641969',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '16/08/2026',
    eta: '—',
    createdBy: 'Nguyễn Đức Thắng',
  },
  {
    docNo: 'PO-2608-00033',
    supplier: 'Công ty CP Tập đoàn Thiên Long',
    warehouse: 'Kho HN-1',
    lineCount: 11,
    qtyOrdered: 3576,
    qtyReceived: 3576,
    progressClass: 'w-full',
    progressDone: true,
    value: '18876536',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '15/08/2026',
    eta: '—',
    createdBy: 'Hoàng Văn Long',
  },
  {
    docNo: 'PO-2608-00032',
    supplier: 'Công ty TNHH Giấy Double A VN',
    warehouse: 'Kho HN-1',
    lineCount: 6,
    qtyOrdered: 3973,
    qtyReceived: 3973,
    progressClass: 'w-full',
    progressDone: true,
    value: '20111103',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '14/08/2026',
    eta: '—',
    createdBy: 'Vũ Thị Lan',
  },
  {
    docNo: 'PO-2608-00024',
    supplier: 'Công ty TNHH Giấy Double A VN',
    warehouse: 'Kho HN-1',
    lineCount: 14,
    qtyOrdered: 2949,
    qtyReceived: 0,
    progressClass: 'w-0',
    value: '29987639',
    status: 'Hủy',
    statusTone: 'err',
    orderedAt: '06/08/2026',
    eta: '26/08',
    createdBy: 'Nguyễn Đức Thắng',
  },
  {
    docNo: 'PO-2608-00023',
    supplier: 'Tiến Phát Tape',
    warehouse: 'Kho HN-1',
    lineCount: 9,
    qtyOrdered: 3346,
    qtyReceived: 3346,
    progressClass: 'w-full',
    progressDone: true,
    value: '31222206',
    status: 'Đã nhận đủ',
    statusTone: 'ok',
    orderedAt: '05/08/2026',
    eta: '—',
    createdBy: 'Hoàng Văn Long',
  },
];

const TABS = [
  { label: 'Tất cả', count: '96', active: true },
  { label: 'Nháp', count: '3' },
  { label: 'Đã gửi NCC', count: '8' },
  { label: 'Nhận một phần', count: '6' },
  { label: 'Đã nhận đủ', count: '74' },
  { label: 'Hủy', count: '5' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

function FilterChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-background',
      )}
    >
      {children}
    </span>
  );
}

export function PoListScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Đơn mua hàng (PO)"
        description="Kho HN-1 · tháng 08/2026 · 6 PO đang chờ hàng về"
        breadcrumb={[{ label: 'Kho' }, { label: 'Đơn mua (PO)' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button variant="outline" size="sm">
              Từ đề xuất tồn thấp
            </Button>
            <Button size="sm">
              Tạo PO <Kbd>N</Kbd>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm số PO, nhà cung cấp…</span>
          <Kbd>/</Kbd>
        </div>
        <FilterChip active>
          Kho nhận: HN-1 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          NCC: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Ngày đặt: 01/08 – 23/08 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <Button variant="ghost" size="sm">
          + Lọc
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Đã lưu: <b className="font-semibold">Mặc định</b>
          </span>
          <span>Cột</span>
        </div>
      </div>

      <div className="flex border-b">
        {TABS.map((t) => (
          <span
            key={t.label}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm',
              t.active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {t.count}
            </span>
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" />
                </TableHead>
                <TableHead className="px-2.5 text-primary">Số PO ↓</TableHead>
                <TableHead className="px-2.5">Nhà cung cấp</TableHead>
                <TableHead className="px-2.5">Kho nhận</TableHead>
                <TableHead className="px-2.5 text-right">Số dòng</TableHead>
                <TableHead className="px-2.5 text-right">SL đặt</TableHead>
                <TableHead className="px-2.5 text-right">Đã nhận</TableHead>
                <TableHead className="px-2.5">Tiến độ</TableHead>
                <TableHead className="px-2.5 text-right">Giá trị</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5">Ngày đặt</TableHead>
                <TableHead className="px-2.5">Dự kiến về</TableHead>
                <TableHead className="px-2.5">Người tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_POS.map((r) => (
                <TableRow key={r.docNo}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Chọn ${r.docNo}`} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {r.docNo}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.supplier}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.warehouse}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(r.lineCount)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(r.qtyOrdered)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(r.qtyReceived)}
                  </TableCell>
                  <TableCell className="w-24 px-2.5 py-1.5">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full',
                          r.progressClass,
                          r.progressDone ? 'bg-success' : 'bg-primary',
                        )}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatMoney(r.value, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={r.statusTone}>{r.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.orderedAt}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.eta}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.createdBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 96</span>
          <span>· 40 dòng/trang</span>
          <span className="ml-auto">Trang 1 / 3</span>
        </div>
      </div>
    </div>
  );
}
