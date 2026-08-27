'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown } from 'lucide-react';
import { KpiCard } from '@/components/data/kpi-card';
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

interface PoReceiveLine {
  no: number;
  productName: string;
  sku: string;
  unit: string;
  ordered: number;
  receivedBefore: number;
  receiveNow: string;
  diff: string;
  /** thừa = vàng · thiếu = xám · đủ = xanh */
  diffTone: 'ok' | 'over' | 'under';
  hint?: string;
  hintWarn?: boolean;
  lot: string;
  mfgDate: string;
  expiry: string;
  bin: string;
  focused?: boolean;
}

const SAMPLE_LINES: PoReceiveLine[] = [
  {
    no: 1,
    productName: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    unit: 'thùng',
    ordered: 100,
    receivedBefore: 50,
    receiveNow: '50',
    diff: 'đủ',
    diffTone: 'ok',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-01-A',
  },
  {
    no: 2,
    productName: 'Giấy A4 Double A 70gsm',
    sku: 'DA-A4-70',
    unit: 'thùng',
    ordered: 40,
    receivedBefore: 20,
    receiveNow: '20',
    diff: 'đủ',
    diffTone: 'ok',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-03-D',
  },
  {
    no: 3,
    productName: 'Giấy A4 IK Plus 70gsm',
    sku: 'IK-A4-70',
    unit: 'thùng',
    ordered: 30,
    receivedBefore: 12,
    receiveNow: '20',
    diff: '+2 thừa',
    diffTone: 'over',
    hint: 'NCC giao dôi 2 thùng — nhận được, ghi lý do, giá theo PO',
    hintWarn: true,
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-02-02-C',
  },
  {
    no: 4,
    productName: 'Giấy note 3M Post-it 76x76 vàng',
    sku: '3M-NOTE76',
    unit: 'thùng',
    ordered: 10,
    receivedBefore: 5,
    receiveNow: '3',
    diff: 'còn 2',
    diffTone: 'under',
    hint: 'NCC báo thiếu, giao nốt đợt sau — PO vẫn mở',
    lot: 'L2608',
    mfgDate: '05/2026',
    expiry: '05/2028',
    bin: 'A-02-01-C',
  },
  {
    no: 5,
    productName: 'Giấy in ảnh HP A4 180gsm (20 tờ)',
    sku: 'HP-PH180',
    unit: 'thùng',
    ordered: 6,
    receivedBefore: 3,
    receiveNow: '3',
    diff: 'đủ',
    diffTone: 'ok',
    lot: 'L2608',
    mfgDate: '05/2026',
    expiry: '05/2028',
    bin: 'C-01-02-A',
  },
  {
    no: 6,
    productName: 'Sổ lò xo Klong A4 200 trang',
    sku: 'KL-A4-200',
    unit: 'thùng',
    ordered: 8,
    receivedBefore: 0,
    receiveNow: '8',
    diff: 'đủ',
    diffTone: 'ok',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'A-01-02-B',
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

/** Ô nhập trong bảng — chỉ hiển thị, chưa nối logic */
function CellBox({
  value,
  state,
  select,
  mono,
  num,
  className,
}: {
  value?: string;
  state?: 'warn' | 'focus';
  select?: boolean;
  mono?: boolean;
  num?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-1 rounded border bg-background px-1.5 text-sm',
        state === 'warn' && 'border-warning bg-warning/10',
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

export function PoReceiveScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Nhận hàng đối chiếu PO-2608-00041"
        description="Công ty TNHH Giấy Double A VN · Kho HN-1 · phiếu nhập sẽ tạo: GRN (tự động) · ngày 23/08/2026"
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Đơn mua (PO)', href: '/wms/po' },
          { label: 'PO-2608-00041' },
          { label: 'Nhận hàng' },
        ]}
        actions={
          <>
            <StatusBadge tone="warn">Nhận một phần · lần 2</StatusBadge>
            <Button variant="ghost" size="sm">
              Hủy bỏ <Kbd>Esc</Kbd>
            </Button>
            <Button variant="outline" size="sm">
              Lưu nháp <Kbd>Alt S</Kbd>
            </Button>
            <Button size="sm">
              Tạo &amp; post phiếu nhập <Kbd>Alt ↵</Kbd>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng đặt (kiện)" value="194" detail="6 dòng" />
        <KpiCard label="Đã nhận trước" value="90" detail="GRN-2608-00079 · 18/08" />
        <KpiCard
          label="Nhận lần này"
          value={<span className="text-primary">104</span>}
          detail="1 dòng thừa · 1 dòng thiếu"
        />
        <KpiCard label="Còn lại sau lần này" value="4" detail="PO vẫn mở chờ giao nốt" />
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Đối chiếu theo dòng PO</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Kbd>Tab</Kbd> đi ngang dòng · <Kbd>↵</Kbd> xuống dòng dưới · quét barcode để nhảy đúng
            dòng
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">#</TableHead>
                <TableHead className="px-2.5">Sản phẩm</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">Đặt</TableHead>
                <TableHead className="px-2.5 text-right">Đã nhận trước</TableHead>
                <TableHead className="px-2.5 text-right">Nhận lần này</TableHead>
                <TableHead className="px-2.5 text-right">Chênh lệch</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">NSX</TableHead>
                <TableHead className="px-2.5">HSD</TableHead>
                <TableHead className="px-2.5">Vị trí cất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LINES.map((l) => (
                <TableRow
                  key={l.no}
                  className={
                    l.diffTone === 'over' ? 'bg-warning/10 hover:bg-warning/10' : undefined
                  }
                >
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <div className="font-semibold">{l.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.unit}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.ordered}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {l.receivedBefore}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox
                      value={l.receiveNow}
                      num
                      state={l.diffTone === 'over' ? 'warn' : l.focused ? 'focus' : undefined}
                      className="ml-auto w-20"
                    />
                    {l.hint ? (
                      <div
                        className={cn(
                          'mt-0.5 text-right text-xs',
                          l.hintWarn ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {l.hint}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right">
                    <span
                      className={cn(
                        l.diffTone === 'ok' && 'font-semibold text-success',
                        l.diffTone === 'over' && 'font-semibold text-warning',
                        l.diffTone === 'under' && 'text-muted-foreground',
                      )}
                    >
                      {l.diff}
                    </span>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <CellBox value={l.lot} mono className="w-24" />
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            Thừa = vàng (nhận được, ghi lý do) · Thiếu = xám (PO mở chờ giao nốt) · chỉ chặn khi
            vượt quá 10% giá trị PO
          </span>
          <span className="ml-auto">
            Sẽ ghi 104 kiện = <b className="font-semibold text-foreground">27.140</b> đơn vị cơ bản
          </span>
        </div>
      </div>
    </div>
  );
}
