// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { CheckCircle2, ChevronDown, User } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface DebtDocRow {
  doc: string;
  noInvoice?: boolean;
  invoiceDate: string;
  dueDate: string | null;
  overdue: string | null;
  total: string;
  paid: string;
  remaining: string;
  remainingOverdue?: boolean;
  /** Ô "Cấn trừ lần này": null = dòng chưa chọn (ô read-only 0). */
  allocation: string | null;
  allocationFocus?: boolean;
  after: string;
  afterZero?: boolean;
  selected: boolean;
}

const SAMPLE_DEBT_DOCS: DebtDocRow[] = [
  {
    doc: 'INV-2606-00412',
    invoiceDate: '18/06/2026',
    dueDate: '18/07/2026',
    overdue: '37 ngày',
    total: '12.400.000',
    paid: '0',
    remaining: '12.400.000',
    remainingOverdue: true,
    allocation: '12.400.000',
    after: '0',
    afterZero: true,
    selected: true,
  },
  {
    doc: 'INV-2606-00588',
    invoiceDate: '27/06/2026',
    dueDate: '27/07/2026',
    overdue: '28 ngày',
    total: '8.950.000',
    paid: '0',
    remaining: '8.950.000',
    remainingOverdue: true,
    allocation: '8.950.000',
    after: '0',
    afterZero: true,
    selected: true,
  },
  {
    doc: 'INV-2607-00103',
    invoiceDate: '04/07/2026',
    dueDate: '03/08/2026',
    overdue: '21 ngày',
    total: '10.400.000',
    paid: '0',
    remaining: '10.400.000',
    remainingOverdue: true,
    allocation: '10.400.000',
    after: '0',
    afterZero: true,
    selected: true,
  },
  {
    doc: 'INV-2607-00455',
    invoiceDate: '16/07/2026',
    dueDate: '15/08/2026',
    overdue: '9 ngày',
    total: '15.000.000',
    paid: '5.000.000',
    remaining: '10.000.000',
    remainingOverdue: true,
    allocation: '10.000.000',
    after: '0',
    afterZero: true,
    selected: true,
  },
  {
    doc: 'INV-2607-00790',
    invoiceDate: '28/07/2026',
    dueDate: '27/08/2026',
    overdue: null,
    total: '6.120.000',
    paid: '0',
    remaining: '6.120.000',
    allocation: '6.120.000',
    allocationFocus: true,
    after: '0',
    afterZero: true,
    selected: true,
  },
  {
    doc: 'INV-2608-00112',
    invoiceDate: '05/08/2026',
    dueDate: '04/09/2026',
    overdue: null,
    total: '4.380.000',
    paid: '0',
    remaining: '4.380.000',
    allocation: '2.130.000',
    after: '2.250.000',
    selected: true,
  },
  {
    doc: 'INV-2608-00210',
    invoiceDate: '11/08/2026',
    dueDate: '10/09/2026',
    overdue: null,
    total: '3.940.000',
    paid: '0',
    remaining: '3.940.000',
    allocation: null,
    after: '3.940.000',
    selected: false,
  },
  {
    doc: 'INV-2608-00287',
    invoiceDate: '14/08/2026',
    dueDate: '13/09/2026',
    overdue: null,
    total: '2.760.000',
    paid: '0',
    remaining: '2.760.000',
    allocation: null,
    after: '2.760.000',
    selected: false,
  },
  {
    doc: 'INV-2608-00345',
    invoiceDate: '18/08/2026',
    dueDate: '17/09/2026',
    overdue: null,
    total: '9.100.000',
    paid: '0',
    remaining: '9.100.000',
    allocation: null,
    after: '9.100.000',
    selected: false,
  },
  {
    doc: 'INV-2608-00422',
    invoiceDate: '22/08/2026',
    dueDate: '21/09/2026',
    overdue: null,
    total: '31.750.000',
    paid: '0',
    remaining: '31.750.000',
    allocation: null,
    after: '31.750.000',
    selected: false,
  },
  {
    doc: 'SO-2608-01244',
    noInvoice: true,
    invoiceDate: '24/08/2026',
    dueDate: null,
    overdue: null,
    total: '4.620.000',
    paid: '0',
    remaining: '4.620.000',
    allocation: null,
    after: '4.620.000',
    selected: false,
  },
];

export function PaymentsScreen() {
  return (
    <>
      <header className="mb-4 space-y-2">
        <Breadcrumb
          items={[{ label: 'Tài chính' }, { label: 'Thanh toán' }, { label: 'Thu tiền & cấn trừ' }]}
        />
        <div className="flex min-h-9 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold leading-tight">
              Thu tiền &amp; cấn trừ công nợ
              <StatusBadge tone="draft">Nháp</StatusBadge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Phiếu thu: <span className="font-mono text-xs">(tự động khi ghi nhận)</span> · người
              lập: Lê Thị Hương · 24/08/2026
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm">
              Hủy bỏ <Kbd>Esc</Kbd>
            </Button>
            <Button variant="outline" size="sm">
              Danh sách phiếu thu
            </Button>
            <Button size="sm">
              Ghi nhận thanh toán
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                Alt ↵
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* Form thu tiền */}
      <section className="mb-3 rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-2.5 lg:grid-cols-12">
          <Field
            label="Khách hàng"
            required
            className="lg:col-span-4"
            hint={
              <>
                Công nợ hiện tại <span className="font-semibold text-foreground">86.420.000</span> ·
                quá hạn <span className="font-semibold text-destructive">31.750.000</span> · hạn mức
                150.000.000
              </>
            }
          >
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-semibold">Công ty TNHH Hòa Phát Văn Phòng Phẩm</span>
              <span className="whitespace-nowrap text-muted-foreground">· KH-000317</span>
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </div>
          </Field>
          <Field label="Phương thức" required className="lg:col-span-3">
            <FakeInput caret>Chuyển khoản — VCB 0011</FakeInput>
          </Field>
          <Field label="Số tiền thu" required className="lg:col-span-2">
            <div className="flex h-8 items-center justify-end rounded-md border border-primary bg-background px-2 text-sm font-semibold tabular-nums ring-2 ring-secondary">
              50.000.000
            </div>
          </Field>
          <Field label="Ngày thu" className="lg:col-span-1">
            <FakeInput caret>24/08/2026</FakeInput>
          </Field>
          <Field label="Tham chiếu" className="lg:col-span-2">
            <FakeInput>VCB FT26236HP0921 — &quot;HPVPP tt hd thang 8&quot;</FakeInput>
          </Field>
        </div>
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-12">
        {/* Bảng cấn trừ */}
        <section className="min-w-0 rounded-md border bg-card xl:col-span-8">
          <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5 text-sm">
            <span className="font-semibold">Chứng từ còn nợ của KH</span>
            <span className="text-muted-foreground">· 11 hóa đơn · tổng 86.420.000</span>
            <span className="inline-flex h-6 items-center rounded-md border border-input bg-background px-2 text-xs">
              Chỉ quá hạn
            </span>
            <span className="inline-flex h-6 items-center rounded-md border border-primary bg-secondary px-2 text-xs font-semibold text-primary">
              Tất cả
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7">
                Tự động cấn trừ (cũ nhất trước) <Kbd>Alt A</Kbd>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 font-normal text-muted-foreground">
                Bỏ chọn hết
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-8 px-2.5">
                    <Checkbox checked aria-label="Chọn tất cả" />
                  </TableHead>
                  <TableHead className="px-2.5">Chứng từ</TableHead>
                  <TableHead className="px-2.5">Ngày HĐ</TableHead>
                  <TableHead className="px-2.5">Hạn TT</TableHead>
                  <TableHead className="px-2.5">Quá hạn</TableHead>
                  <TableHead className="px-2.5 text-right">Tổng HĐ</TableHead>
                  <TableHead className="px-2.5 text-right">Đã thu</TableHead>
                  <TableHead className="px-2.5 text-right">Còn nợ</TableHead>
                  <TableHead className="px-2.5 text-right">Cấn trừ lần này</TableHead>
                  <TableHead className="px-2.5 text-right">Còn lại sau</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_DEBT_DOCS.map((r) => (
                  <TableRow
                    key={r.doc}
                    className={cn(r.selected && 'bg-secondary hover:bg-secondary')}
                  >
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox checked={r.selected} aria-label={`Chọn ${r.doc}`} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                      <span className="font-mono text-xs text-primary">{r.doc}</span>{' '}
                      {r.noInvoice ? <StatusBadge tone="neutral">chưa có HĐ</StatusBadge> : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 tabular-nums">{r.invoiceDate}</TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 tabular-nums',
                        !r.dueDate && 'text-muted-foreground',
                      )}
                    >
                      {r.dueDate ?? '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5',
                        r.overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {r.overdue ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.total}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.paid}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        r.remainingOverdue && 'font-semibold text-destructive',
                      )}
                    >
                      {r.remaining}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right">
                      {r.allocation !== null ? (
                        <span
                          className={cn(
                            'inline-flex h-6 items-center rounded-sm border bg-background px-1.5 tabular-nums',
                            r.allocationFocus
                              ? 'border-primary ring-2 ring-secondary'
                              : 'border-input',
                          )}
                        >
                          {r.allocation}
                        </span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-sm border bg-muted px-1.5 text-muted-foreground tabular-nums">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        r.afterZero && 'text-success',
                      )}
                    >
                      {r.after}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-semibold hover:bg-muted">
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5">Tổng</TableCell>
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    109.420.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">5.000.000</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    104.420.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    50.000.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    54.420.000
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              Phím tắt: <Kbd>Space</Kbd> chọn dòng · <Kbd>Tab</Kbd> sang ô cấn trừ ·{' '}
              <Kbd>Alt A</Kbd> tự động cấn trừ
            </span>
            <span>· Đơn chưa có HĐ chỉ cấn trừ được khi bật &quot;Tạm ứng theo đơn&quot;</span>
          </div>
        </section>

        {/* Cột phải */}
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-4">
          <section className="rounded-md border bg-card px-3.5 py-3">
            <SumRow label="Số tiền thu" value="50.000.000" />
            <SumRow label="Đã cấn trừ (6 HĐ)" value="−50.000.000" />
            <SumRow label="Trong đó quá hạn" value="41.750.000" />
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
              <span>Chưa phân bổ</span>
              <span className="tabular-nums text-success">0</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">
              Chưa phân bổ &gt; 0 sẽ ghi thành khoản trả trước của KH
            </p>
          </section>

          <div className="flex items-start gap-2.5 rounded-md border bg-success/10 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-semibold">Phân bổ hợp lệ.</span> Tổng cấn trừ = số tiền thu. Sau
              ghi nhận, công nợ KH còn <span className="font-semibold">36.420.000</span>, không còn
              quá hạn.
            </p>
          </div>

          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Sau khi ghi nhận</h2>
            <div className="space-y-1.5 px-3 py-2 text-sm">
              <InfoRow label="Phiếu thu">
                <span className="font-mono text-xs">RC-2608-xxxxx (server cấp)</span>
              </InfoRow>
              <InfoRow label="Trạng thái">
                <StatusBadge tone="ok">Đã post</StatusBadge>
              </InfoRow>
              <InfoRow label="Sửa sai">Chỉ bằng phiếu điều chỉnh</InfoRow>
              <InfoRow label="Hoa hồng sale">Tính lại kỳ 08/2026</InfoRow>
              <InfoRow label="Idempotency-Key">
                <span className="font-mono text-xs">sinh lúc bấm nút</span>
              </InfoRow>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Thu gần đây của KH</h2>
            <div className="px-3 py-1.5">
              <ReceiptRow
                doc="RC-2608-00288"
                amount="5.000.000"
                meta="16/08/2026 · CK VCB · 1 HĐ"
              />
              <ReceiptRow
                doc="RC-2607-00921"
                amount="28.300.000"
                meta="30/07/2026 · CK VCB · 3 HĐ"
              />
              <ReceiptRow
                doc="RC-2606-00744"
                amount="19.800.000"
                meta="25/06/2026 · Tiền mặt · 2 HĐ"
                last
              />
            </div>
          </section>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: &quot;Ghi nhận thanh toán&quot; = post phiếu thu, không đảo ngược → có confirm
          dialog. Số tiền và cấn trừ chỉ cập nhật UI sau khi server trả về (không optimistic).
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: ô &quot;Cấn trừ lần này&quot; nhập được; vượt &quot;Còn nợ&quot; → viền đỏ, chặn.
          Tự động cấn trừ đi từ HĐ cũ nhất.
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FakeInput({
  children,
  caret,
  className,
}: {
  children?: React.ReactNode;
  caret?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center truncate rounded-md border border-input bg-background px-2 text-sm',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {caret ? <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ReceiptRow({
  doc,
  amount,
  meta,
  last,
}: {
  doc: string;
  amount: string;
  meta: string;
  last?: boolean;
}) {
  return (
    <div className={cn('py-2', !last && 'border-b')}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-primary">{doc}</span>
        <span className="text-sm font-semibold tabular-nums">{amount}</span>
      </div>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-b-2 bg-background px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}
