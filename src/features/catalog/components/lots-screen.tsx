'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Columns3, Filter, Search } from 'lucide-react';
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
import { formatQuantity } from '@/lib/format';

type LotState = 'expired' | 'near' | 'ok' | 'empty';

interface LotRow {
  lot: string;
  sku: string;
  name: string;
  warehouse: string;
  onHand: string;
  mfgDate: string;
  expiry: string;
  remaining: string;
  state: LotState;
}

const SAMPLE_LOTS: LotRow[] = [
  {
    lot: 'L2507-C',
    sku: 'HP-85A',
    name: 'Mực in HP 85A (CE285A)',
    warehouse: 'Kho HN-1',
    onHand: '4',
    mfgDate: '07/2025',
    expiry: '10/08/2026',
    remaining: 'quá 13 ngày',
    state: 'expired',
  },
  {
    lot: 'L2506-A',
    sku: 'CN-325',
    name: 'Mực in Canon 325',
    warehouse: 'Kho HCM-2',
    onHand: '2',
    mfgDate: '06/2025',
    expiry: '18/08/2026',
    remaining: 'quá 5 ngày',
    state: 'expired',
  },
  {
    lot: 'L2508-A',
    sku: 'DL-E300',
    name: 'Gôm tẩy Deli E300 (vỉ 3)',
    warehouse: 'Kho HN-1',
    onHand: '120',
    mfgDate: '08/2025',
    expiry: '25/08/2026',
    remaining: '2 ngày',
    state: 'near',
  },
  {
    lot: 'L2409-B',
    sku: 'TP-BKG24',
    name: 'Băng keo giấy 24mm × 20y',
    warehouse: 'Kho HCM-2',
    onHand: '240',
    mfgDate: '09/2024',
    expiry: '29/08/2026',
    remaining: '6 ngày',
    state: 'near',
  },
  {
    lot: 'L2508-B',
    sku: 'BR-TN2385',
    name: 'Mực in Brother TN-2385',
    warehouse: 'Kho HN-1',
    onHand: '6',
    mfgDate: '08/2025',
    expiry: '02/09/2026',
    remaining: '10 ngày',
    state: 'near',
  },
  {
    lot: 'L2409-A',
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    warehouse: 'Kho HN-1',
    onHand: '46',
    mfgDate: '09/2024',
    expiry: '05/09/2026',
    remaining: '13 ngày',
    state: 'near',
  },
  {
    lot: 'L2409-D',
    sku: 'TP-BK48-200',
    name: 'Băng keo trong 48mm × 200y Tiến Phát',
    warehouse: 'Kho HN-1',
    onHand: '96',
    mfgDate: '09/2024',
    expiry: '08/09/2026',
    remaining: '16 ngày',
    state: 'near',
  },
  {
    lot: 'L2508-C',
    sku: 'TL-WB03-BL',
    name: 'Bút lông bảng Thiên Long WB-03 xanh',
    warehouse: 'Kho HCM-2',
    onHand: '480',
    mfgDate: '08/2025',
    expiry: '11/09/2026',
    remaining: '19 ngày',
    state: 'near',
  },
  {
    lot: 'L2508-D',
    sku: 'TL-HL01-Y',
    name: 'Bút dạ quang Thiên Long HL-01 vàng',
    warehouse: 'Kho HN-1',
    onHand: '960',
    mfgDate: '08/2025',
    expiry: '14/09/2026',
    remaining: '22 ngày',
    state: 'near',
  },
  {
    lot: 'L2509-A',
    sku: 'DL-E300',
    name: 'Gôm tẩy Deli E300 (vỉ 3)',
    warehouse: 'Kho HCM-2',
    onHand: '300',
    mfgDate: '09/2025',
    expiry: '19/09/2026',
    remaining: '27 ngày',
    state: 'near',
  },
  {
    lot: 'L2510-A',
    sku: 'CN-325',
    name: 'Mực in Canon 325',
    warehouse: 'Kho HN-1',
    onHand: '7',
    mfgDate: '10/2025',
    expiry: '30/09/2026',
    remaining: '38 ngày',
    state: 'ok',
  },
  {
    lot: 'L2510-B',
    sku: 'TL-WB03-BL',
    name: 'Bút lông bảng Thiên Long WB-03 xanh',
    warehouse: 'Kho HN-1',
    onHand: '1680',
    mfgDate: '10/2025',
    expiry: '12/10/2026',
    remaining: '50 ngày',
    state: 'ok',
  },
  {
    lot: 'L2512-A',
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    warehouse: 'Kho HCM-2',
    onHand: '0',
    mfgDate: '12/2025',
    expiry: '10/12/2026',
    remaining: '109 ngày',
    state: 'empty',
  },
  {
    lot: 'L2607-A',
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    warehouse: 'Kho HN-1',
    onHand: '9600',
    mfgDate: '07/2026',
    expiry: '07/2029',
    remaining: '1070 ngày',
    state: 'ok',
  },
  {
    lot: 'L2608-B',
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    warehouse: 'Kho HN-1',
    onHand: '8800',
    mfgDate: '08/2026',
    expiry: '08/2029',
    remaining: '1101 ngày',
    state: 'ok',
  },
  {
    lot: 'L2608-C',
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    warehouse: 'Kho HCM-2',
    onHand: '6200',
    mfgDate: '08/2026',
    expiry: '08/2029',
    remaining: '1101 ngày',
    state: 'ok',
  },
];

const STATE_BADGE: Record<LotState, { tone: 'err' | 'warn' | 'ok' | 'neutral'; label: string }> = {
  expired: { tone: 'err', label: 'Hết hạn' },
  near: { tone: 'warn', label: 'Sắp hết hạn' },
  ok: { tone: 'ok', label: 'Còn hạn' },
  empty: { tone: 'neutral', label: 'Đã xuất hết' },
};

const ROW_BG: Record<LotState, string | undefined> = {
  expired: 'bg-destructive/10 hover:bg-destructive/10',
  near: 'bg-warning/10 hover:bg-warning/10',
  ok: undefined,
  empty: undefined,
};

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

export function LotsScreen() {
  return (
    <>
      <PageHeader
        title="Lô & hạn dùng"
        description="1.284 lô đang có tồn · 27 SKU theo dõi HSD · xuất theo FEFO"
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Lô & hạn dùng' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button variant="outline" size="sm">
              Tạo phiếu điều chỉnh
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-0.5 rounded-md border border-l-4 border-l-destructive bg-card px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Đã hết hạn, còn tồn</span>
          <span className="text-xl font-semibold tabular-nums text-destructive">2 lô</span>
          <span className="text-xs text-muted-foreground">6 đơn vị · chặn xuất, cần phiếu hủy</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-md border border-l-4 border-l-warning bg-card px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Hết hạn trong 30 ngày</span>
          <span className="text-xl font-semibold tabular-nums text-warning">12 lô</span>
          <span className="text-xs text-muted-foreground">2.826 đơn vị · giá vốn 14.380.000</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Hết hạn 31–90 ngày</span>
          <span className="text-xl font-semibold tabular-nums">8 lô</span>
          <span className="text-xs text-muted-foreground">ưu tiên bán trước theo FEFO</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Xuất sai FEFO (7 ngày)</span>
          <span className="text-xl font-semibold tabular-nums">3 lần</span>
          <span className="text-xs text-muted-foreground">
            có lý do ghi nhận · <span className="text-primary">xem</span>
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-64 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm lô, SKU, tên…</span>
        </div>
        <FilterChip>Kho: Tất cả ▾</FilterChip>
        <FilterChip active>Hết hạn trong 30 ngày ✕</FilterChip>
        <FilterChip>Đã hết hạn</FilterChip>
        <FilterChip>Còn tồn &gt; 0</FilterChip>
        <FilterChip dashed>
          <Filter className="h-3.5 w-3.5" /> Lọc
        </FilterChip>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sắp xếp: HSD gần nhất ▲</span>
          <span className="inline-flex items-center gap-1">
            <Columns3 className="h-3.5 w-3.5" /> Cột ▾
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả" />
                </TableHead>
                <TableHead className="w-24 px-2.5 text-xs">Lô</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">SKU</TableHead>
                <TableHead className="px-2.5 text-xs">Tên sản phẩm</TableHead>
                <TableHead className="w-24 px-2.5 text-xs">Kho</TableHead>
                <TableHead className="w-24 px-2.5 text-right text-xs">Tồn thực</TableHead>
                <TableHead className="w-20 px-2.5 text-xs">NSX</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">
                  HSD <span className="text-primary">↑</span>
                </TableHead>
                <TableHead className="w-28 px-2.5 text-right text-xs">Còn lại</TableHead>
                <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                <TableHead className="w-24 px-2.5 text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LOTS.map((r, i) => (
                <TableRow key={`${r.lot}-${i}`} className={ROW_BG[r.state]}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Chọn lô ${r.lot}`} />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {r.lot}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="max-w-64 truncate px-2.5 py-1.5" title={r.name}>
                    {r.name}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{r.warehouse}</TableCell>
                  <TableCell className={NUM_CELL}>{formatQuantity(r.onHand)}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{r.mfgDate}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{r.expiry}</TableCell>
                  <TableCell
                    className={cn(
                      NUM_CELL,
                      r.state === 'expired' && 'font-semibold text-destructive',
                      r.state === 'near' && 'font-semibold text-warning',
                    )}
                  >
                    {r.remaining}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone={STATE_BADGE[r.state].tone}>
                      {STATE_BADGE[r.state].label}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <button type="button" className="text-primary hover:underline">
                      Điều chỉnh
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 1.284</span>
          <span>·</span>
          <span>
            Bộ lọc &quot;30 ngày&quot; đang bật nhưng bảng vẫn hiện lô đã hết hạn để không bỏ sót
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="rounded border border-input px-1.5 py-0.5">‹</span>
            <span className="rounded border border-primary bg-primary px-1.5 py-0.5 text-primary-foreground">
              1
            </span>
            <span className="rounded border border-input px-1.5 py-0.5">2</span>
            <span className="px-1">…</span>
            <span className="rounded border border-input px-1.5 py-0.5">33</span>
            <span className="rounded border border-input px-1.5 py-0.5">›</span>
          </div>
        </div>
      </div>
    </>
  );
}
