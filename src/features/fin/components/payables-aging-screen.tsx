// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { ChevronDown, Printer, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/data/kpi-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

interface PayableRow {
  code: string;
  supplier: string;
  terms: string;
  current: string;
  b1: string;
  b2: string;
  b3: string;
  b4: string;
  total: string;
  nextDue: string;
  nextDueOverdue?: boolean;
  expanded?: boolean;
}

const SAMPLE_PAYABLES: PayableRow[] = [
  {
    code: 'NCC-0012',
    supplier: 'Công ty CP Tập đoàn Thiên Long',
    terms: 'Net 45',
    current: '384.200.000',
    b1: '96.400.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '480.600.000',
    nextDue: '29/08/2026',
    expanded: true,
  },
  {
    code: 'NCC-0003',
    supplier: 'Công ty TNHH Giấy Double A Việt Nam',
    terms: 'Net 60',
    current: '412.600.000',
    b1: '0',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '412.600.000',
    nextDue: '05/09/2026',
  },
  {
    code: 'NCC-0007',
    supplier: 'Công ty CP Giấy Sài Gòn',
    terms: 'Net 45',
    current: '218.400.000',
    b1: '84.300.000',
    b2: '42.100.000',
    b3: '0',
    b4: '0',
    total: '344.800.000',
    nextDue: '27/08/2026',
  },
  {
    code: 'NCC-0018',
    supplier: 'Công ty TNHH Văn phòng phẩm Deli VN',
    terms: 'Net 30',
    current: '146.200.000',
    b1: '78.500.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '224.700.000',
    nextDue: '26/08/2026',
  },
  {
    code: 'NCC-0025',
    supplier: 'Công ty TNHH Băng keo Tiến Phát',
    terms: 'Net 30',
    current: '96.800.000',
    b1: '52.200.000',
    b2: '28.700.000',
    b3: '0',
    b4: '0',
    total: '177.700.000',
    nextDue: '25/08/2026',
  },
  {
    code: 'NCC-0031',
    supplier: 'Công ty CP Mực in Toàn Cầu',
    terms: 'Net 15',
    current: '64.500.000',
    b1: '48.600.000',
    b2: '21.400.000',
    b3: '12.300.000',
    b4: '16.520.000',
    total: '163.320.000',
    nextDue: 'quá hạn',
    nextDueOverdue: true,
  },
  {
    code: 'NCC-0009',
    supplier: 'Công ty TNHH Sổ vở Klong',
    terms: 'Net 45',
    current: '88.100.000',
    b1: '24.800.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '112.900.000',
    nextDue: '02/09/2026',
  },
  {
    code: 'NCC-0002',
    supplier: 'Công ty CP Văn phòng phẩm Hồng Hà',
    terms: 'Net 45',
    current: '52.300.000',
    b1: '18.400.000',
    b2: '14.900.000',
    b3: '0',
    b4: '0',
    total: '85.600.000',
    nextDue: '28/08/2026',
  },
  {
    code: 'NCC-0044',
    supplier: 'Công ty TNHH Nhựa Duy Tân',
    terms: 'Net 30',
    current: '38.700.000',
    b1: '12.500.000',
    b2: '0',
    b3: '8.200.000',
    b4: '0',
    total: '59.400.000',
    nextDue: '30/08/2026',
  },
  {
    code: 'NCC-0051',
    supplier: 'Công ty TNHH Kokuyo Việt Nam',
    terms: 'Net 60',
    current: '21.400.000',
    b1: '0',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '21.400.000',
    nextDue: '15/09/2026',
  },
  {
    code: 'NCC-0063',
    supplier: 'Hộ kinh doanh Bao bì Phú Xuân',
    terms: 'Thanh toán ngay',
    current: '0',
    b1: '6.000.000',
    b2: '0',
    b3: '3.800.000',
    b4: '11.900.000',
    total: '21.700.000',
    nextDue: 'quá hạn',
    nextDueOverdue: true,
  },
  {
    code: 'NCC-0058',
    supplier: 'Công ty CP In Hồng Đăng',
    terms: 'Net 30',
    current: '12.400.000',
    b1: '0',
    b2: '4.100.000',
    b3: '0',
    b4: '0',
    total: '16.500.000',
    nextDue: '31/08/2026',
  },
  {
    code: 'NCC-0070',
    supplier: 'Công ty TNHH Máy văn phòng Nam Á',
    terms: 'Net 15',
    current: '6.700.000',
    b1: '0',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '6.700.000',
    nextDue: '29/08/2026',
  },
];

interface SupplierDocRow {
  doc: string;
  grn: string;
  invoiceDate: string;
  dueDate: string;
  overdue: string | null;
  total: string;
  paid: string;
  remaining: string;
  actionExtra?: string;
}

const SAMPLE_SUPPLIER_DOCS: SupplierDocRow[] = [
  {
    doc: 'TL-HD-260712',
    grn: 'GRN-2607-00061',
    invoiceDate: '12/07/2026',
    dueDate: '26/08/2026',
    overdue: null,
    total: '186.500.000',
    paid: '0',
    remaining: '186.500.000',
  },
  {
    doc: 'TL-HD-260725',
    grn: 'GRN-2607-00078',
    invoiceDate: '25/07/2026',
    dueDate: '08/09/2026',
    overdue: null,
    total: '121.300.000',
    paid: '0',
    remaining: '121.300.000',
  },
  {
    doc: 'TL-HD-260808',
    grn: 'GRN-2608-00087',
    invoiceDate: '08/08/2026',
    dueDate: '22/09/2026',
    overdue: null,
    total: '76.400.000',
    paid: '0',
    remaining: '76.400.000',
  },
  {
    doc: 'TL-HD-260618',
    grn: 'GRN-2606-00042',
    invoiceDate: '18/06/2026',
    dueDate: '02/08/2026',
    overdue: '21 ngày',
    total: '142.800.000',
    paid: '46.400.000',
    remaining: '96.400.000',
    actionExtra: 'đang đối chiếu',
  },
];

export function PayablesAgingScreen() {
  return (
    <>
      <PageHeader
        title="Công nợ phải trả NCC theo tuổi nợ"
        description="Chốt số đến hết ngày 23/08/2026 · 38 nhà cung cấp còn nợ · NCC không áp data scope"
        breadcrumb={[{ label: 'Tài chính' }, { label: 'Công nợ phải trả' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> In báo cáo
            </Button>
            <Button variant="outline" size="sm">
              Xuất XLSX
            </Button>
            <Button size="sm">Lập kế hoạch chi</Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Tổng phải trả" value="2.148.920.000" detail="38 nhà cung cấp" />
        <KpiCard label="Chưa đến hạn" value="1.542.300.000" detail="71,8%" />
        <KpiCard
          label="Quá hạn 1–30"
          value={<span className="text-warning">421.700.000</span>}
          detail="19,6%"
        />
        <KpiCard
          label="Quá hạn 31–90"
          value={<span className="text-warning">156.500.000</span>}
          detail="7,3%"
        />
        <KpiCard
          label="Quá hạn > 90"
          value={<span className="text-destructive">28.420.000</span>}
          detail="1,3% · 2 NCC"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm nhà cung cấp, mã NCC…
        </div>
        <FilterChip>Nhóm hàng</FilterChip>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
          Chỉ có quá hạn <X className="size-3 opacity-70" />
        </span>
        <span className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
          Đến hạn trong 7 ngày
        </span>
        <FilterChip>Ngày chốt: 23/08/2026</FilterChip>
        <div className="ml-auto text-xs text-muted-foreground">
          Sắp xếp: <span className="font-semibold text-foreground">Tổng nợ giảm dần</span>{' '}
          <ChevronDown className="inline size-3" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-7 px-2.5" />
              <TableHead className="px-2.5">Nhà cung cấp</TableHead>
              <TableHead className="px-2.5">Điều khoản</TableHead>
              <TableHead className="px-2.5 text-right">Chưa đến hạn</TableHead>
              <TableHead className="px-2.5 text-right">1–30 ngày</TableHead>
              <TableHead className="px-2.5 text-right">31–60 ngày</TableHead>
              <TableHead className="px-2.5 text-right">61–90 ngày</TableHead>
              <TableHead className="px-2.5 text-right">&gt; 90 ngày</TableHead>
              <TableHead className="px-2.5 text-right">Tổng nợ ▼</TableHead>
              <TableHead className="px-2.5">Kỳ chi tới</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_PAYABLES.map((r) => (
              <PayableRowGroup key={r.code} row={r} />
            ))}
            <TableRow className="bg-muted font-semibold hover:bg-muted">
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5">Tổng (38 NCC)</TableCell>
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">1.542.300.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">421.700.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">111.200.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">45.300.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">28.420.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">2.148.920.000</TableCell>
              <TableCell className="px-2.5 py-1.5" />
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–13 / 38 NCC</span>
          <span>
            · Nhấn dòng để xem hóa đơn NCC · công nợ tăng khi phiếu nhập post, giảm khi phiếu chi
            post
          </span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>2</PagerButton>
            <PagerButton>3</PagerButton>
            <PagerButton>›</PagerButton>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: Supplier không có data scope (khác Customer) — mọi kế toán thấy như nhau. Cùng
          khung màu tuổi nợ với màn Phải thu để đọc chéo hai báo cáo không phải học lại.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: &quot;Kỳ chi tới&quot; lấy từ hạn TT gần nhất còn nợ; NCC có nợ &gt;90 ngày hiện
          &quot;quá hạn&quot; đỏ.
        </div>
      </div>
    </>
  );
}

function PayableRowGroup({ row }: { row: PayableRow }) {
  return (
    <>
      <TableRow className={cn(row.expanded && 'bg-secondary hover:bg-secondary')}>
        <TableCell className="px-2.5 py-1.5 text-muted-foreground">
          {row.expanded ? '▾' : '▸'}
        </TableCell>
        <TableCell className="px-2.5 py-1.5 font-semibold">
          {row.supplier}{' '}
          <span className="font-mono text-xs font-normal text-muted-foreground">{row.code}</span>
        </TableCell>
        <TableCell className="whitespace-nowrap px-2.5 py-1.5">{row.terms}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.current}</TableCell>
        <BucketCell value={row.b1} tone="warn" />
        <BucketCell value={row.b2} tone="warn" />
        <BucketCell value={row.b3} tone="warn" />
        <BucketCell value={row.b4} tone="err" />
        <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
          {row.total}
        </TableCell>
        <TableCell
          className={cn(
            'whitespace-nowrap px-2.5 py-1.5 tabular-nums',
            row.nextDueOverdue && 'font-semibold text-destructive',
          )}
        >
          {row.nextDue}
        </TableCell>
      </TableRow>
      {row.expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="bg-muted/50 p-0">
            <div className="overflow-x-auto py-1 pl-7 pr-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 px-2.5 text-xs">Chứng từ NCC</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Phiếu nhập</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Ngày HĐ</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Hạn TT</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Quá hạn</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Tổng HĐ</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Đã trả</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Còn phải trả</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_SUPPLIER_DOCS.map((d) => (
                    <TableRow key={d.doc} className="hover:bg-transparent">
                      <TableCell className="px-2.5 py-1.5">
                        <span className="font-mono text-xs text-primary">{d.doc}</span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                        {d.grn}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">
                        {d.invoiceDate}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">
                        {d.dueDate}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'px-2.5 py-1.5 text-right',
                          d.overdue ? 'font-semibold text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {d.overdue ?? '—'}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {d.total}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {d.paid}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                        {d.remaining}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                        <span className="text-primary">Lập chi</span>
                        {d.actionExtra ? (
                          <span className="text-muted-foreground"> · {d.actionExtra}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function BucketCell({ value, tone }: { value: string; tone: 'warn' | 'err' }) {
  const zero = value === '0';
  return (
    <TableCell
      className={cn(
        'px-2.5 py-1.5 text-right tabular-nums',
        zero
          ? 'text-muted-foreground'
          : tone === 'err'
            ? 'font-semibold text-destructive'
            : 'text-warning',
      )}
    >
      {value}
    </TableCell>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-sm">
      {children}
      <ChevronDown className="size-3 text-muted-foreground" />
    </span>
  );
}

function PagerButton({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border px-1.5',
        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
      )}
    >
      {children}
    </span>
  );
}
