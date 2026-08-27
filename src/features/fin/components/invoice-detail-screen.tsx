// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';

interface InvoiceLine {
  no: number;
  product: string;
  sku: string;
  unit: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
  amount: string;
  gift?: boolean;
}

const SAMPLE_LINES: InvoiceLine[] = [
  {
    no: 1,
    product: 'Giấy A4 Double A 80gsm (ream 500 tờ)',
    sku: 'DA-A4-80',
    unit: 'ream',
    qty: '60',
    unitPrice: '66.000',
    discountPct: '0',
    amount: '3.960.000',
  },
  {
    no: 2,
    product: 'Giấy A4 IK Plus 70gsm (ream 500 tờ)',
    sku: 'IK-A4-70',
    unit: 'ream',
    qty: '40',
    unitPrice: '54.500',
    discountPct: '0',
    amount: '2.180.000',
  },
  {
    no: 3,
    product: 'Bút bi Thiên Long TL-08 xanh',
    sku: 'TL08-BLUE',
    unit: 'thùng',
    qty: '10',
    unitPrice: '168.000',
    discountPct: '5',
    amount: '1.596.000',
  },
  {
    no: 4,
    product: 'Bút bi Thiên Long TL-08 đen',
    sku: 'TL08-BLACK',
    unit: 'thùng',
    qty: '5',
    unitPrice: '168.000',
    discountPct: '5',
    amount: '798.000',
  },
  {
    no: 5,
    product: 'Sổ tay Campus A5 120 trang',
    sku: 'CP-A5-120',
    unit: 'cuốn',
    qty: '120',
    unitPrice: '19.200',
    discountPct: '0',
    amount: '2.304.000',
  },
  {
    no: 6,
    product: 'Sổ lò xo Klong A4 200 trang',
    sku: 'KL-A4-200',
    unit: 'cuốn',
    qty: '30',
    unitPrice: '35.000',
    discountPct: '0',
    amount: '1.050.000',
  },
  {
    no: 7,
    product: 'Băng keo trong 48mm × 100y Tiến Phát',
    sku: 'TP-BK48-100',
    unit: 'cuộn',
    qty: '50',
    unitPrice: '8.400',
    discountPct: '0',
    amount: '420.000',
  },
  {
    no: 8,
    product: 'Kẹp giấy Plus 50mm (hộp 12)',
    sku: 'PL-KG50',
    unit: 'hộp',
    qty: '12',
    unitPrice: '21.000',
    discountPct: '0',
    amount: '252.000',
  },
  {
    no: 9,
    product: 'Kẹp giấy Plus 50mm (hộp 12) — hàng tặng KM-2610-001',
    sku: 'PL-KG50',
    unit: 'hộp',
    qty: '1',
    unitPrice: '0',
    discountPct: '0',
    amount: '0',
    gift: true,
  },
];

interface ChecklistItem {
  state: 'ok' | 'warn' | 'none';
  text: React.ReactNode;
}

const SAMPLE_CHECKLIST: ChecklistItem[] = [
  { state: 'ok', text: 'Đơn đã giao đủ — GDN-2608-00521 đã post 23/08/2026' },
  { state: 'ok', text: 'Thông tin người mua đủ MST, địa chỉ, email nhận HĐ' },
  { state: 'ok', text: 'Ký hiệu 1C26TAA còn 4.212 số' },
  { state: 'ok', text: 'Chứng thư số công ty còn hạn tới 14/03/2027' },
  {
    state: 'warn',
    text: (
      <>
        Thuế GTGT chưa cấu hình — hóa đơn phát hành không có dòng thuế.{' '}
        <span className="text-primary underline-offset-2 hover:underline">Xem quyết định chờ</span>
      </>
    ),
  },
  { state: 'none', text: 'Chưa có hóa đơn khác cho đơn này (không trùng)' },
];

export function InvoiceDetailScreen({ id }: { id?: string }) {
  return (
    <>
      <header className="mb-4 space-y-2">
        <Breadcrumb
          items={[
            { label: 'Tài chính' },
            { label: 'Hóa đơn', href: '/fin/invoices' },
            { label: id ?? 'Nháp từ SO-2608-01243' },
          ]}
        />
        <div className="flex min-h-9 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold leading-tight">
              Hóa đơn
              <span className="font-mono text-base font-normal text-muted-foreground">
                (tự động khi phát hành)
              </span>
              <StatusBadge tone="draft">Nháp</StatusBadge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Từ đơn <span className="font-mono text-xs text-primary">SO-2608-01243</span> · tạo bởi
              Bùi Thanh Tùng · 24/08/2026 08:52 · ký hiệu 1C26TAA
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm">
              Quay lại
            </Button>
            <Button variant="outline" size="sm">
              In bản nháp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Xóa nháp
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-3 flex items-start gap-2.5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold text-foreground">Nháp, chưa phát hành.</span> Dòng hàng lấy
          từ đơn đã giao đủ (GDN-2608-00521) và chỉ đọc. Muốn đổi nội dung: sửa đơn gốc rồi tạo lại
          nháp.
        </p>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-8">
          <section className="rounded-md border bg-card px-3 py-2.5">
            <div className="grid gap-x-4 gap-y-2.5 lg:grid-cols-12">
              <Field
                label="Người mua"
                hint="KH-001208 · MST 0301234567 · 940 Đường 3/2, P.15, Q.11, TP.HCM"
                className="lg:col-span-5"
              >
                <ReadOnlyInput className="font-semibold">Nhà sách Phương Nam Q.1</ReadOnlyInput>
              </Field>
              <Field label="Ngày hóa đơn" className="lg:col-span-2">
                <ReadOnlyInput>24/08/2026</ReadOnlyInput>
              </Field>
              <Field label="Hình thức thanh toán" className="lg:col-span-3">
                <ReadOnlyInput>Chuyển khoản / Tiền mặt</ReadOnlyInput>
              </Field>
              <Field
                label="Hạn thanh toán"
                hint="30 ngày theo hợp đồng đại lý"
                className="lg:col-span-2"
              >
                <ReadOnlyInput>23/09/2026</ReadOnlyInput>
              </Field>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <h2 className="text-sm font-semibold">
                Dòng hàng{' '}
                <span className="font-normal text-muted-foreground">· 9 dòng · chỉ đọc</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                Giá theo bảng giá Đại lý miền Nam, bậc số lượng do server resolve
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-8 px-2.5">#</TableHead>
                    <TableHead className="px-2.5">Sản phẩm</TableHead>
                    <TableHead className="px-2.5">ĐVT</TableHead>
                    <TableHead className="px-2.5 text-right">SL</TableHead>
                    <TableHead className="px-2.5 text-right">Đơn giá</TableHead>
                    <TableHead className="px-2.5 text-right">CK%</TableHead>
                    <TableHead className="px-2.5 text-right">Thành tiền</TableHead>
                    <TableHead className="px-2.5 text-right">Thuế suất</TableHead>
                    <TableHead className="px-2.5 text-right">Tiền thuế</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_LINES.map((l) => (
                    <TableRow key={l.no}>
                      <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                      <TableCell className={cn('px-2.5 py-1.5', l.gift && 'text-success')}>
                        {l.product}{' '}
                        <span className="font-mono text-xs text-muted-foreground">{l.sku}</span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">{l.unit}</TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.qty}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.unitPrice}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.discountPct}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.amount}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">
                        —
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t px-3 py-2">
              <div className="flex items-start gap-2.5 rounded-md border bg-warning/10 px-3 py-1.5 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">Khối thuế là placeholder.</span> Cách tính VAT
                  (theo dòng hay theo đơn, giá đã gồm VAT hay chưa) chưa chốt với kế toán;{' '}
                  <span className="font-mono text-xs">fin.TaxRate</span> còn trống. Cột Thuế suất /
                  Tiền thuế hiện &quot;—&quot; và không được tự điền.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Cột phải: tổng tiền + phát hành + lịch sử */}
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-4">
          <section className="rounded-md border bg-card px-3.5 py-3">
            <SumRow label="Tổng hàng" value="12.560.000" />
            <SumRow label="Chiết khấu dòng" value="−84.000" />
            <SumRow label="Khuyến mãi đơn" value="−100.000" />
            <SumRow label="Trước thuế" value="12.376.000" />
            <div className="flex items-center justify-between py-0.5 text-sm">
              <span className="text-muted-foreground">Thuế GTGT</span>
              <span className="text-muted-foreground">chưa cấu hình</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
              <span>Tổng thanh toán</span>
              <span className="tabular-nums">12.376.000</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">
              Bằng chữ: Mười hai triệu ba trăm bảy mươi sáu nghìn đồng
            </p>
          </section>

          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Phát hành</h2>
            <div className="px-3 py-2">
              {SAMPLE_CHECKLIST.map((c, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2.5 py-2 text-sm',
                    i < SAMPLE_CHECKLIST.length - 1 && 'border-b',
                  )}
                >
                  {c.state === 'ok' ? (
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success/10 text-xs font-semibold text-success">
                      ✓
                    </span>
                  ) : c.state === 'warn' ? (
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-semibold text-warning">
                      !
                    </span>
                  ) : (
                    <span className="mt-0.5 inline-block size-4 shrink-0 rounded-full border" />
                  )}
                  <span className={cn(c.state === 'none' && 'text-muted-foreground')}>
                    {c.text}
                  </span>
                </div>
              ))}
              <div className="mt-3 space-y-2 pb-1">
                <Button className="h-10 w-full text-sm">
                  Phát hành hóa đơn
                  <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                    Alt ↵
                  </kbd>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Gửi ký số → CQT cấp mã → số HĐ cấp từ server. Không đảo ngược được.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Lịch sử</h2>
            <div className="px-3 py-1.5">
              <div className="border-b py-2">
                <p className="text-sm">Tạo nháp từ SO-2608-01243</p>
                <p className="text-xs text-muted-foreground">Bùi Thanh Tùng · 24/08/2026 08:52</p>
              </div>
              <div className="py-2">
                <p className="text-sm">Kế toán mở xem</p>
                <p className="text-xs text-muted-foreground">Lê Thị Hương · 24/08/2026 09:10</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Ghi chú: checklist do server trả (GET /invoices/:id/issue-readiness). Có mục đỏ → nút Phát
        hành disable; mục vàng → vẫn cho phát hành.
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ReadOnlyInput({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-8 items-center truncate rounded-md border bg-muted px-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
