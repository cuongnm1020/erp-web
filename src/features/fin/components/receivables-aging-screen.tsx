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

interface AgingRow {
  code: string;
  customer: string;
  sale: string;
  current: string;
  b1: string;
  b2: string;
  b3: string;
  b4: string;
  total: string;
  creditLimit: string;
  overLimit?: boolean;
  expanded?: boolean;
}

const SAMPLE_AGING: AgingRow[] = [
  {
    code: 'KH-000317',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    sale: 'Nguyễn Văn An',
    current: '54.670.000',
    b1: '10.000.000',
    b2: '21.750.000',
    b3: '0',
    b4: '0',
    total: '86.420.000',
    creditLimit: '150.000.000',
    expanded: true,
  },
  {
    code: 'KH-001208',
    customer: 'Nhà sách Phương Nam Q.1',
    sale: 'Bùi Thanh Tùng',
    current: '64.120.000',
    b1: '18.240.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '82.360.000',
    creditLimit: '200.000.000',
  },
  {
    code: 'KH-000455',
    customer: 'Công ty CP In & Bao bì Sao Mai',
    sale: 'Hoàng Đức Long',
    current: '43.300.000',
    b1: '12.800.000',
    b2: '8.400.000',
    b3: '6.200.000',
    b4: '0',
    total: '70.700.000',
    creditLimit: '100.000.000',
  },
  {
    code: 'KH-000689',
    customer: 'Công ty TNHH Thương mại Đại Phát',
    sale: 'Trịnh Văn Sơn',
    current: '16.200.000',
    b1: '22.150.000',
    b2: '0',
    b3: '9.800.000',
    b4: '14.520.000',
    total: '62.670.000',
    creditLimit: '60.000.000',
    overLimit: true,
  },
  {
    code: 'KH-001766',
    customer: 'Trường Tiểu học Lê Quý Đôn',
    sale: 'Đỗ Kim Ngân',
    current: '14.500.000',
    b1: '21.400.000',
    b2: '12.600.000',
    b3: '0',
    b4: '0',
    total: '48.500.000',
    creditLimit: '80.000.000',
  },
  {
    code: 'KH-004512',
    customer: 'Cửa hàng Minh Tâm',
    sale: 'Nguyễn Văn An',
    current: '7.470.000',
    b1: '4.930.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '12.400.000',
    creditLimit: '50.000.000',
  },
  {
    code: 'KH-002981',
    customer: 'Văn phòng phẩm Thu Hà (Cầu Giấy)',
    sale: 'Phạm Thu Hà',
    current: '6.190.000',
    b1: '0',
    b2: '5.230.000',
    b3: '0',
    b4: '0',
    total: '11.420.000',
    creditLimit: '30.000.000',
  },
  {
    code: 'KH-001420',
    customer: 'Nhà sách Tân Định',
    sale: 'Ngô Thị Lan',
    current: '12.700.000',
    b1: '6.920.000',
    b2: '0',
    b3: '0',
    b4: '8.150.000',
    total: '27.770.000',
    creditLimit: '60.000.000',
  },
  {
    code: 'KH-002204',
    customer: 'Công ty CP Xây dựng Hưng Thịnh',
    sale: 'Mai Anh Tuấn',
    current: '7.300.000',
    b1: '9.400.000',
    b2: '4.800.000',
    b3: '0',
    b4: '11.900.000',
    total: '33.400.000',
    creditLimit: '40.000.000',
  },
  {
    code: 'KH-003318',
    customer: 'Trung tâm Anh ngữ Bright Star',
    sale: 'Lý Hải Yến',
    current: '3.420.000',
    b1: '5.100.000',
    b2: '0',
    b3: '2.760.000',
    b4: '0',
    total: '11.280.000',
    creditLimit: '20.000.000',
  },
  {
    code: 'KH-003725',
    customer: 'Cửa hàng VPP Hồng Hạnh',
    sale: 'Vũ Ngọc Mai',
    current: '4.980.000',
    b1: '2.140.000',
    b2: '1.760.000',
    b3: '0',
    b4: '0',
    total: '8.880.000',
    creditLimit: '20.000.000',
  },
  {
    code: 'KH-002873',
    customer: 'Công ty TNHH Dịch vụ Kế toán An Tâm',
    sale: 'Võ Thị Hồng',
    current: '2.760.000',
    b1: '3.850.000',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '6.610.000',
    creditLimit: '15.000.000',
  },
  {
    code: 'KH-001987',
    customer: 'Trường THCS Nguyễn Du',
    sale: 'Lê Minh Châu',
    current: '8.450.000',
    b1: '0',
    b2: '0',
    b3: '0',
    b4: '0',
    total: '8.450.000',
    creditLimit: '30.000.000',
  },
  {
    code: 'KH-002550',
    customer: 'Công ty TNHH Nội thất Văn phòng Á Châu',
    sale: 'Đặng Quang Huy',
    current: '15.900.000',
    b1: '7.300.000',
    b2: '3.100.000',
    b3: '0',
    b4: '7.850.000',
    total: '34.150.000',
    creditLimit: '50.000.000',
  },
];

interface DrillRow {
  invoice: string;
  invoiceExtra?: string;
  order: string;
  invoiceDate: string;
  dueDate: string;
  overdue: string | null;
  overdueSevere?: boolean;
  total: string;
  paid: string;
  remaining: string;
  actions: string[];
}

const SAMPLE_DRILL: DrillRow[] = [
  {
    invoice: 'INV-2606-00412',
    order: 'SO-2606-00871',
    invoiceDate: '18/06/2026',
    dueDate: '18/07/2026',
    overdue: '37 ngày',
    overdueSevere: true,
    total: '12.400.000',
    paid: '0',
    remaining: '12.400.000',
    actions: ['Thu tiền', 'Nhắc nợ'],
  },
  {
    invoice: 'INV-2606-00588',
    order: 'SO-2606-01204',
    invoiceDate: '27/06/2026',
    dueDate: '27/07/2026',
    overdue: '28 ngày',
    overdueSevere: true,
    total: '8.950.000',
    paid: '0',
    remaining: '8.950.000',
    actions: ['Thu tiền', 'Nhắc nợ'],
  },
  {
    invoice: 'INV-2607-00103',
    order: 'SO-2607-00092',
    invoiceDate: '04/07/2026',
    dueDate: '03/08/2026',
    overdue: '21 ngày',
    total: '10.400.000',
    paid: '0',
    remaining: '10.400.000',
    actions: ['Thu tiền', 'Nhắc nợ'],
  },
  {
    invoice: 'INV-2607-00455',
    order: 'SO-2607-00517',
    invoiceDate: '16/07/2026',
    dueDate: '15/08/2026',
    overdue: '9 ngày',
    total: '15.000.000',
    paid: '5.000.000',
    remaining: '10.000.000',
    actions: ['Thu tiền', 'Nhắc nợ'],
  },
  {
    invoice: 'INV-2607-00790',
    order: 'SO-2607-00918',
    invoiceDate: '28/07/2026',
    dueDate: '27/08/2026',
    overdue: null,
    total: '6.120.000',
    paid: '0',
    remaining: '6.120.000',
    actions: ['Thu tiền'],
  },
  {
    invoice: 'INV-2608-00112',
    invoiceExtra: '+ 4 hóa đơn nữa chưa đến hạn',
    order: '…',
    invoiceDate: '05–22/08/2026',
    dueDate: '04–21/09/2026',
    overdue: null,
    total: '51.930.000',
    paid: '3.380.000',
    remaining: '48.550.000',
    actions: ['Xem tất cả'],
  },
];

export function ReceivablesAgingScreen() {
  return (
    <>
      <PageHeader
        title="Công nợ phải thu theo tuổi nợ"
        description="Chốt số đến hết ngày 23/08/2026 · 214 KH còn nợ · dữ liệu theo scope của kế toán (toàn bộ)"
        breadcrumb={[{ label: 'Tài chính' }, { label: 'Công nợ phải thu' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> In báo cáo
            </Button>
            <Button variant="outline" size="sm">
              Xuất XLSX
            </Button>
            <Button size="sm">Gửi nhắc nợ hàng loạt</Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Tổng phải thu" value="1.284.630.000" detail="214 khách hàng" />
        <KpiCard label="Chưa đến hạn" value="812.410.000" detail="63,2%" />
        <KpiCard
          label="Quá hạn 1–30"
          value={<span className="text-warning">301.560.000</span>}
          detail="23,5%"
        />
        <KpiCard
          label="Quá hạn 31–90"
          value={<span className="text-warning">128.240.000</span>}
          detail="10,0%"
        />
        <KpiCard
          label="Quá hạn > 90"
          value={<span className="text-destructive">42.420.000</span>}
          detail="3,3% · 9 KH"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm khách hàng, mã KH…
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
          Team: Sale Hà Nội <X className="size-3 opacity-70" />
        </span>
        <FilterChip>Sale: Tất cả</FilterChip>
        <span className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
          Chỉ có quá hạn
        </span>
        <FilterChip>Ngày chốt: 23/08/2026</FilterChip>
        <div className="ml-auto text-xs text-muted-foreground">
          Sắp xếp: <span className="font-semibold text-foreground">Quá hạn &gt;90 giảm dần</span>{' '}
          <ChevronDown className="inline size-3" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-7 px-2.5" />
              <TableHead className="px-2.5">Khách hàng</TableHead>
              <TableHead className="px-2.5">Sale phụ trách</TableHead>
              <TableHead className="px-2.5 text-right">Chưa đến hạn</TableHead>
              <TableHead className="px-2.5 text-right">1–30 ngày</TableHead>
              <TableHead className="px-2.5 text-right">31–60 ngày</TableHead>
              <TableHead className="px-2.5 text-right">61–90 ngày</TableHead>
              <TableHead className="px-2.5 text-right">&gt; 90 ngày ▼</TableHead>
              <TableHead className="px-2.5 text-right">Tổng nợ</TableHead>
              <TableHead className="px-2.5 text-right">Hạn mức</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_AGING.map((r) => (
              <AgingRowGroup key={r.code} row={r} />
            ))}
            <TableRow className="bg-muted font-semibold hover:bg-muted">
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5">Tổng (214 KH)</TableCell>
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">812.410.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">301.560.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">86.140.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">42.100.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">42.420.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">1.284.630.000</TableCell>
              <TableCell className="px-2.5 py-1.5" />
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–15 / 214 KH</span>
          <span>
            · Nhấn dòng để mở chi tiết hóa đơn · tuổi nợ tính theo hạn thanh toán từng hóa đơn
          </span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>2</PagerButton>
            <PagerButton>3</PagerButton>
            <PagerButton>…</PagerButton>
            <PagerButton>15</PagerButton>
            <PagerButton>›</PagerButton>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: dòng Đại Phát có nợ &gt;90 ngày và vượt hạn mức — cột Hạn mức chuyển đỏ. Đơn mới
          của KH này sẽ cảnh báo ở màn tạo đơn.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: kế toán thấy toàn bộ; sale leader mở màn này chỉ thấy KH thuộc team mình (scope
          áp ở server, không phải ẩn cột).
        </div>
      </div>
    </>
  );
}

function AgingRowGroup({ row }: { row: AgingRow }) {
  return (
    <>
      <TableRow className={cn(row.expanded && 'bg-secondary hover:bg-secondary')}>
        <TableCell className="px-2.5 py-1.5 text-muted-foreground">
          {row.expanded ? '▾' : '▸'}
        </TableCell>
        <TableCell className="px-2.5 py-1.5 font-semibold">
          {row.customer}{' '}
          <span className="font-mono text-xs font-normal text-muted-foreground">{row.code}</span>
        </TableCell>
        <TableCell className="whitespace-nowrap px-2.5 py-1.5">{row.sale}</TableCell>
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
            'px-2.5 py-1.5 text-right tabular-nums',
            row.overLimit ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {row.creditLimit}
        </TableCell>
      </TableRow>
      {row.expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="bg-muted/50 p-0">
            <div className="overflow-x-auto py-1 pl-7 pr-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 px-2.5 text-xs">Hóa đơn</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Đơn hàng</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Ngày HĐ</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Hạn TT</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Quá hạn</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Tổng HĐ</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Đã thu</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Còn nợ</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_DRILL.map((d) => (
                    <TableRow key={d.invoice} className="hover:bg-transparent">
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                        <span className="font-mono text-xs text-primary">{d.invoice}</span>
                        {d.invoiceExtra ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {d.invoiceExtra}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                        {d.order}
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
                          d.overdue
                            ? d.overdueSevere
                              ? 'font-semibold text-destructive'
                              : 'font-semibold text-warning'
                            : 'text-muted-foreground',
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
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5 text-primary">
                        {d.actions.join(' · ')}
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
