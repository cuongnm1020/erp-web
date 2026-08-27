'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertCircle, ChevronDown, X } from 'lucide-react';
import { StatusBadge } from '@/components/data/status-badge';
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

interface GrnDraftLine {
  no: number;
  productName: string;
  sku: string;
  unit: string;
  qtyPacked: string;
  baseEquivalent: string;
  lot: string;
  mfgDate: string;
  expiry: string;
  bin: string;
  /** string decimal */
  unitPrice: string;
  /** string decimal */
  amount: string;
  /** dòng thiếu lô — chặn post */
  missingLot?: boolean;
  focused?: boolean;
}

const SAMPLE_LINES: GrnDraftLine[] = [
  {
    no: 1,
    productName: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    unit: 'thùng',
    qtyPacked: '50',
    baseEquivalent: '= 250 ream',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-01-A',
    unitPrice: '340000',
    amount: '17000000',
  },
  {
    no: 2,
    productName: 'Giấy A4 Double A 70gsm',
    sku: 'DA-A4-70',
    unit: 'thùng',
    qtyPacked: '20',
    baseEquivalent: '= 100 ream',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-03-D',
    unitPrice: '305000',
    amount: '6100000',
  },
  {
    no: 3,
    productName: 'Băng keo trong 48mm × 100y Tiến Phát',
    sku: 'TP-BK48-100',
    unit: 'thùng',
    qtyPacked: '6',
    baseEquivalent: '= 360 cây',
    lot: '',
    mfgDate: '',
    expiry: '',
    bin: 'B-02-02-C',
    unitPrice: '492000',
    amount: '2952000',
    missingLot: true,
  },
  {
    no: 4,
    productName: 'Keo dán giấy UHU Stic 21g',
    sku: 'UHU-21',
    unit: 'hộp',
    qtyPacked: '10',
    baseEquivalent: '= 240 cây',
    lot: 'L2608',
    mfgDate: '07/2026',
    expiry: '07/2028',
    bin: 'A-02-01-C',
    unitPrice: '420000',
    amount: '4200000',
  },
  {
    no: 5,
    productName: 'Sổ tay Campus A5 120 trang',
    sku: 'CP-A5-120',
    unit: 'thùng',
    qtyPacked: '4',
    baseEquivalent: '= 200 cuốn',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'A-01-02-B',
    unitPrice: '925000',
    amount: '3700000',
    focused: true,
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
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
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function FauxInput({
  value,
  placeholder,
  readOnly,
  select,
  mono,
}: {
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  select?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1 rounded-md border px-2 text-sm',
        readOnly
          ? 'border-transparent bg-muted text-muted-foreground'
          : 'border-input bg-background',
      )}
    >
      <span
        className={cn('truncate', mono && 'font-mono text-xs', !value && 'text-muted-foreground')}
      >
        {value ?? placeholder}
      </span>
      {select ? (
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

/** Ô nhập trong bảng dòng — chỉ hiển thị, chưa nối logic */
function CellBox({
  value,
  state,
  select,
  mono,
  num,
  className,
}: {
  value?: string;
  state?: 'err' | 'focus';
  select?: boolean;
  mono?: boolean;
  num?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-1 rounded border bg-background px-1.5 text-sm',
        state === 'err' && 'border-destructive bg-destructive/10',
        state === 'focus' && 'border-primary ring-2 ring-secondary',
        state === undefined && 'border-input',
        num && 'justify-end tabular-nums',
        className,
      )}
    >
      <span className={cn('truncate', mono && 'font-mono text-xs')}>{value}</span>
      {select ? (
        <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

export function GrnCreateScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tạo phiếu nhập kho"
        description="Số phiếu: (tự động khi lưu) · Người tạo: Lê Minh Hùng"
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập kho', href: '/wms/grn' },
          { label: 'Tạo phiếu' },
        ]}
        actions={
          <>
            <StatusBadge tone="draft">Nháp</StatusBadge>
            <Button variant="ghost" size="sm">
              Hủy bỏ <Kbd>Esc</Kbd>
            </Button>
            <Button variant="outline" size="sm">
              Lưu nháp <Kbd>Alt S</Kbd>
            </Button>
            <Button size="sm" disabled>
              Post phiếu <Kbd>Alt ↵</Kbd>
            </Button>
          </>
        }
      />

      <div className="rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Số phiếu">
            <FauxInput value="(tự động)" readOnly mono />
          </Field>
          <Field label="Kho nhận" required>
            <FauxInput value="Kho HN-1" select />
          </Field>
          <Field label="Nhà cung cấp" required>
            <FauxInput value="Công ty TNHH Giấy Double A VN" select />
          </Field>
          <Field
            label="Tham chiếu PO"
            hint={
              <>
                Đơn mua còn 3 dòng chưa nhận đủ — <span className="text-primary">đối chiếu PO</span>
              </>
            }
          >
            <FauxInput value="PO-2608-00041" select mono />
          </Field>
          <Field label="Ngày nhập">
            <FauxInput value="23/08/2026" select />
          </Field>
          <Field label="Số chứng từ NCC">
            <FauxInput value="HD-08-4472" mono />
          </Field>
          <Field label="Ghi chú" className="md:col-span-2">
            <FauxInput placeholder="Ghi chú giao nhận, biển số xe…" />
          </Field>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <b className="font-semibold">Chưa post được.</b> Dòng 3 thiếu số lô — sản phẩm quản lý
          theo lô bắt buộc nhập lô và HSD trước khi post.{' '}
          <span className="font-semibold underline">Tới dòng 3</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">
            Dòng nhập{' '}
            <span className="font-normal text-muted-foreground">
              · 5 dòng · tổng 90 kiện = 24.860 đơn vị cơ bản
            </span>
          </span>
          <Button variant="outline" size="sm">
            Thêm dòng <Kbd>Alt N</Kbd>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">#</TableHead>
                <TableHead className="px-2.5">Sản phẩm</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">SL</TableHead>
                <TableHead className="px-2.5 text-right">Quy đổi</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">NSX</TableHead>
                <TableHead className="px-2.5">HSD</TableHead>
                <TableHead className="px-2.5">Vị trí cất</TableHead>
                <TableHead className="px-2.5 text-right">Đơn giá</TableHead>
                <TableHead className="px-2.5 text-right">Thành tiền</TableHead>
                <TableHead className="w-8 px-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LINES.map((l) => (
                <TableRow
                  key={l.no}
                  className={l.missingLot ? 'bg-warning/10 hover:bg-warning/10' : undefined}
                >
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={l.unit} select className="w-24" />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox
                      value={l.qtyPacked}
                      num
                      state={l.focused ? 'focus' : undefined}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {l.baseEquivalent}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox
                      value={l.lot}
                      mono
                      state={l.missingLot ? 'err' : undefined}
                      className="w-24"
                    />
                    {l.missingLot ? (
                      <div className="mt-0.5 text-xs text-destructive">Bắt buộc nhập lô</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={l.mfgDate} className="w-20" />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={l.expiry} className="w-20" />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={l.bin} mono select className="w-28" />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatMoney(l.unitPrice, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                    {formatMoney(l.amount, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            Phím tắt: <Kbd>Alt N</Kbd> dòng mới · <Kbd>↵</Kbd> ô cuối → dòng mới · <Kbd>Tab</Kbd> đi
            hết dòng không cần chuột
          </span>
          <span className="ml-auto">
            Tổng giá trị:{' '}
            <b className="font-semibold text-foreground">{formatMoney('31630000', { unit: '' })}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
