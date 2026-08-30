'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { BarChart3, ChevronDown } from 'lucide-react';
import { RowActions } from '@/components/data/row-actions';
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
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

interface AdjustLine {
  no: number;
  productName: string;
  sku: string;
  bin: string;
  lot: string;
  unit: string;
  onHand: string;
  reserved: string;
  delta: string;
  afterQty: string;
  /** string decimal */
  value: string;
  /** khả dụng sau điều chỉnh xuống dưới mức đang giữ */
  errHint?: string;
}

const SAMPLE_LINES: AdjustLine[] = [
  {
    no: 1,
    productName: 'Giấy note 3M Post-it 76x76 vàng',
    sku: '3M-NOTE76',
    bin: 'A-02-01-C',
    lot: 'L2512',
    unit: 'tập',
    onHand: '364',
    reserved: '10',
    delta: '−120',
    afterQty: '244',
    value: '2520000',
  },
  {
    no: 2,
    productName: 'Keo dán giấy UHU Stic 21g',
    sku: 'UHU-21',
    bin: 'A-02-01-C',
    lot: 'L2601',
    unit: 'cây',
    onHand: '132',
    reserved: '0',
    delta: '−3',
    afterQty: '129',
    value: '52500',
  },
  {
    no: 3,
    productName: 'Bìa lá Kokuyo A4 xanh dương',
    sku: 'KK-BL-A4',
    bin: 'D-01-01-A',
    lot: 'L2604',
    unit: 'cái',
    onHand: '520',
    reserved: '60',
    delta: '−15',
    afterQty: '505',
    value: '64500',
  },
  {
    no: 4,
    productName: 'Bút bi Thiên Long TL-08 đỏ',
    sku: 'TL08-RED',
    bin: 'A-03-02-B',
    lot: 'L2607',
    unit: 'cái',
    onHand: '480',
    reserved: '470',
    delta: '−12',
    afterQty: '468',
    value: '34800',
    errHint: 'Khả dụng sau điều chỉnh: −2 (đang giữ 470) — 2 đơn sẽ thiếu hàng',
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
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

export function StockAdjustScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tạo phiếu điều chỉnh tồn"
        description="Số phiếu: (tự động khi lưu) · Kho HN-1 · người tạo: Lê Minh Hùng"
        breadcrumb={[{ label: 'Kho' }, { label: 'Điều chỉnh tồn' }, { label: 'Tạo phiếu' }]}
        actions={
          <>
            <StatusBadge tone="draft">Nháp</StatusBadge>
            <Button variant="ghost" size="sm">
              Hủy bỏ <Kbd>Esc</Kbd>
            </Button>
            <Button variant="outline" size="sm">
              Lưu nháp <Kbd>Alt S</Kbd>
            </Button>
            <Button size="sm">Post điều chỉnh…</Button>
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div>
          <b className="font-semibold">Điều chỉnh ghi thẳng vào sổ cái tồn (append-only).</b> Sau
          khi post không sửa/xóa được — sai thì tạo phiếu điều chỉnh ngược. Điều chỉnh giảm sẽ tiêu
          thụ cost layer FIFO và ảnh hưởng giá vốn kỳ này. Phiếu giá trị trên 5.000.000 cần kế toán
          trưởng duyệt.
        </div>
      </div>

      <div className="rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Số phiếu">
            <FauxInput value="(tự động)" readOnly mono />
          </Field>
          <Field label="Kho" required>
            <FauxInput value="Kho HN-1" select />
          </Field>
          <Field label="Lý do" required hint="Hỏng/vỡ · Mất · Hết hạn hủy · Sai đếm kiểm kê · Khác">
            <FauxInput value="Hàng hết hạn / hỏng" select />
          </Field>
          <Field label="Tham chiếu">
            <FauxInput placeholder="Biên bản, ảnh chụp…" />
          </Field>
          <Field label="Ghi chú" required className="md:col-span-2">
            <FauxInput value="Lô L2512 hết hạn 31/08 — hủy theo biên bản BB-0823-02; keo UHU chảy nắp; bìa lá ướt mưa dột khu D" />
          </Field>
          <Field label="Ngày hiệu lực">
            <FauxInput value="23/08/2026" select />
          </Field>
          <Field label="Người duyệt (nếu cần)">
            <FauxInput value="Kế toán trưởng — tự định tuyến" readOnly />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">
            Dòng điều chỉnh · 4 dòng · giá trị{' '}
            <span className="text-destructive">{formatMoney('-2694600', { unit: '' })}</span>
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
                <TableHead className="px-2.5">Vị trí</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">Tồn thực</TableHead>
                <TableHead className="px-2.5 text-right">Đang giữ</TableHead>
                <TableHead className="px-2.5 text-right">Điều chỉnh ±</TableHead>
                <TableHead className="px-2.5 text-right">Tồn sau</TableHead>
                <TableHead className="px-2.5 text-right">Giá trị</TableHead>
                <TableHead className="w-12 px-2.5">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LINES.map((l) => (
                <TableRow
                  key={l.no}
                  className={l.errHint ? 'bg-warning/10 hover:bg-warning/10' : undefined}
                >
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.bin}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.lot}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.unit}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.onHand}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {l.reserved}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div
                      className={cn(
                        'ml-auto flex h-7 w-20 items-center justify-end rounded border bg-background px-1.5 text-sm tabular-nums',
                        l.errHint ? 'border-destructive bg-destructive/10' : 'border-input',
                      )}
                    >
                      {l.delta}
                    </div>
                    {l.errHint ? (
                      <div className="mt-0.5 text-right text-xs text-destructive">{l.errHint}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                    {l.afterQty}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatMoney(l.value, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {/* Phiếu còn nháp — xóa được dòng; sau khi post là bất biến */}
                    <RowActions
                      onDelete={() => toast.success(`Đã xóa dòng ${l.sku} (mẫu)`)}
                      deleteLabel="Xóa dòng"
                      itemName={`dòng ${l.sku}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Điều chỉnh âm không được làm tồn thực xuống dưới 0; xuống dưới mức &quot;đang giữ&quot;
          thì cảnh báo đỏ vì đơn đã giữ sẽ thiếu hàng
        </div>
      </div>
    </div>
  );
}
