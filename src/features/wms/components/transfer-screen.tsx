'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ArrowLeftRight, Check } from 'lucide-react';
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

interface TransferLine {
  no: number;
  productName: string;
  sku: string;
  lot: string;
  expiry: string;
  unit: string;
  qtyOut: string;
  qtyIn: string;
  diff: string;
  sourceBin: string;
  targetBin: string;
}

const SAMPLE_LINES: TransferLine[] = [
  {
    no: 1,
    productName: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    lot: 'L2608',
    expiry: '—',
    unit: 'ream',
    qtyOut: '120',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'B-01-01-A',
    targetBin: 'HCM · B-02',
  },
  {
    no: 2,
    productName: 'Giấy A4 Double A 70gsm',
    sku: 'DA-A4-70',
    lot: 'L2608',
    expiry: '—',
    unit: 'ream',
    qtyOut: '60',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'B-01-03-D',
    targetBin: 'HCM · B-02',
  },
  {
    no: 3,
    productName: 'Bút bi Thiên Long TL-08 xanh',
    sku: 'TL08-BLUE',
    lot: 'L2607',
    expiry: '12/2028',
    unit: 'cái',
    qtyOut: '480',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'A-03-02-B',
    targetBin: 'HCM · A-11',
  },
  {
    no: 4,
    productName: 'Sổ tay Campus A5 120 trang',
    sku: 'CP-A5-120',
    lot: 'L2608',
    expiry: '—',
    unit: 'cuốn',
    qtyOut: '200',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'A-01-02-B',
    targetBin: 'HCM · A-14',
  },
  {
    no: 5,
    productName: 'Mực in HP 305 đen',
    sku: 'HP-305-BK',
    lot: 'L2606',
    expiry: '03/2028',
    unit: 'hộp',
    qtyOut: '24',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'C-01-01-A',
    targetBin: 'HCM · C-03',
  },
  {
    no: 6,
    productName: 'Băng keo trong 48mm x 100y Tiến Phát',
    sku: 'TP-BK48-100',
    lot: 'L2608',
    expiry: '08/2028',
    unit: 'cây',
    qtyOut: '180',
    qtyIn: 'chưa nhận',
    diff: '—',
    sourceBin: 'B-02-02-C',
    targetBin: 'HCM · B-05',
  },
];

function RoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex h-8 items-center rounded-md bg-muted px-2 text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

export function TransferScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="TRF-2608-00031"
        description="Kho HN-1 → Kho HCM-2 · tạo bởi Lê Minh Hùng · 22/08/2026 15:02"
        breadcrumb={[{ label: 'Kho' }, { label: 'Chuyển kho' }, { label: 'TRF-2608-00031' }]}
        actions={
          <>
            <StatusBadge tone="warn">Đã xuất · chờ nhận</StatusBadge>
            <span className="inline-flex overflow-hidden rounded-md border text-sm">
              <span className="bg-secondary px-2.5 py-1 font-semibold text-primary">
                Chuyển kho
              </span>
              <span className="border-l px-2.5 py-1 text-muted-foreground">Chuyển vị trí</span>
            </span>
            <Button variant="outline" size="sm">
              In phiếu
            </Button>
            <Button size="sm">Xác nhận đã nhận tại HCM-2</Button>
          </>
        }
      />

      {/* Hai bước của phiếu chuyển kho */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-2.5 rounded-md border border-success/50 bg-success/10 px-3 py-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-primary-foreground">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <div className="text-sm font-semibold">Bước 1 · Đã xuất khỏi Kho HN-1</div>
            <div className="text-xs text-muted-foreground">
              22/08/2026 16:40 · Trần Văn Bảo · GDN-2608-01180 đã post
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-md border border-primary/50 bg-secondary px-3 py-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            2
          </span>
          <div>
            <div className="text-sm font-semibold">Bước 2 · Chờ nhận tại Kho HCM-2</div>
            <div className="text-xs text-muted-foreground">
              Dự kiến về 24/08 · xe 51C-882.10 · người nhận sẽ post GRN khi kiểm đủ
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
        <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <b className="font-semibold">Hàng đang trung chuyển: 1.064 đơn vị.</b> Tồn thực HN-1 đã
          trừ lúc xuất; HCM-2 chỉ cộng khi xác nhận nhận. Trong lúc đó tồn nằm ở kho ảo{' '}
          <b className="font-semibold">Kho trung chuyển</b> — tổng tồn toàn hệ thống không đổi.
        </div>
        <span className="ml-auto whitespace-nowrap text-primary">Xem movement</span>
      </div>

      <div className="rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <RoField label="Từ kho" value="Kho HN-1" />
          <RoField label="Đến kho" value="Kho HCM-2" />
          <RoField label="Ngày xuất" value="22/08/2026" />
          <RoField label="Vận chuyển" value="Xe công ty · 51C-882.10" />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Dòng chuyển · 6 dòng · 1.064 đơn vị cơ bản</span>
          <span className="text-xs text-muted-foreground">
            Chênh lệch xuất/nhận sẽ hiện ở đây sau bước 2
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">#</TableHead>
                <TableHead className="px-2.5">Sản phẩm</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">HSD</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">SL xuất</TableHead>
                <TableHead className="px-2.5 text-right">SL nhận</TableHead>
                <TableHead className="px-2.5 text-right">Chênh lệch</TableHead>
                <TableHead className="px-2.5">Vị trí nguồn</TableHead>
                <TableHead className="px-2.5">Vị trí đích (gợi ý)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LINES.map((l) => (
                <TableRow key={l.no}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.lot}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{l.expiry}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.unit}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                    {l.qtyOut}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">
                    {l.qtyIn}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right text-muted-foreground">
                    {l.diff}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.sourceBin}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.targetBin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className={cn('border-t px-3 py-1.5 text-xs text-muted-foreground')}>
          Phiếu 2 bước: mỗi bước post một chứng từ riêng (GDN tại kho đi, GRN tại kho đến) — không
          có &quot;sửa nhanh&quot; tồn hai kho cùng lúc
        </div>
      </div>
    </div>
  );
}
