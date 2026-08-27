// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { ChevronDown, Info, Printer, Search, X } from 'lucide-react';
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
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';

interface ValuationRow {
  sku: string;
  name: string;
  slowMoving?: string;
  warehouse: string;
  onHand: string;
  reserved: string;
  available: string;
  avgCost: string;
  value: string;
  layers: number;
  expanded?: boolean;
}

const SAMPLE_VALUATION: ValuationRow[] = [
  {
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm (ream 500 tờ)',
    warehouse: 'Kho HN-1',
    onHand: '8.420',
    reserved: '640',
    available: '7.780',
    avgCost: '58.246',
    value: '490.431.000',
    layers: 4,
    expanded: true,
  },
  {
    sku: 'HP-305A',
    name: 'Mực in HP 305A đen chính hãng',
    warehouse: 'Kho HN-1',
    onHand: '312',
    reserved: '28',
    available: '284',
    avgCost: '1.082.500',
    value: '337.740.000',
    layers: 3,
  },
  {
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm (ream 500 tờ)',
    warehouse: 'Kho HCM-2',
    onHand: '5.160',
    reserved: '380',
    available: '4.780',
    avgCost: '58.410',
    value: '301.395.600',
    layers: 3,
  },
  {
    sku: 'CN-325',
    name: 'Mực in Canon 325 chính hãng',
    warehouse: 'Kho HN-1',
    onHand: '198',
    reserved: '12',
    available: '186',
    avgCost: '1.194.800',
    value: '236.570.400',
    layers: 2,
  },
  {
    sku: 'DA-A4-70',
    name: 'Giấy A4 Double A 70gsm (ream 500 tờ)',
    warehouse: 'Kho HN-1',
    onHand: '4.230',
    reserved: '510',
    available: '3.720',
    avgCost: '51.820',
    value: '219.198.600',
    layers: 3,
  },
  {
    sku: 'IK-A4-70',
    name: 'Giấy A4 IK Plus 70gsm (ream 500 tờ)',
    warehouse: 'Kho HCM-2',
    onHand: '4.610',
    reserved: '220',
    available: '4.390',
    avgCost: '46.230',
    value: '213.120.300',
    layers: 2,
  },
  {
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    warehouse: 'Kho HN-1',
    onHand: '31.200',
    reserved: '1.152',
    available: '30.048',
    avgCost: '2.850',
    value: '88.920.000',
    layers: 5,
  },
  {
    sku: 'BR-TN2385',
    name: 'Mực in Brother TN-2385 tương thích',
    warehouse: 'Kho HCM-2',
    onHand: '240',
    reserved: '6',
    available: '234',
    avgCost: '338.500',
    value: '81.240.000',
    layers: 2,
  },
  {
    sku: 'CP-A4-200',
    name: 'Sổ tay Campus A4 200 trang',
    warehouse: 'Kho HN-1',
    onHand: '2.640',
    reserved: '180',
    available: '2.460',
    avgCost: '29.400',
    value: '77.616.000',
    layers: 3,
  },
  {
    sku: 'TL08-BLACK',
    name: 'Bút bi Thiên Long TL-08 đen',
    warehouse: 'Kho HN-1',
    onHand: '26.400',
    reserved: '720',
    available: '25.680',
    avgCost: '2.850',
    value: '75.240.000',
    layers: 4,
  },
  {
    sku: 'CP-A5-120',
    name: 'Sổ tay Campus A5 120 trang',
    warehouse: 'Kho HCM-2',
    onHand: '4.180',
    reserved: '310',
    available: '3.870',
    avgCost: '16.850',
    value: '70.433.000',
    layers: 2,
  },
  {
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    warehouse: 'Kho HN-1',
    onHand: '8.640',
    reserved: '460',
    available: '8.180',
    avgCost: '7.120',
    value: '61.516.800',
    layers: 3,
  },
  {
    sku: 'PL-KG50',
    name: 'Kẹp giấy Plus 50mm (hộp 12)',
    warehouse: 'Kho HN-1',
    onHand: '2.480',
    reserved: '92',
    available: '2.388',
    avgCost: '17.800',
    value: '44.144.000',
    layers: 2,
  },
  {
    sku: 'TL-HL03',
    name: 'Bút dạ quang Thiên Long HL-03 vàng',
    slowMoving: '92 ngày không xuất',
    warehouse: 'Kho HCM-2',
    onHand: '4.960',
    reserved: '0',
    available: '4.960',
    avgCost: '6.320',
    value: '31.347.200',
    layers: 1,
  },
];

interface CostLayerRow {
  receivedAt: string;
  grn: string;
  supplier: string;
  qtyIn: string;
  qtyLeft: string;
  unitCost: string;
  value: string;
  order: { tone: 'warn' | 'neutral'; label: string };
}

const SAMPLE_LAYERS: CostLayerRow[] = [
  {
    receivedAt: '02/07/2026',
    grn: 'GRN-2607-00012',
    supplier: 'Giấy Double A VN',
    qtyIn: '3.000',
    qtyLeft: '420',
    unitCost: '57.100',
    value: '23.982.000',
    order: { tone: 'warn', label: 'đang tiêu (layer 1)' },
  },
  {
    receivedAt: '25/07/2026',
    grn: 'GRN-2607-00078',
    supplier: 'Giấy Double A VN',
    qtyIn: '3.000',
    qtyLeft: '3.000',
    unitCost: '58.000',
    value: '174.000.000',
    order: { tone: 'neutral', label: 'layer 2' },
  },
  {
    receivedAt: '08/08/2026',
    grn: 'GRN-2608-00087',
    supplier: 'Giấy Double A VN',
    qtyIn: '3.000',
    qtyLeft: '3.000',
    unitCost: '58.600',
    value: '175.800.000',
    order: { tone: 'neutral', label: 'layer 3' },
  },
  {
    receivedAt: '21/08/2026',
    grn: 'GRN-2608-00121',
    supplier: 'Giấy Double A VN',
    qtyIn: '2.000',
    qtyLeft: '2.000',
    unitCost: '58.325',
    value: '116.649.000',
    order: { tone: 'neutral', label: 'layer 4' },
  },
];

export function InventoryValuationScreen() {
  return (
    <>
      <PageHeader
        title="Giá vốn & giá trị tồn kho"
        description="Số liệu theo phương pháp FIFO · chốt đến 24/08/2026 07:00 · 312 SKU · 2 kho"
        breadcrumb={[{ label: 'Tài chính' }, { label: 'Giá vốn & giá trị tồn kho' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> In báo cáo
            </Button>
            <Button variant="outline" size="sm">
              Xuất XLSX
            </Button>
            <Button variant="outline" size="sm">
              Đối chiếu sổ cái tồn
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold text-foreground">COGS do database tính</span> qua hàm{' '}
          <span className="font-mono text-xs">wms.consume_fifo()</span> khi xuất kho; màn hình này
          chỉ đọc các cost layer còn lại. Không có chỗ nào nhập tay giá vốn — lệch số thì đối chiếu
          Sổ cái tồn, không sửa ở đây.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Tổng giá trị tồn" value="4.812.640.000" detail="2 kho · 312 SKU" />
        <KpiCard label="Kho HN-1" value="3.104.520.000" detail="64,5%" />
        <KpiCard label="Kho HCM-2" value="1.708.120.000" detail="35,5%" />
        <KpiCard label="COGS tháng 8" value="2.386.410.000" detail="từ 1.842 phiếu xuất" />
        <KpiCard
          label="Tồn chậm luân chuyển"
          value={<span className="text-warning">218.400.000</span>}
          detail="> 90 ngày không xuất · 14 SKU"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm SKU, tên, barcode…
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
          Kho: Tất cả <X className="size-3 opacity-70" />
        </span>
        <FilterChip>Danh mục</FilterChip>
        <span className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2 text-sm">
          Chỉ chậm luân chuyển
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Sắp xếp: <span className="font-semibold text-foreground">Giá trị tồn giảm dần</span>{' '}
            <ChevronDown className="inline size-3" />
          </span>
          <span>·</span>
          <span>SL theo đơn vị cơ bản</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-7 px-2.5" />
              <TableHead className="px-2.5">SKU</TableHead>
              <TableHead className="px-2.5">Tên sản phẩm</TableHead>
              <TableHead className="px-2.5">Kho</TableHead>
              <TableHead className="px-2.5 text-right">Tồn thực</TableHead>
              <TableHead className="px-2.5 text-right">Đang giữ</TableHead>
              <TableHead className="px-2.5 text-right">Khả dụng</TableHead>
              <TableHead className="px-2.5 text-right">Giá vốn TB</TableHead>
              <TableHead className="px-2.5 text-right">Giá trị tồn ▼</TableHead>
              <TableHead className="px-2.5 text-right">Số layer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_VALUATION.map((r, i) => (
              <ValuationRowGroup key={`${r.sku}-${r.warehouse}-${i}`} row={r} />
            ))}
            <TableRow className="bg-muted font-semibold hover:bg-muted">
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5">Tổng 312 SKU × 2 kho</TableCell>
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">—</TableCell>
              <TableCell className="px-2.5 py-1.5" />
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">4.812.640.000</TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">741</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–17 / 486 dòng SKU×kho</span>
          <span>
            · Giá vốn TB = giá trị còn lại ÷ tồn thực, chỉ để đọc; xuất kho luôn tiêu theo từng
            layer FIFO
          </span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>2</PagerButton>
            <PagerButton>3</PagerButton>
            <PagerButton>…</PagerButton>
            <PagerButton>29</PagerButton>
            <PagerButton>›</PagerButton>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: mở rộng dòng = drill-down cost layer FIFO. &quot;SL còn lại&quot; chỉ giảm khi
          consume_fifo tiêu layer lúc post phiếu xuất — không bao giờ sửa tay.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: ba số tồn (thực / giữ / khả dụng) luôn hiện đủ; giá trị tồn tính trên tồn thực vì
          hàng đang giữ vẫn nằm trong kho.
        </div>
      </div>
    </>
  );
}

function ValuationRowGroup({ row }: { row: ValuationRow }) {
  return (
    <>
      <TableRow className={cn(row.expanded && 'bg-secondary hover:bg-secondary')}>
        <TableCell className="px-2.5 py-1.5 text-muted-foreground">
          {row.expanded ? '▾' : '▸'}
        </TableCell>
        <TableCell className="px-2.5 py-1.5 font-mono text-xs">{row.sku}</TableCell>
        <TableCell className="max-w-80 truncate px-2.5 py-1.5 font-semibold">
          {row.name}
          {row.slowMoving ? (
            <>
              {' '}
              — <StatusBadge tone="warn">{row.slowMoving}</StatusBadge>
            </>
          ) : null}
        </TableCell>
        <TableCell className="whitespace-nowrap px-2.5 py-1.5">{row.warehouse}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.onHand}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.reserved}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.available}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.avgCost}</TableCell>
        <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
          {row.value}
        </TableCell>
        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">{row.layers}</TableCell>
      </TableRow>
      {row.expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="bg-muted/50 p-0">
            <div className="overflow-x-auto py-1 pl-7 pr-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 px-2.5 text-xs">Ngày nhập</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Phiếu nhập</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Nhà cung cấp</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">SL nhập</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">SL còn lại</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Đơn giá vốn</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Giá trị còn lại</TableHead>
                    <TableHead className="h-8 px-2.5 text-xs">Thứ tự tiêu FIFO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_LAYERS.map((l) => (
                    <TableRow key={l.grn} className="hover:bg-transparent">
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">
                        {l.receivedAt}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <span className="font-mono text-xs text-primary">{l.grn}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                        {l.supplier}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.qtyIn}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                        {l.qtyLeft}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.unitCost}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.value}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone={l.order.tone}>{l.order.label}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="px-2.5 py-1.5 text-muted-foreground">
                      Cộng 4 layer — khớp Tồn thực
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      11.000
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      8.420
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      TB 58.246
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      490.431.000
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      advisory lock theo SKU+kho
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
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
