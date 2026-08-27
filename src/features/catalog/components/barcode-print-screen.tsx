'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Printer, Search } from 'lucide-react';
import Link from 'next/link';
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

interface LabelRow {
  sku: string;
  name: string;
  barcode: string;
  unit: string;
  copies: number;
}

const SAMPLE_LABELS: LabelRow[] = [
  {
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    barcode: '8934567801234',
    unit: 'cái',
    copies: 50,
  },
  {
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    barcode: '8934567801258',
    unit: 'cái',
    copies: 50,
  },
  {
    sku: 'TL08-BLACK',
    name: 'Bút bi Thiên Long TL-08 đen',
    barcode: '8934567801272',
    unit: 'cái',
    copies: 30,
  },
  {
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm (ream 500 tờ)',
    barcode: '8858906200011',
    unit: 'ream',
    copies: 20,
  },
  {
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    barcode: '8936024880012',
    unit: 'cây',
    copies: 24,
  },
  {
    sku: 'CP-A5-120',
    name: 'Sổ tay Campus A5 120 trang',
    barcode: '8934567844001',
    unit: 'cuốn',
    copies: 20,
  },
  {
    sku: 'PL-KG50',
    name: 'Kẹp giấy Plus 50mm (hộp 12)',
    barcode: '4977564105007',
    unit: 'hộp',
    copies: 12,
  },
  {
    sku: 'DL-KB32',
    name: 'Kẹp bướm Deli 32mm (hộp 12)',
    barcode: '6921734903020',
    unit: 'hộp',
    copies: 12,
  },
  {
    sku: 'HP-85A',
    name: 'Mực in HP 85A (CE285A)',
    barcode: '0884420487876',
    unit: 'hộp',
    copies: 6,
  },
  {
    sku: 'TL-HL01-Y',
    name: 'Bút dạ quang Thiên Long HL-01 vàng',
    barcode: '8934567812345',
    unit: 'cái',
    copies: 16,
  },
];

const BAR_WIDTHS = [
  'w-0.5',
  'w-px',
  'w-1',
  'w-px',
  'w-0.5',
  'w-0.5',
  'w-px',
  'w-1',
  'w-px',
  'w-px',
  'w-0.5',
  'w-1',
  'w-px',
  'w-0.5',
  'w-px',
  'w-px',
  'w-1',
  'w-0.5',
  'w-px',
  'w-0.5',
];

function Kbd({ children, inverted }: { children: string; inverted?: boolean }) {
  return (
    <kbd
      className={cn(
        'rounded border px-1 font-mono text-xs',
        inverted
          ? 'border-primary-foreground/50 text-primary-foreground'
          : 'border-input bg-muted text-muted-foreground',
      )}
    >
      {children}
    </kbd>
  );
}

function FilterChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function FakeInput({
  value,
  select,
  readOnly,
  right,
}: {
  value: string;
  select?: boolean;
  readOnly?: boolean;
  right?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-sm',
        readOnly && 'bg-muted',
        right && 'justify-end tabular-nums',
      )}
    >
      <span className="truncate">{value}</span>
      {select ? <span className="ml-auto text-muted-foreground">▾</span> : null}
    </div>
  );
}

export function BarcodePrintScreen() {
  return (
    <>
      <PageHeader
        title="In tem hàng loạt"
        description="10 sản phẩm · 240 tem · Mẫu 50×30mm"
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Barcode' },
          { label: 'In tem hàng loạt' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Lưu danh sách
            </Button>
            <Button variant="outline" size="sm">
              Xem trước PDF
            </Button>
            <Button size="sm">
              <Printer /> In 240 tem <Kbd inverted>Ctrl P</Kbd>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[1fr_440px] items-start gap-3">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span className="truncate">Thêm sản phẩm: quét hoặc gõ SKU / tên / barcode…</span>
              <span className="ml-auto shrink-0">
                <Kbd>↵ thêm</Kbd>
              </span>
            </div>
            <FilterChip>Từ phiếu nhập ▾</FilterChip>
            <FilterChip>Từ danh sách đã chọn</FilterChip>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-8 px-2.5">
                    <Checkbox aria-label="Chọn tất cả" checked />
                  </TableHead>
                  <TableHead className="w-32 px-2.5 text-xs">SKU</TableHead>
                  <TableHead className="px-2.5 text-xs">Tên sản phẩm</TableHead>
                  <TableHead className="w-36 px-2.5 text-xs">Barcode in</TableHead>
                  <TableHead className="w-16 px-2.5 text-xs">ĐVT</TableHead>
                  <TableHead className="w-28 px-2.5 text-right text-xs">Số tem</TableHead>
                  <TableHead className="w-8 px-2.5 text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_LABELS.map((r) => (
                  <TableRow key={r.sku}>
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox aria-label={`Chọn ${r.sku}`} checked />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                      <Link
                        href={`/catalog/products/${r.sku}`}
                        className="text-primary hover:underline"
                      >
                        {r.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64 truncate px-2.5 py-1.5" title={r.name}>
                      {r.name}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.barcode}</TableCell>
                    <TableCell className="px-2.5 py-1.5">{r.unit}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="ml-auto flex h-7 w-20 items-center justify-end rounded-md border border-input bg-background px-2 text-sm tabular-nums">
                        {r.copies}
                      </div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">✕</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              10 dòng · <span className="font-semibold text-foreground">240 tem</span> · 4 tờ A4 (60
              tem/tờ)
            </span>
            <span className="ml-auto">
              Số tem mặc định = số lượng nhận trong phiếu nhập gần nhất
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Mẫu tem</span>
              <span className="text-xs text-muted-foreground">50×30mm · 2 cột ▾</span>
            </div>
            <div className="flex justify-center bg-muted p-5">
              <div className="flex w-64 flex-col gap-1 rounded-sm border bg-background p-3 shadow-sm">
                <div className="truncate text-sm font-semibold">Bút bi Thiên Long TL-08 xanh</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="font-mono">TL08-BLUE</span>
                  <span className="ml-auto font-semibold text-foreground">3.750 / cái</span>
                </div>
                <div className="mt-1 flex h-10 items-stretch gap-px" aria-hidden>
                  {Array.from({ length: 60 }, (_, i) => (
                    <span
                      key={i}
                      className={cn('bg-foreground', BAR_WIDTHS[i % BAR_WIDTHS.length])}
                    />
                  ))}
                </div>
                <div className="text-center font-mono text-xs tracking-widest">8934567801234</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t p-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox aria-label="In tên sản phẩm" checked /> Tên sản phẩm
              </label>
              <label className="flex items-center gap-2">
                <Checkbox aria-label="In giá niêm yết" checked /> Giá niêm yết
              </label>
              <label className="flex items-center gap-2">
                <Checkbox aria-label="In mã SKU" checked /> Mã SKU
              </label>
              <label className="flex items-center gap-2">
                <Checkbox aria-label="In lô / HSD" /> Lô / HSD
              </label>
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-muted-foreground">Barcode in:</span>
                <FilterChip active>Lẻ (EAN-13)</FilterChip>
                <FilterChip>Thùng (ITF-14)</FilterChip>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Máy in" hint="Sẵn sàng · cuộn còn ~1.100 tem">
                <FakeInput value="Zebra ZD421 · Kho HN-1" select />
              </Field>
              <Field label="Số bản mỗi tem">
                <FakeInput value="1" right />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bắt đầu từ ô" hint="Dùng khi tờ tem đã in dở">
                <FakeInput value="1" right />
              </Field>
              <Field label="Khổ">
                <FakeInput value="Cuộn 50×30, khoảng cách 2mm" readOnly />
              </Field>
            </div>
            <Button className="h-9 w-full">
              <Printer /> In 240 tem <Kbd inverted>Ctrl P</Kbd>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              In trực tiếp qua agent máy in, không mở hộp thoại trình duyệt. Lần in được ghi vào
              nhật ký.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
