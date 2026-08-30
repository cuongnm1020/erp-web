// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import Link from 'next/link';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
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
import { toast } from '@/components/ui/toaster';
import { RowActions } from '@/components/data/row-actions';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';

interface InvoiceRow {
  invoiceNo: string | null;
  orderNo: string;
  customer: string;
  date: string;
  /** Số tiền hiển thị dạng chuỗi đã nhóm nghìn (dữ liệu mẫu tĩnh). */
  subtotal: string;
  total: string;
  cancelled?: boolean;
  status: { tone: StatusTone; label: string };
  /** Mã CQT, hoặc lý do từ chối khi status = CQT từ chối. */
  taxCode: string | null;
  taxCodeIsReason?: boolean;
  sale: string;
}

const SAMPLE_INVOICES: InvoiceRow[] = [
  {
    invoiceNo: null,
    orderNo: 'SO-2608-01244',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    date: '24/08/2026',
    subtotal: '4.620.000',
    total: '4.620.000',
    status: { tone: 'draft', label: 'Nháp' },
    taxCode: null,
    sale: 'Nguyễn Văn An',
  },
  {
    invoiceNo: null,
    orderNo: 'SO-2608-01243',
    customer: 'Nhà sách Phương Nam Q.1',
    date: '24/08/2026',
    subtotal: '12.380.000',
    total: '12.380.000',
    status: { tone: 'draft', label: 'Nháp' },
    taxCode: null,
    sale: 'Bùi Thanh Tùng',
  },
  {
    invoiceNo: null,
    orderNo: 'SO-2608-01241',
    customer: 'Cửa hàng Minh Tâm',
    date: '24/08/2026',
    subtotal: '1.596.400',
    total: '1.596.400',
    status: { tone: 'draft', label: 'Nháp' },
    taxCode: null,
    sale: 'Nguyễn Văn An',
  },
  {
    invoiceNo: 'INV-2608-00431',
    orderNo: 'SO-2608-01238',
    customer: 'Trường THCS Nguyễn Du',
    date: '23/08/2026',
    subtotal: '8.450.000',
    total: '8.450.000',
    status: { tone: 'err', label: 'CQT từ chối' },
    taxCode: 'Sai MST người mua',
    taxCodeIsReason: true,
    sale: 'Lê Minh Châu',
  },
  {
    invoiceNo: 'INV-2608-00430',
    orderNo: 'SO-2608-01236',
    customer: 'Văn phòng phẩm Thu Hà (Cầu Giấy)',
    date: '23/08/2026',
    subtotal: '2.140.000',
    total: '2.140.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00918',
    sale: 'Phạm Thu Hà',
  },
  {
    invoiceNo: 'INV-2608-00429',
    orderNo: 'SO-2608-01234',
    customer: 'Công ty CP In & Bao bì Sao Mai',
    date: '23/08/2026',
    subtotal: '24.900.000',
    total: '24.900.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00917',
    sale: 'Hoàng Đức Long',
  },
  {
    invoiceNo: 'INV-2608-00428',
    orderNo: 'SO-2608-01230',
    customer: 'Nhà sách Tân Định',
    date: '23/08/2026',
    subtotal: '5.780.000',
    total: '5.780.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00916',
    sale: 'Ngô Thị Lan',
  },
  {
    invoiceNo: 'INV-2608-00426',
    orderNo: 'SO-2608-01225',
    customer: 'Công ty TNHH Thương mại Đại Phát',
    date: '22/08/2026',
    subtotal: '16.200.000',
    total: '16.200.000',
    status: { tone: 'warn', label: 'Thay thế' },
    taxCode: 'M1-26-7K3HA-00914',
    sale: 'Trịnh Văn Sơn',
  },
  {
    invoiceNo: 'INV-2608-00425',
    orderNo: 'SO-2608-01225',
    customer: 'Công ty TNHH Thương mại Đại Phát',
    date: '22/08/2026',
    subtotal: '16.020.000',
    total: '16.020.000',
    cancelled: true,
    status: { tone: 'neutral', label: 'Đã hủy' },
    taxCode: 'M1-26-7K3HA-00909',
    sale: 'Trịnh Văn Sơn',
  },
  {
    invoiceNo: 'INV-2608-00424',
    orderNo: 'SO-2608-01222',
    customer: 'Cửa hàng Minh Tâm',
    date: '22/08/2026',
    subtotal: '2.698.000',
    total: '2.698.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00913',
    sale: 'Nguyễn Văn An',
  },
  {
    invoiceNo: 'INV-2608-00422',
    orderNo: 'SO-2608-01215',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    date: '22/08/2026',
    subtotal: '31.750.000',
    total: '31.750.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00911',
    sale: 'Nguyễn Văn An',
  },
  {
    invoiceNo: 'INV-2608-00420',
    orderNo: 'SO-2608-01208',
    customer: 'Cửa hàng Văn phòng phẩm Ngọc Bích',
    date: '21/08/2026',
    subtotal: '1.240.000',
    total: '1.240.000',
    status: { tone: 'err', label: 'CQT từ chối' },
    taxCode: 'Trùng số hóa đơn',
    taxCodeIsReason: true,
    sale: 'Phan Gia Bảo',
  },
  {
    invoiceNo: 'INV-2608-00418',
    orderNo: 'SO-2608-01201',
    customer: 'Trường Tiểu học Lê Quý Đôn',
    date: '21/08/2026',
    subtotal: '14.500.000',
    total: '14.500.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00907',
    sale: 'Đỗ Kim Ngân',
  },
  {
    invoiceNo: 'INV-2608-00414',
    orderNo: 'SO-2608-01187',
    customer: 'Cửa hàng Minh Tâm',
    date: '19/08/2026',
    subtotal: '1.596.400',
    total: '1.596.400',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00903',
    sale: 'Nguyễn Văn An',
  },
  {
    invoiceNo: 'INV-2608-00412',
    orderNo: 'SO-2608-01179',
    customer: 'Công ty CP In & Bao bì Sao Mai',
    date: '19/08/2026',
    subtotal: '18.400.000',
    total: '18.400.000',
    status: { tone: 'ok', label: 'Đã phát hành' },
    taxCode: 'M1-26-7K3HA-00901',
    sale: 'Hoàng Đức Long',
  },
];

const TABS = [
  { label: 'Tất cả', count: '1.284', active: true },
  { label: 'Nháp', count: '38' },
  { label: 'Đã phát hành', count: '1.198' },
  { label: 'CQT từ chối', count: '3' },
  { label: 'Đã hủy', count: '29' },
  { label: 'Thay thế', count: '16' },
];

export function InvoiceListScreen() {
  return (
    <>
      <PageHeader
        title="Hóa đơn"
        description="Tháng 08/2026 · 1.284 hóa đơn · 38 nháp chờ phát hành · 3 bị CQT từ chối"
        breadcrumb={[{ label: 'Tài chính' }, { label: 'Hóa đơn' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Đồng bộ CQT
            </Button>
            <Button variant="outline" size="sm">
              Xuất XML/CSV
            </Button>
            <Button size="sm">
              Phát hành hàng loạt
              <span className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                38
              </span>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm số HĐ, số đơn, KH, MST…
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
          Ngày: 01/08 – 24/08/2026 <X className="size-3 opacity-70" />
        </span>
        <FilterChip>Trạng thái</FilterChip>
        <FilterChip>Team / sale</FilterChip>
        <FilterChip>Ký hiệu: 1C26TAA</FilterChip>
        <Button variant="ghost" size="sm" className="h-7 px-2 font-normal text-muted-foreground">
          <Plus className="size-3.5" /> Lọc
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Đã lưu: <span className="font-semibold text-foreground">Tháng này</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5">
            Cột <ChevronDown className="size-3" />
          </span>
        </div>
      </div>

      <div className="mb-3 flex h-9 border-b">
        {TABS.map((t) => (
          <span
            key={t.label}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm',
              t.active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
              {t.count}
            </span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-8 px-2.5">
                <Checkbox aria-label="Chọn tất cả" />
              </TableHead>
              <TableHead className="px-2.5">Số HĐ</TableHead>
              <TableHead className="px-2.5">Đơn hàng</TableHead>
              <TableHead className="px-2.5">Khách hàng</TableHead>
              <TableHead className="px-2.5">Ngày ▼</TableHead>
              <TableHead className="px-2.5 text-right">Trước thuế</TableHead>
              <TableHead className="px-2.5 text-right">Thuế</TableHead>
              <TableHead className="px-2.5 text-right">Tổng</TableHead>
              <TableHead className="px-2.5">Trạng thái</TableHead>
              <TableHead className="px-2.5">Mã CQT</TableHead>
              <TableHead className="px-2.5">Sale</TableHead>
              <TableHead className="w-20 px-2.5">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_INVOICES.map((r, i) => (
              <TableRow key={`${r.orderNo}-${i}`}>
                <TableCell className="px-2.5 py-1.5">
                  <Checkbox aria-label={`Chọn ${r.invoiceNo ?? r.orderNo}`} />
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {r.invoiceNo ? (
                    <Link
                      href={`/fin/invoices/${r.invoiceNo}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {r.invoiceNo}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">(tự động)</span>
                  )}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <span className="font-mono text-xs text-primary">{r.orderNo}</span>
                </TableCell>
                <TableCell className="max-w-72 truncate px-2.5 py-1.5">{r.customer}</TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">{r.date}</TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 text-right tabular-nums',
                    r.cancelled && 'text-muted-foreground',
                  )}
                >
                  {r.subtotal}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 text-right tabular-nums',
                    r.cancelled ? 'text-muted-foreground' : 'font-semibold',
                  )}
                >
                  {r.total}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {r.taxCode === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : r.taxCodeIsReason ? (
                    <span className="text-muted-foreground">{r.taxCode}</span>
                  ) : (
                    <span
                      className={cn('font-mono text-xs', r.cancelled && 'text-muted-foreground')}
                    >
                      {r.taxCode}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap px-2.5 py-1.5">{r.sale}</TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {/* HĐ đã phát hành là bất biến (sửa = thay thế/hủy) — chỉ nháp mới sửa/xóa được */}
                  {r.status.label === 'Nháp' ? (
                    <RowActions
                      editHref={`/fin/invoices/${r.orderNo}`}
                      onDelete={() => toast.success(`Đã xóa hóa đơn nháp ${r.orderNo} (mẫu)`)}
                      deleteLabel="Xóa nháp"
                      itemName={`hóa đơn nháp của đơn ${r.orderNo}`}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–23 / 1.284</span>
          <span>· Cột Thuế hiện &quot;—&quot; vì cách tính VAT chưa chốt với kế toán</span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>2</PagerButton>
            <PagerButton>3</PagerButton>
            <PagerButton>…</PagerButton>
            <PagerButton>56</PagerButton>
            <PagerButton>›</PagerButton>
            <span className="ml-2 inline-flex items-center gap-0.5">
              23 dòng/trang <ChevronDown className="size-3" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: số HĐ do server cấp khi phát hành (next_doc_number), nháp hiện &quot;(tự
          động)&quot;. Mã CQT chỉ có sau khi cơ quan thuế cấp; bị từ chối thì hiện lý do thay mã.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: HĐ &quot;Thay thế&quot; và HĐ gốc &quot;Đã hủy&quot; luôn đi cặp, cùng số đơn —
          không có nút Sửa trên HĐ đã phát hành.
        </div>
      </div>
    </>
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
