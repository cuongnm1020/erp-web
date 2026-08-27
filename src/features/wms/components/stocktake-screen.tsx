'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Clock, Search, X } from 'lucide-react';
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
import { formatMoney, formatQuantity } from '@/lib/format';

const qty = (n: number) => formatQuantity(String(n));

interface StocktakeLine {
  no: number;
  sku: string;
  name: string;
  bin: string;
  lot: string;
  bookQty: number;
  countedQty: number;
  /** lệch dương/âm; 0 = khớp */
  diff: number;
  /** string decimal — chỉ có khi lệch */
  diffValue?: string;
  reason?: string;
  countedBy: string;
}

const SAMPLE_LINES: StocktakeLine[] = [
  {
    no: 1,
    sku: 'TL08-BLUE',
    name: 'Bút bi Thiên Long TL-08 xanh',
    bin: 'A-03-02-B',
    lot: 'L2607',
    bookQty: 1240,
    countedQty: 1240,
    diff: 0,
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 2,
    sku: 'TL08-RED',
    name: 'Bút bi Thiên Long TL-08 đỏ',
    bin: 'A-03-02-B',
    lot: 'L2607',
    bookQty: 480,
    countedQty: 468,
    diff: -12,
    diffValue: '-34800',
    reason: 'Rơi vỡ sau kệ',
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 3,
    sku: 'TL027-BLK',
    name: 'Bút bi Thiên Long TL-027 đen',
    bin: 'A-03-02-A',
    lot: 'L2605',
    bookQty: 360,
    countedQty: 360,
    diff: 0,
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 4,
    sku: 'DA-A4-80',
    name: 'Giấy A4 Double A 80gsm',
    bin: 'B-01-01-A',
    lot: 'L2608',
    bookQty: 1250,
    countedQty: 1250,
    diff: 0,
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 5,
    sku: 'DA-A4-70',
    name: 'Giấy A4 Double A 70gsm',
    bin: 'B-01-03-D',
    lot: 'L2608',
    bookQty: 412,
    countedQty: 410,
    diff: -2,
    diffValue: '-122000',
    reason: 'Chưa rõ — đề nghị kiểm lại',
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 6,
    sku: 'IK-A4-70',
    name: 'Giấy A4 IK Plus 70gsm',
    bin: 'B-02-02-C',
    lot: 'L2608',
    bookQty: 318,
    countedQty: 318,
    diff: 0,
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 7,
    sku: 'TP-BK48-100',
    name: 'Băng keo trong 48mm x 100y',
    bin: 'B-02-02-C',
    lot: 'L2605',
    bookQty: 46,
    countedQty: 58,
    diff: 12,
    diffValue: '98400',
    reason: 'Cất nhầm ô từ GRN-00082',
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 8,
    sku: 'TP-BK48-50',
    name: 'Băng keo trong 48mm x 50y',
    bin: 'B-02-02-C',
    lot: 'L2608',
    bookQty: 210,
    countedQty: 210,
    diff: 0,
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 9,
    sku: 'CP-A5-120',
    name: 'Sổ tay Campus A5 120 trang',
    bin: 'A-01-02-B',
    lot: 'L2608',
    bookQty: 760,
    countedQty: 752,
    diff: -8,
    diffValue: '-148000',
    reason: 'Xuất mẫu chưa ghi phiếu',
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 10,
    sku: 'KL-A4-200',
    name: 'Sổ lò xo Klong A4 200 trang',
    bin: 'A-01-02-B',
    lot: 'L2608',
    bookQty: 180,
    countedQty: 180,
    diff: 0,
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 11,
    sku: 'UHU-21',
    name: 'Keo dán giấy UHU Stic 21g',
    bin: 'A-02-01-C',
    lot: 'L2601',
    bookQty: 132,
    countedQty: 129,
    diff: -3,
    diffValue: '-52500',
    reason: 'Hỏng nắp, chảy keo',
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 12,
    sku: '3M-NOTE76',
    name: 'Giấy note 3M Post-it 76x76',
    bin: 'A-02-01-C',
    lot: 'L2512',
    bookQty: 364,
    countedQty: 364,
    diff: 0,
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 13,
    sku: 'HP-305-BK',
    name: 'Mực in HP 305 đen',
    bin: 'C-01-01-A',
    lot: 'L2606',
    bookQty: 214,
    countedQty: 213,
    diff: -1,
    diffValue: '-312000',
    reason: 'Mất — không tìm thấy',
    countedBy: 'Vũ Thị Lan',
  },
  {
    no: 14,
    sku: 'FX-DAO18',
    name: 'Dao rọc giấy Fixo 18mm',
    bin: 'C-02-03-B',
    lot: 'L2607',
    bookQty: 240,
    countedQty: 244,
    diff: 4,
    diffValue: '39200',
    reason: 'Trả hàng chưa nhập sổ',
    countedBy: 'Đỗ Quang Huy',
  },
  {
    no: 15,
    sku: 'KK-BL-A4',
    name: 'Bìa lá Kokuyo A4 xanh dương',
    bin: 'D-01-01-A',
    lot: 'L2604',
    bookQty: 520,
    countedQty: 505,
    diff: -15,
    diffValue: '-64500',
    reason: 'Ướt nước mưa — hỏng',
    countedBy: 'Đỗ Quang Huy',
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

export function StocktakeScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="STK-2608-00009"
        description="Kiểm kê Khu A + B + C · Kho HN-1 · 214 dòng · đếm mù (không hiện tồn sổ trên PDA)"
        breadcrumb={[{ label: 'Kho' }, { label: 'Kiểm kê' }, { label: 'STK-2608-00009' }]}
        actions={
          <>
            <StatusBadge tone="warn">Chờ duyệt chênh lệch</StatusBadge>
            <Button variant="outline" size="sm">
              In biên bản
            </Button>
            <Button variant="outline" size="sm">
              Yêu cầu đếm lại 2 dòng
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Từ chối
            </Button>
            <Button size="sm">Duyệt chênh lệch</Button>
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div>
          <b className="font-semibold">Đếm xong 22/08 17:30</b> bởi Vũ Thị Lan, Đỗ Quang Huy (PDA) ·
          9/214 dòng lệch · giá trị lệch ròng{' '}
          <b className="font-semibold">{formatMoney('-1031500', { unit: '' })}</b>. Chờ duyệt bởi{' '}
          <b className="font-semibold">Lê Minh Hùng (quản lý kho)</b>. Duyệt sẽ tự tạo phiếu điều
          chỉnh và ghi sổ cái; tồn sổ chưa thay đổi cho tới lúc đó.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm SKU trong phiếu…</span>
        </div>
        <FilterChip active>
          Chỉ dòng chênh lệch (9) <X className="h-3 w-3" aria-hidden />
        </FilterChip>
        <FilterChip>
          Khu: A, B, C <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Lý do: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <span className="ml-auto text-xs text-muted-foreground">
          Đang hiện cả dòng khớp để đối chiếu
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">#</TableHead>
                <TableHead className="px-2.5">SKU</TableHead>
                <TableHead className="px-2.5">Tên sản phẩm</TableHead>
                <TableHead className="px-2.5">Vị trí</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5 text-right">Tồn sổ</TableHead>
                <TableHead className="px-2.5 text-right">Đếm thực</TableHead>
                <TableHead className="px-2.5 text-right">Chênh lệch</TableHead>
                <TableHead className="px-2.5 text-right">Giá trị lệch</TableHead>
                <TableHead className="px-2.5">Lý do (bắt buộc khi lệch)</TableHead>
                <TableHead className="px-2.5">Người đếm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LINES.map((l) => (
                <TableRow
                  key={l.no}
                  className={l.diff !== 0 ? 'bg-warning/10 hover:bg-warning/10' : undefined}
                >
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {l.sku}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{l.name}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.bin}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.lot}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {qty(l.bookQty)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                    {qty(l.countedQty)}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.diff === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <span
                        className={cn(
                          'font-semibold',
                          l.diff < 0 ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {l.diff > 0 ? `+${qty(l.diff)}` : qty(l.diff)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.diffValue ? (
                      <span
                        className={cn(
                          'font-semibold',
                          l.diff < 0 ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {formatMoney(l.diffValue, { unit: '', signed: true })}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {l.reason ? (
                      <div className="flex h-7 w-48 items-center gap-1 rounded border border-input bg-background px-1.5 text-sm">
                        <span className="truncate">{l.reason}</span>
                        <ChevronDown
                          className="ml-auto h-3 w-3 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                    {l.countedBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>214 dòng · 9 lệch (4 thiếu, 2 thừa, 3 hỏng)</span>
          <span>
            · Giá trị lệch ròng:{' '}
            <b className="font-semibold text-destructive">
              {formatMoney('-1031500', { unit: '' })}
            </b>
          </span>
          <span className="ml-auto">Trang 1 / 6</span>
        </div>
      </div>
    </div>
  );
}
