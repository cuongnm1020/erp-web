'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
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

type TabKey = 'info' | 'variants' | 'barcodes' | 'units' | 'stock';

interface VariantRow {
  sku: string;
  attr: string;
  price: string;
  available: string;
  status: string;
}

interface BarcodeRow {
  code: string;
  kind: string;
  unit: string;
  source: string;
  createdAt: string;
  note: string;
}

interface UnitRow {
  unit: string;
  base: boolean;
  factor: string;
  equal: string;
  barcode: string | null;
  sell: boolean;
  buy: boolean;
  warehouse: boolean;
  price: string;
}

interface StockRow {
  kind: 'warehouse' | 'lot' | 'total';
  expanded?: boolean;
  name: string;
  location: string;
  pickFace?: boolean;
  onHand: string;
  reserved: string;
  available: string;
  expiry: string;
  updatedAt: string;
}

const SAMPLE_VARIANTS: VariantRow[] = [
  { sku: 'TL08-BLUE', attr: 'Màu: Xanh', price: '3750', available: '29960', status: 'Đang bán' },
  { sku: 'TL08-RED', attr: 'Màu: Đỏ', price: '3750', available: '17860', status: 'Đang bán' },
  { sku: 'TL08-BLACK', attr: 'Màu: Đen', price: '3750', available: '7450', status: 'Đang bán' },
];

const SAMPLE_BARCODES: BarcodeRow[] = [
  {
    code: '8934567801234',
    kind: 'Lẻ',
    unit: 'cái',
    source: 'EAN-13 của NSX',
    createdAt: '02/03/2025',
    note: 'In trên thân bút',
  },
  {
    code: '18934567801231',
    kind: 'Thùng',
    unit: 'thùng (24 cái)',
    source: 'ITF-14 của NSX',
    createdAt: '02/03/2025',
    note: 'Tem thùng carton',
  },
  {
    code: 'TLG-0821-BL',
    kind: 'Mã NCC',
    unit: 'cái',
    source: 'Thiên Long Group',
    createdAt: '14/06/2026',
    note: 'Mã trên PO của NCC, quét lúc nhận hàng',
  },
];

const SAMPLE_UNITS: UnitRow[] = [
  {
    unit: 'cái',
    base: true,
    factor: '1',
    equal: '1 cái',
    barcode: '8934567801234',
    sell: true,
    buy: true,
    warehouse: true,
    price: '3750',
  },
  {
    unit: 'lốc',
    base: false,
    factor: '6',
    equal: '1 lốc = 6 cái',
    barcode: null,
    sell: true,
    buy: false,
    warehouse: true,
    price: '22000',
  },
  {
    unit: 'thùng',
    base: false,
    factor: '24',
    equal: '1 thùng = 24 cái (= 4 lốc)',
    barcode: '18934567801231',
    sell: true,
    buy: true,
    warehouse: true,
    price: '86000',
  },
];

const SAMPLE_STOCK: StockRow[] = [
  {
    kind: 'warehouse',
    expanded: true,
    name: 'Kho HN-1',
    location: '3 vị trí',
    onHand: '18400',
    reserved: '1100',
    available: '17300',
    expiry: '',
    updatedAt: '23/08/2026 10:31',
  },
  {
    kind: 'lot',
    name: 'L2607-A',
    location: 'A-03-02-B',
    onHand: '9600',
    reserved: '1100',
    available: '8500',
    expiry: '07/2029',
    updatedAt: '23/08/2026 10:31',
  },
  {
    kind: 'lot',
    name: 'L2608-B',
    location: 'A-03-02-C',
    onHand: '7200',
    reserved: '0',
    available: '7200',
    expiry: '08/2029',
    updatedAt: '19/08/2026 15:04',
  },
  {
    kind: 'lot',
    name: 'L2608-B',
    location: 'P-01-01-A',
    pickFace: true,
    onHand: '1600',
    reserved: '0',
    available: '1600',
    expiry: '08/2029',
    updatedAt: '22/08/2026 08:12',
  },
  {
    kind: 'warehouse',
    name: 'Kho HCM-2',
    location: '2 vị trí',
    onHand: '10800',
    reserved: '140',
    available: '10660',
    expiry: '',
    updatedAt: '22/08/2026 17:50',
  },
  {
    kind: 'warehouse',
    name: 'Kho HN-2 (phụ)',
    location: '1 vị trí',
    onHand: '2000',
    reserved: '0',
    available: '2000',
    expiry: '',
    updatedAt: '10/08/2026 09:00',
  },
  {
    kind: 'warehouse',
    name: 'Kho HCM-1',
    location: '—',
    onHand: '0',
    reserved: '0',
    available: '0',
    expiry: '',
    updatedAt: 'chưa từng nhập',
  },
  {
    kind: 'total',
    name: 'Tổng',
    location: '',
    onHand: '31200',
    reserved: '1240',
    available: '29960',
    expiry: '',
    updatedAt: '',
  },
];

const INFO_FIELDS: Array<{ label: string; value: React.ReactNode }> = [
  { label: 'Danh mục', value: 'Bút viết / Bút bi' },
  { label: 'Thương hiệu', value: 'Thiên Long' },
  { label: 'ĐVT cơ bản', value: 'cái' },
  { label: 'Giá niêm yết', value: <span className="font-semibold tabular-nums">3.750</span> },
  {
    label: 'Giá vốn TB',
    value: (
      <span className="tabular-nums">
        2.410 <span className="text-muted-foreground">(FIFO)</span>
      </span>
    ),
  },
  { label: 'Thuế', value: <span className="text-muted-foreground">chưa cấu hình</span> },
  { label: 'Ngưỡng đặt lại', value: '5.000 cái' },
  { label: 'NCC chính', value: <span className="text-primary">Thiên Long Group</span> },
  { label: 'Theo dõi lô', value: 'Có · HSD 36 tháng' },
];

const TABS: Array<{ key: TabKey; label: string; count?: string }> = [
  { key: 'info', label: 'Thông tin' },
  { key: 'variants', label: 'Biến thể', count: '3' },
  { key: 'barcodes', label: 'Barcode', count: '3' },
  { key: 'units', label: 'Đơn vị & quy đổi', count: '3' },
  { key: 'stock', label: 'Tồn theo kho', count: '4 kho' },
];

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';
const HEAD = 'px-2.5 text-xs';

function InfoTab() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-4">
      {INFO_FIELDS.map((f) => (
        <div key={f.label} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <span className="text-muted-foreground">{f.label}</span>
          <span>{f.value}</span>
        </div>
      ))}
      <div className="col-span-2 grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="text-muted-foreground">Mô tả ngắn</span>
        <span className="text-muted-foreground">
          Ngòi bi, mực dầu, viết êm, nắp đậy cùng màu mực
        </span>
      </div>
    </div>
  );
}

function VariantsTab() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className={cn(HEAD, 'w-40')}>SKU</TableHead>
          <TableHead className={HEAD}>Thuộc tính</TableHead>
          <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá niêm yết</TableHead>
          <TableHead className={cn(HEAD, 'w-32 text-right')}>Khả dụng</TableHead>
          <TableHead className={cn(HEAD, 'w-28')}>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_VARIANTS.map((v) => (
          <TableRow key={v.sku} data-state={v.sku === 'TL08-BLUE' ? 'selected' : undefined}>
            <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">{v.sku}</TableCell>
            <TableCell className="px-2.5 py-1.5">{v.attr}</TableCell>
            <TableCell className={NUM_CELL}>{formatMoney(v.price, { unit: '' })}</TableCell>
            <TableCell className={NUM_CELL}>{formatQuantity(v.available)}</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <StatusBadge tone="ok">{v.status}</StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BarcodesTab() {
  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
        <span>
          3 barcode gắn với SKU này. Ô tìm sản phẩm ở màn tạo đơn và máy quét PDA nhận mọi mã bên
          dưới.
        </span>
        <Button variant="outline" size="sm" className="ml-auto h-7">
          <Printer /> In tem
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-48')}>Barcode</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Loại</TableHead>
            <TableHead className={cn(HEAD, 'w-32')}>ĐVT gắn</TableHead>
            <TableHead className={cn(HEAD, 'w-40')}>Nguồn</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>Ngày tạo</TableHead>
            <TableHead className={HEAD}>Ghi chú</TableHead>
            <TableHead className={cn(HEAD, 'w-24')} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_BARCODES.map((b) => (
            <TableRow key={b.code}>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold">
                {b.code}
              </TableCell>
              <TableCell className="px-2.5 py-1.5">
                <StatusBadge tone="neutral">{b.kind}</StatusBadge>
              </TableCell>
              <TableCell className="px-2.5 py-1.5">{b.unit}</TableCell>
              <TableCell className="px-2.5 py-1.5">{b.source}</TableCell>
              <TableCell className="px-2.5 py-1.5">{b.createdAt}</TableCell>
              <TableCell className="px-2.5 py-1.5 text-muted-foreground">{b.note}</TableCell>
              <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                <button type="button" className="text-primary hover:underline">
                  Sửa
                </button>
                <span className="text-muted-foreground"> · </span>
                <button type="button" className="text-destructive hover:underline">
                  Gỡ
                </button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="px-2.5 py-1.5">
              <div className="flex h-7 items-center rounded-md border border-primary bg-background px-2 text-sm text-muted-foreground">
                Quét hoặc nhập mã mới…
              </div>
            </TableCell>
            <TableCell className="px-2.5 py-1.5">
              <div className="flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
                Lốc <span className="ml-auto text-muted-foreground">▾</span>
              </div>
            </TableCell>
            <TableCell className="px-2.5 py-1.5">
              <div className="flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
                lốc (6 cái) <span className="ml-auto text-muted-foreground">▾</span>
              </div>
            </TableCell>
            <TableCell className="px-2.5 py-1.5">
              <div className="flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
                Nội bộ <span className="ml-auto text-muted-foreground">▾</span>
              </div>
            </TableCell>
            <TableCell className="px-2.5 py-1.5 text-muted-foreground">(tự động)</TableCell>
            <TableCell className="px-2.5 py-1.5">
              <div className="flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
                Ghi chú
              </div>
            </TableCell>
            <TableCell className="px-2.5 py-1.5">
              <Button size="sm" className="h-7">
                Thêm ↵
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Mã phải duy nhất toàn hệ thống. Trùng với SKU khác → báo ngay khi rời ô, kèm link tới SKU
        đó.
      </div>
    </>
  );
}

function UnitsTab() {
  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
        <span>
          Đơn vị cơ bản: <span className="font-semibold text-foreground">cái</span> — mọi số tồn và
          giá vốn lưu theo đơn vị này. Quy đổi chỉ dùng ở lớp hiển thị / nhập liệu.
        </span>
        <Button variant="outline" size="sm" className="ml-auto h-7">
          <Plus /> Thêm đơn vị
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-36')}>Đơn vị</TableHead>
            <TableHead className={cn(HEAD, 'w-24 text-right')}>Hệ số</TableHead>
            <TableHead className={cn(HEAD, 'w-52')}>= đơn vị cơ bản</TableHead>
            <TableHead className={cn(HEAD, 'w-44')}>Barcode</TableHead>
            <TableHead className={cn(HEAD, 'w-16 text-center')}>Bán</TableHead>
            <TableHead className={cn(HEAD, 'w-16 text-center')}>Mua</TableHead>
            <TableHead className={cn(HEAD, 'w-16 text-center')}>Kho</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-right')}>Giá niêm yết</TableHead>
            <TableHead className={HEAD} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_UNITS.map((u) => (
            <TableRow key={u.unit}>
              <TableCell className="px-2.5 py-1.5 font-semibold">
                {u.unit}{' '}
                {u.base ? (
                  <StatusBadge tone="brand" className="ml-1">
                    cơ bản
                  </StatusBadge>
                ) : null}
              </TableCell>
              <TableCell className={NUM_CELL}>{u.factor}</TableCell>
              <TableCell className="px-2.5 py-1.5">{u.equal}</TableCell>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                {u.barcode ?? <span className="font-sans text-muted-foreground">chưa có</span>}
              </TableCell>
              <TableCell className="px-2.5 py-1.5 text-center">
                <Checkbox aria-label={`Bán theo ${u.unit}`} checked={u.sell} />
              </TableCell>
              <TableCell className="px-2.5 py-1.5 text-center">
                <Checkbox aria-label={`Mua theo ${u.unit}`} checked={u.buy} />
              </TableCell>
              <TableCell className="px-2.5 py-1.5 text-center">
                <Checkbox aria-label={`Kho theo ${u.unit}`} checked={u.warehouse} />
              </TableCell>
              <TableCell className={NUM_CELL}>{formatMoney(u.price, { unit: '' })}</TableCell>
              <TableCell className="px-2.5 py-1.5">
                {u.base ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <button type="button" className="text-primary hover:underline">
                    Sửa
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="grid grid-cols-2 gap-3 border-t p-3">
        <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Cách dùng.</span> Ô số lượng ở màn tạo đơn
          / PO / nhận hàng luôn kèm dropdown đơn vị và hiện quy đổi bên dưới:{' '}
          <span className="font-mono text-xs">2 thùng = 48 cái</span>. Chỉ đơn vị được tích
          &quot;Bán&quot; mới hiện cho sale.
        </div>
        <div className="rounded-md border bg-warning/10 p-3 text-sm text-warning">
          <span className="font-semibold">Đổi hệ số sau khi đã có chứng từ</span> không ghi đè lịch
          sử — chứng từ cũ giữ hệ số tại thời điểm lập. Hệ thống sẽ hỏi xác nhận.
        </div>
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Giá niêm yết theo đơn vị lớn nhập tay (không bắt buộc = hệ số × giá lẻ) để hỗ trợ giá sỉ.
      </div>
    </>
  );
}

function StockTab() {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={cn(HEAD, 'w-6')} />
            <TableHead className={HEAD}>Kho / Lô</TableHead>
            <TableHead className={cn(HEAD, 'w-32')}>Vị trí</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-right')}>Tồn thực</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-right')}>Đang giữ</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-right')}>Khả dụng</TableHead>
            <TableHead className={cn(HEAD, 'w-24')}>HSD</TableHead>
            <TableHead className={cn(HEAD, 'w-36')}>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_STOCK.map((s, i) => {
            const bold = s.kind !== 'lot';
            return (
              <TableRow key={`${s.name}-${i}`}>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                  {s.kind === 'warehouse' ? (s.expanded ? '▾' : '▸') : ''}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5',
                    bold && 'font-semibold',
                    s.kind === 'lot' && 'pl-8',
                  )}
                >
                  {s.kind === 'lot' ? <span className="font-mono text-xs">{s.name}</span> : s.name}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {s.kind === 'lot' ? (
                    <span className="font-mono text-xs">
                      {s.location}{' '}
                      {s.pickFace ? <StatusBadge tone="neutral">pick</StatusBadge> : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{s.location}</span>
                  )}
                </TableCell>
                <TableCell className={cn(NUM_CELL, bold && 'font-semibold')}>
                  {formatQuantity(s.onHand)}
                </TableCell>
                <TableCell className={cn(NUM_CELL, bold && 'font-semibold')}>
                  {formatQuantity(s.reserved)}
                </TableCell>
                <TableCell className={cn(NUM_CELL, bold && 'font-semibold')}>
                  {formatQuantity(s.available)}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">{s.expiry}</TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 text-muted-foreground',
                    s.updatedAt === 'chưa từng nhập' && 'italic',
                  )}
                >
                  {s.updatedAt}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Đang giữ = đã tạo đơn, chưa pick. Khả dụng = Tồn thực − Đang giữ.</span>
        <span className="ml-auto text-primary">Xem sổ cái chuyển động →</span>
      </div>
    </>
  );
}

export function ProductDetailScreen() {
  const [tab, setTab] = useState<TabKey>('stock');

  return (
    <>
      <PageHeader
        title="Bút bi Thiên Long TL-08 xanh"
        description="SKU TL08-BLUE · Biến thể của Bút bi Thiên Long TL-08 (Màu: Xanh) · Sửa lần cuối 21/08/2026 bởi Phạm Quốc Huy"
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Danh sách', href: '/catalog/products' },
          { label: 'TL08-BLUE' },
        ]}
        actions={
          <>
            <StatusBadge tone="ok">Đang bán</StatusBadge>
            <Button variant="outline" size="sm">
              <Printer /> In tem
            </Button>
            <Button variant="outline" size="sm">
              Sửa
            </Button>
            <Button variant="outline" size="sm" className="border-destructive text-destructive">
              Ngừng bán
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[300px_1fr] items-start gap-3">
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="h-28 w-28 rounded-md border bg-muted" />
              <div className="flex flex-col gap-1">
                <div className="h-9 w-9 rounded-md border bg-muted" />
                <div className="h-9 w-9 rounded-md border bg-muted" />
                <div className="h-9 w-9 rounded-md border border-dashed bg-background" />
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {INFO_FIELDS.map((f) => (
                <div key={f.label} className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Tồn tổng hợp</div>
            <div className="grid grid-cols-3 gap-2 p-3 text-right">
              <div>
                <div className="text-xs text-muted-foreground">Tồn thực</div>
                <div className="font-semibold tabular-nums">31.200</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Đang giữ</div>
                <div className="font-semibold tabular-nums">1.240</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Khả dụng</div>
                <div className="font-semibold tabular-nums text-success">29.960</div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex border-b px-2" role="tablist" aria-label="Chi tiết sản phẩm">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
                  tab === t.key
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            {tab === 'info' ? <InfoTab /> : null}
            {tab === 'variants' ? <VariantsTab /> : null}
            {tab === 'barcodes' ? <BarcodesTab /> : null}
            {tab === 'units' ? <UnitsTab /> : null}
            {tab === 'stock' ? <StockTab /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
