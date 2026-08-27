'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Columns3, Filter, Search, Upload } from 'lucide-react';
import Link from 'next/link';
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

interface ProductRow {
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  price: string;
  onHand: string;
  reserved: string;
  available: string;
  barcodes: number;
  status: 'selling' | 'stopped';
  selected?: boolean;
  lowNote?: string;
}

const SAMPLE_PRODUCTS: ProductRow[] = [
  {
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    category: 'Bút viết / Bút bi',
    brand: 'Thiên Long',
    unit: 'cái',
    price: '3750',
    onHand: '31200',
    reserved: '1240',
    available: '29960',
    barcodes: 3,
    status: 'selling',
    selected: true,
  },
  {
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    category: 'Bút viết / Bút bi',
    brand: 'Thiên Long',
    unit: 'cái',
    price: '3750',
    onHand: '18480',
    reserved: '620',
    available: '17860',
    barcodes: 3,
    status: 'selling',
    selected: true,
  },
  {
    sku: 'TL08-BLACK',
    name: 'Bút bi Thiên Long TL-08 đen',
    category: 'Bút viết / Bút bi',
    brand: 'Thiên Long',
    unit: 'cái',
    price: '3750',
    onHand: '9600',
    reserved: '2150',
    available: '7450',
    barcodes: 3,
    status: 'selling',
    selected: true,
  },
  {
    sku: 'TL027-BLUE',
    name: 'Bút bi Thiên Long TL-027 xanh',
    category: 'Bút viết / Bút bi',
    brand: 'Thiên Long',
    unit: 'cái',
    price: '3200',
    onHand: '14400',
    reserved: '0',
    available: '14400',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm (ream 500 tờ)',
    category: 'Giấy / Giấy in',
    brand: 'Double A',
    unit: 'ream',
    price: '72000',
    onHand: '340',
    reserved: '28',
    available: '312',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'DA-A4-70',
    name: 'Giấy A4 Double A 70gsm (ream 500 tờ)',
    category: 'Giấy / Giấy in',
    brand: 'Double A',
    unit: 'ream',
    price: '64000',
    onHand: '125',
    reserved: '118',
    available: '7',
    barcodes: 2,
    status: 'selling',
    lowNote: 'Dưới ngưỡng 50',
  },
  {
    sku: 'IK-A4-70',
    name: 'Giấy A4 IK Plus 70gsm (ream 500 tờ)',
    category: 'Giấy / Giấy in',
    brand: 'IK Plus',
    unit: 'ream',
    price: '58000',
    onHand: '410',
    reserved: '35',
    available: '375',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'EP-PGP-A4',
    name: 'Giấy in ảnh Epson Premium Glossy Photo Paper A4 255gsm hai mặt chống thấm nước xấp 20 tờ',
    category: 'Giấy / Giấy ảnh',
    brand: 'Epson',
    unit: 'xấp',
    price: '145000',
    onHand: '36',
    reserved: '4',
    available: '32',
    barcodes: 1,
    status: 'selling',
  },
  {
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    category: 'Băng keo',
    brand: 'Tiến Phát',
    unit: 'cây',
    price: '9500',
    onHand: '46',
    reserved: '60',
    available: '-14',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'TP-BK48-200',
    name: 'Băng keo trong 48mm × 200y Tiến Phát',
    category: 'Băng keo',
    brand: 'Tiến Phát',
    unit: 'cây',
    price: '17500',
    onHand: '288',
    reserved: '24',
    available: '264',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'CP-A5-120',
    name: 'Sổ tay Campus A5 120 trang',
    category: 'Sổ & tập / Sổ tay',
    brand: 'Campus',
    unit: 'cuốn',
    price: '22000',
    onHand: '1420',
    reserved: '96',
    available: '1324',
    barcodes: 2,
    status: 'selling',
  },
  {
    sku: 'DL-25K',
    name: 'Sổ da Deli 25K bìa cứng',
    category: 'Sổ & tập / Sổ tay',
    brand: 'Deli',
    unit: 'cuốn',
    price: '45000',
    onHand: '0',
    reserved: '0',
    available: '0',
    barcodes: 1,
    status: 'stopped',
  },
  {
    sku: 'DL-0316',
    name: 'Bấm ghim Deli 0316 số 10',
    category: 'Kẹp & ghim / Dụng cụ',
    brand: 'Deli',
    unit: 'cái',
    price: '28000',
    onHand: '18',
    reserved: '3',
    available: '15',
    barcodes: 2,
    status: 'selling',
    lowNote: 'Dưới ngưỡng 20',
  },
  {
    sku: 'HP-85A',
    name: 'Mực in HP 85A (CE285A)',
    category: 'Mực in / Laser',
    brand: 'HP',
    unit: 'hộp',
    price: '1250000',
    onHand: '22',
    reserved: '5',
    available: '17',
    barcodes: 1,
    status: 'selling',
  },
  {
    sku: 'CN-325',
    name: 'Mực in Canon 325',
    category: 'Mực in / Laser',
    brand: 'Canon',
    unit: 'hộp',
    price: '1180000',
    onHand: '9',
    reserved: '6',
    available: '3',
    barcodes: 1,
    status: 'selling',
    lowNote: 'Dưới ngưỡng 10',
  },
  {
    sku: 'TL-HL01-Y',
    name: 'Bút dạ quang Thiên Long HL-01 vàng',
    category: 'Bút viết / Bút dạ quang',
    brand: 'Thiên Long',
    unit: 'cái',
    price: '6500',
    onHand: '3840',
    reserved: '120',
    available: '3720',
    barcodes: 3,
    status: 'selling',
  },
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

function FilterChip({
  active,
  dashed,
  children,
}: {
  active?: boolean;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
        dashed && 'border-dashed text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

const NUM_CELL = 'px-2.5 py-1.5 text-right tabular-nums';

export function ProductListScreen() {
  const selectedCount = SAMPLE_PRODUCTS.filter((p) => p.selected).length;

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description="312 SKU đang bán · 18 ngừng bán · 7 dưới ngưỡng"
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Danh sách' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload /> Import từ file
            </Button>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              Thêm sản phẩm <Kbd inverted>N</Kbd>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">Tìm theo SKU, tên, barcode…</span>
          <span className="ml-auto">
            <Kbd>/</Kbd>
          </span>
        </div>
        <FilterChip>Danh mục: Tất cả ▾</FilterChip>
        <FilterChip>Thương hiệu: Tất cả ▾</FilterChip>
        <FilterChip active>Còn hàng</FilterChip>
        <FilterChip>Hết hàng</FilterChip>
        <FilterChip>Dưới ngưỡng</FilterChip>
        <FilterChip dashed>
          <Filter className="h-3.5 w-3.5" /> Lọc
        </FilterChip>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Đã lưu: <span className="font-semibold text-foreground">Hàng bán chạy HN</span> ▾
          </span>
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1">
            <Columns3 className="h-3.5 w-3.5" /> Cột ▾
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center gap-2 border-b bg-secondary px-3 py-1.5 text-sm">
          <span className="font-semibold text-primary">{selectedCount} đã chọn</span>
          <span className="text-muted-foreground">·</span>
          <button type="button" className="text-primary hover:underline">
            Cập nhật giá
          </button>
          <span className="text-muted-foreground">·</span>
          <button type="button" className="text-primary hover:underline">
            In tem
          </button>
          <span className="text-muted-foreground">·</span>
          <button type="button" className="text-destructive hover:underline">
            Ngừng bán
          </button>
          <span className="ml-auto text-muted-foreground">
            Bỏ chọn <Kbd>Esc</Kbd>
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" checked="indeterminate" />
                </TableHead>
                <TableHead className="w-28 px-2.5 text-xs">
                  SKU <span className="text-primary">↑</span>
                </TableHead>
                <TableHead className="px-2.5 text-xs">Tên sản phẩm</TableHead>
                <TableHead className="w-44 px-2.5 text-xs">Danh mục</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">Thương hiệu</TableHead>
                <TableHead className="w-14 px-2.5 text-xs">ĐVT</TableHead>
                <TableHead className="w-28 px-2.5 text-right text-xs">Giá niêm yết</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">Tồn thực</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">Đang giữ</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">Khả dụng</TableHead>
                <TableHead className="w-20 px-2.5 text-right text-xs">Barcode</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_PRODUCTS.map((p) => (
                <TableRow key={p.sku} data-state={p.selected ? 'selected' : undefined}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Chọn ${p.sku}`} checked={Boolean(p.selected)} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                    <Link
                      href={`/catalog/products/${p.sku}`}
                      className="text-primary hover:underline"
                    >
                      {p.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-72 truncate px-2.5 py-1.5" title={p.name}>
                    {p.name}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {p.category}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{p.brand}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{p.unit}</TableCell>
                  <TableCell className={NUM_CELL}>{formatMoney(p.price, { unit: '' })}</TableCell>
                  <TableCell className={NUM_CELL}>{formatQuantity(p.onHand)}</TableCell>
                  <TableCell className={NUM_CELL}>{formatQuantity(p.reserved)}</TableCell>
                  <TableCell
                    className={cn(
                      NUM_CELL,
                      p.available.startsWith('-') && 'font-semibold text-destructive',
                      p.lowNote && 'font-semibold text-warning',
                    )}
                    title={p.lowNote}
                  >
                    {formatQuantity(p.available)}
                  </TableCell>
                  <TableCell className={NUM_CELL}>{p.barcodes}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {p.status === 'selling' ? (
                      <StatusBadge tone="ok">Đang bán</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Ngừng bán</StatusBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 330</span>
          <span>·</span>
          <span>Khả dụng = Tồn thực − Đang giữ, gộp mọi kho</span>
          <div className="ml-auto flex items-center gap-1">
            <span className="rounded border border-input px-1.5 py-0.5">‹</span>
            <span className="rounded border border-primary bg-primary px-1.5 py-0.5 text-primary-foreground">
              1
            </span>
            <span className="rounded border border-input px-1.5 py-0.5">2</span>
            <span className="rounded border border-input px-1.5 py-0.5">3</span>
            <span className="px-1">…</span>
            <span className="rounded border border-input px-1.5 py-0.5">9</span>
            <span className="rounded border border-input px-1.5 py-0.5">›</span>
            <span className="ml-2">40 dòng/trang ▾</span>
          </div>
        </div>
      </div>
    </>
  );
}
