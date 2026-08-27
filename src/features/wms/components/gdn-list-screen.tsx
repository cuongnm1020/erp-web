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
import { formatQuantity } from '@/lib/format';

const qty = (n: number) => formatQuantity(String(n));

interface GdnRow {
  docNo: string;
  kind: string;
  kindTone: StatusTone;
  reference: string;
  destination: string;
  warehouse: string;
  lineCount: number;
  totalQty: number;
  status: string;
  statusTone: StatusTone;
  picker: string;
  createdAt: string;
}

const SAMPLE_GDNS: GdnRow[] = [
  {
    docNo: 'GDN-2608-01192',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01234',
    destination: 'Cửa hàng Minh Tâm',
    warehouse: 'Kho HN-1',
    lineCount: 2,
    totalQty: 40,
    status: 'Chờ pick',
    statusTone: 'warn',
    picker: '—',
    createdAt: '23/08/2026 08:00',
  },
  {
    docNo: 'GDN-2608-01191',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01233',
    destination: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    warehouse: 'Kho HN-1',
    lineCount: 9,
    totalQty: 213,
    status: 'Đang pick',
    statusTone: 'brand',
    picker: 'Phạm Thị Hoa',
    createdAt: '23/08/2026 13:23',
  },
  {
    docNo: 'GDN-2608-01190',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01232',
    destination: 'Nhà sách Phương Nam Q.1',
    warehouse: 'Kho HN-1',
    lineCount: 3,
    totalQty: 386,
    status: 'Đang pick',
    statusTone: 'brand',
    picker: 'Nguyễn Đức Thắng',
    createdAt: '23/08/2026 08:46',
  },
  {
    docNo: 'GDN-2608-01189',
    kind: 'Chuyển kho',
    kindTone: 'brand',
    reference: 'TRF-2608-00030',
    destination: 'Kho HCM-2',
    warehouse: 'Kho HN-1',
    lineCount: 10,
    totalQty: 559,
    status: 'Đã pick · chờ post',
    statusTone: 'draft',
    picker: 'Phạm Thị Hoa',
    createdAt: '23/08/2026 13:09',
  },
  {
    docNo: 'GDN-2608-01188',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01230',
    destination: 'Công ty CP Bảo Minh Office',
    warehouse: 'Kho HN-1',
    lineCount: 4,
    totalQty: 732,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Vũ Thị Lan',
    createdAt: '22/08/2026 08:32',
  },
  {
    docNo: 'GDN-2608-01187',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01229',
    destination: 'Nhà sách Tiến Thọ',
    warehouse: 'Kho HN-1',
    lineCount: 11,
    totalQty: 905,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Đỗ Quang Huy',
    createdAt: '22/08/2026 13:55',
  },
  {
    docNo: 'GDN-2608-01186',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01228',
    destination: 'Cửa hàng Minh Tâm',
    warehouse: 'Kho HN-1',
    lineCount: 5,
    totalQty: 178,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Trần Văn Bảo',
    createdAt: '22/08/2026 08:18',
  },
  {
    docNo: 'GDN-2608-01185',
    kind: 'Xuất khác',
    kindTone: 'brand',
    reference: '—',
    destination: '—',
    warehouse: 'Kho HN-1',
    lineCount: 12,
    totalQty: 351,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Phạm Thị Hoa',
    createdAt: '22/08/2026 13:41',
  },
  {
    docNo: 'GDN-2608-01184',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01226',
    destination: 'Nhà sách Phương Nam Q.1',
    warehouse: 'Kho HN-1',
    lineCount: 6,
    totalQty: 524,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Nguyễn Đức Thắng',
    createdAt: '21/08/2026 08:04',
  },
  {
    docNo: 'GDN-2608-01183',
    kind: 'Bán hàng',
    kindTone: 'neutral',
    reference: 'SO-2608-01225',
    destination: 'Văn phòng phẩm Thu Hằng',
    warehouse: 'Kho HN-1',
    lineCount: 13,
    totalQty: 697,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Hoàng Văn Long',
    createdAt: '21/08/2026 13:27',
  },
  {
    docNo: 'GDN-2608-01181',
    kind: 'Trả NCC',
    kindTone: 'brand',
    reference: '—',
    destination: 'Deli Việt Nam',
    warehouse: 'Kho HN-1',
    lineCount: 14,
    totalQty: 143,
    status: 'Đã post',
    statusTone: 'ok',
    picker: 'Đỗ Quang Huy',
    createdAt: '21/08/2026 13:13',
  },
  {
    docNo: 'GDN-2608-01177',
    kind: 'Chuyển kho',
    kindTone: 'brand',
    reference: 'TRF-2608-00026',
    destination: 'Kho HCM-2',
    warehouse: 'Kho HN-1',
    lineCount: 3,
    totalQty: 835,
    status: 'Hủy',
    statusTone: 'err',
    picker: 'Hoàng Văn Long',
    createdAt: '20/08/2026 13:45',
  },
];

const TABS = [
  { label: 'Tất cả', count: '1.192', active: true },
  { label: 'Chờ pick', count: '38' },
  { label: 'Đang pick', count: '14' },
  { label: 'Đã pick', count: '9' },
  { label: 'Đã post', count: '1.126' },
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

export function GdnListScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Phiếu xuất kho"
        description="Kho HN-1 · tháng 08/2026"
        breadcrumb={[{ label: 'Kho' }, { label: 'Xuất kho' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              Tạo phiếu xuất <Kbd>N</Kbd>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm số phiếu, đơn hàng, khách…</span>
          <Kbd>/</Kbd>
        </div>
        <FilterChip active>
          Kho: Kho HN-1 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Loại: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Ngày: 01/08 – 23/08 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
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
                <TableHead className="px-2.5 text-primary">Số phiếu ↓</TableHead>
                <TableHead className="px-2.5">Loại</TableHead>
                <TableHead className="px-2.5">Tham chiếu</TableHead>
                <TableHead className="px-2.5">Khách / đích đến</TableHead>
                <TableHead className="px-2.5">Kho</TableHead>
                <TableHead className="px-2.5 text-right">Số dòng</TableHead>
                <TableHead className="px-2.5 text-right">Tổng SL</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5">Người pick</TableHead>
                <TableHead className="px-2.5">Ngày</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_GDNS.map((r) => (
                <TableRow key={r.docNo}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Chọn ${r.docNo}`} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {r.docNo}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={r.kindTone}>{r.kind}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.destination}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.warehouse}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(r.lineCount)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(r.totalQty)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={r.statusTone}>{r.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.picker}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 1.192</span>
          <span>· 40 dòng/trang</span>
          <span className="ml-auto">Trang 1 / 30</span>
        </div>
      </div>
    </div>
  );
}
