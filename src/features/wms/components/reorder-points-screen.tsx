'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search, X } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
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

interface ReorderRow {
  sku: string;
  name: string;
  warehouse: string;
  unit: string;
  min: string;
  max: string;
  reorderPoint: string;
  current: string;
  /** so với điểm đặt — số âm hiển thị đỏ */
  vsPoint: string;
  vsPointNeg?: boolean;
  incoming: string;
  status: string;
  statusTone: StatusTone;
  suggestion: string;
  selected?: boolean;
  focused?: boolean;
}

const SAMPLE_ROWS: ReorderRow[] = [
  {
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    warehouse: 'Kho HN-1',
    unit: 'cái',
    min: '100',
    max: '400',
    reorderPoint: '160',
    current: '180',
    vsPoint: '20',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    warehouse: 'Kho HN-1',
    unit: 'cái',
    min: '200',
    max: '800',
    reorderPoint: '320',
    current: '340',
    vsPoint: '20',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'TL027-BLK',
    name: 'Bút bi Thiên Long TL-027 đen',
    warehouse: 'Kho HN-1',
    unit: 'cái',
    min: '300',
    max: '1.200',
    reorderPoint: '480',
    current: '264',
    vsPoint: '−216',
    vsPointNeg: true,
    incoming: '—',
    status: 'Dưới min',
    statusTone: 'err',
    suggestion: '936',
    selected: true,
  },
  {
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm',
    warehouse: 'Kho HN-1',
    unit: 'ream',
    min: '400',
    max: '1.600',
    reorderPoint: '640',
    current: '660',
    vsPoint: '20',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'DA-A4-70',
    name: 'Giấy A4 Double A 70gsm',
    warehouse: 'Kho HN-1',
    unit: 'ream',
    min: '500',
    max: '2.000',
    reorderPoint: '800',
    current: '791',
    vsPoint: '−9',
    vsPointNeg: true,
    incoming: '—',
    status: 'Dưới điểm đặt',
    statusTone: 'warn',
    suggestion: '1.209',
    selected: true,
    focused: true,
  },
  {
    sku: 'IK-A4-70',
    name: 'Giấy A4 IK Plus 70gsm',
    warehouse: 'Kho HN-1',
    unit: 'ream',
    min: '100',
    max: '400',
    reorderPoint: '160',
    current: '255',
    vsPoint: '95',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    warehouse: 'Kho HN-1',
    unit: 'cây',
    min: '200',
    max: '800',
    reorderPoint: '320',
    current: '466',
    vsPoint: '146',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'TP-BK48-50',
    name: 'Băng keo trong 48mm × 50y Tiến Phát',
    warehouse: 'Kho HN-1',
    unit: 'cây',
    min: '300',
    max: '1.200',
    reorderPoint: '480',
    current: '259',
    vsPoint: '−221',
    vsPointNeg: true,
    incoming: '359',
    status: 'Dưới min',
    statusTone: 'err',
    suggestion: '941',
    selected: true,
  },
  {
    sku: 'BK-2M-20',
    name: 'Băng keo hai mặt 20mm × 10y',
    warehouse: 'Kho HN-1',
    unit: 'cuộn',
    min: '400',
    max: '1.600',
    reorderPoint: '640',
    current: '660',
    vsPoint: '20',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'CP-A5-120',
    name: 'Sổ tay Campus A5 120 trang',
    warehouse: 'Kho HN-1',
    unit: 'cuốn',
    min: '500',
    max: '2.000',
    reorderPoint: '800',
    current: '776',
    vsPoint: '−24',
    vsPointNeg: true,
    incoming: '133',
    status: 'Dưới điểm đặt',
    statusTone: 'warn',
    suggestion: '1.224',
    selected: true,
  },
  {
    sku: 'DL-25K',
    name: 'Sổ da Deli 25K bìa cứng',
    warehouse: 'Kho HN-1',
    unit: 'cuốn',
    min: '200',
    max: '800',
    reorderPoint: '320',
    current: '721',
    vsPoint: '401',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'PL-KG50',
    name: 'Kẹp giấy Plus 50mm (hộp 12)',
    warehouse: 'Kho HN-1',
    unit: 'hộp',
    min: '300',
    max: '1.200',
    reorderPoint: '480',
    current: '463',
    vsPoint: '−17',
    vsPointNeg: true,
    incoming: '—',
    status: 'Dưới điểm đặt',
    statusTone: 'warn',
    suggestion: '737',
    selected: true,
  },
  {
    sku: 'HP-305-BK',
    name: 'Mực in HP 305 đen',
    warehouse: 'Kho HN-1',
    unit: 'hộp',
    min: '100',
    max: '400',
    reorderPoint: '160',
    current: '75',
    vsPoint: '−85',
    vsPointNeg: true,
    incoming: '355',
    status: 'Dưới min',
    statusTone: 'err',
    suggestion: '325',
    selected: true,
  },
  {
    sku: 'CN-PG745',
    name: 'Mực in Canon PG-745 đen',
    warehouse: 'Kho HN-1',
    unit: 'hộp',
    min: '200',
    max: '800',
    reorderPoint: '320',
    current: '340',
    vsPoint: '20',
    incoming: '—',
    status: 'Đủ',
    statusTone: 'ok',
    suggestion: '—',
  },
  {
    sku: 'DL-TAY30',
    name: 'Tẩy Deli 30mm trắng',
    warehouse: 'Kho HN-1',
    unit: 'cái',
    min: '500',
    max: '2.000',
    reorderPoint: '800',
    current: '786',
    vsPoint: '−14',
    vsPointNeg: true,
    incoming: '203',
    status: 'Dưới điểm đặt',
    statusTone: 'warn',
    suggestion: '1.214',
  },
];

function FilterChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-background',
      )}
    >
      {children}
    </span>
  );
}

/** Ô min/max/điểm đặt sửa ngay trên dòng — chỉ hiển thị, chưa nối logic */
function CellBox({ value, focused }: { value: string; focused?: boolean }) {
  return (
    <div
      className={cn(
        'ml-auto flex h-7 w-16 items-center justify-end rounded border bg-background px-1.5 text-sm tabular-nums',
        focused ? 'border-primary ring-2 ring-secondary' : 'border-input',
      )}
    >
      {value}
    </div>
  );
}

export function ReorderPointsScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Hạn mức tồn & điểm đặt hàng lại"
        description="Kho HN-1 · 312 SKU · 7 dưới min · 9 dưới điểm đặt hàng"
        breadcrumb={[{ label: 'Kho' }, { label: 'Hạn mức tồn' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Nhập từ CSV
            </Button>
            <Button variant="outline" size="sm">
              Tính lại theo tốc độ bán 90 ngày
            </Button>
            <Button size="sm">Tạo PO từ đề xuất (16)</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm SKU, tên…</span>
        </div>
        <FilterChip active>
          Kho: HN-1 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip active>
          Chỉ dưới ngưỡng <X className="h-3 w-3" aria-hidden />
        </FilterChip>
        <FilterChip>
          Danh mục: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <Button variant="ghost" size="sm">
          + Lọc
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Cảnh báo gửi kênh: in-app + email lúc 07:00
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" />
                </TableHead>
                <TableHead className="px-2.5">SKU</TableHead>
                <TableHead className="px-2.5">Tên sản phẩm</TableHead>
                <TableHead className="px-2.5">Kho</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">Min</TableHead>
                <TableHead className="px-2.5 text-right">Max</TableHead>
                <TableHead className="px-2.5 text-right">Điểm đặt lại</TableHead>
                <TableHead className="px-2.5 text-right">Tồn hiện tại</TableHead>
                <TableHead className="px-2.5 text-right">So điểm đặt</TableHead>
                <TableHead className="px-2.5 text-right">Đang về (PO)</TableHead>
                <TableHead className="px-2.5">Trạng thái</TableHead>
                <TableHead className="px-2.5 text-right">Đề xuất đặt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((r) => (
                <TableRow
                  key={r.sku}
                  className={r.selected ? 'bg-secondary hover:bg-secondary' : undefined}
                >
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox defaultChecked={r.selected} aria-label={`Chọn ${r.sku}`} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {r.sku}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{r.name}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {r.warehouse}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.unit}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={r.min} focused={r.focused} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={r.max} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={r.reorderPoint} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {r.current}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    <span className={cn('font-semibold', r.vsPointNeg && 'text-destructive')}>
                      {r.vsPoint}
                    </span>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.incoming}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={r.statusTone}>{r.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {r.suggestion}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Thanh sửa hàng loạt thay chân trang khi chọn nhiều dòng */}
        <div className="flex flex-wrap items-center gap-3 border-t border-primary bg-secondary px-3 py-1.5 text-xs">
          <span className="font-semibold text-primary">Đã chọn 6 SKU</span>
          <span className="text-muted-foreground">Sửa hàng loạt:</span>
          <span className="flex items-center gap-1">
            Min
            <span className="flex h-7 w-16 items-center justify-end rounded border border-input bg-background px-1.5 text-sm tabular-nums">
              150
            </span>
          </span>
          <span className="flex items-center gap-1">
            Max
            <span className="flex h-7 w-16 items-center justify-end rounded border border-input bg-background px-1.5 text-sm tabular-nums">
              600
            </span>
          </span>
          <span className="flex items-center gap-1">
            Điểm đặt lại
            <span className="flex h-7 w-16 items-center justify-end rounded border border-input bg-background px-1.5 text-sm tabular-nums">
              240
            </span>
          </span>
          <Button size="sm">Áp dụng cho 6 SKU</Button>
          <Button variant="ghost" size="sm">
            Bỏ chọn
          </Button>
          <span className="ml-auto text-muted-foreground">Trang 1 / 8</span>
        </div>
      </div>
    </div>
  );
}
