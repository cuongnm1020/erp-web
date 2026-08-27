'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { BarChart3, Lock } from 'lucide-react';
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
import { formatMoney } from '@/lib/format';

interface GrnLine {
  no: number;
  productName: string;
  sku: string;
  unit: string;
  qtyPacked: string;
  baseEquivalent: string;
  lot: string;
  expiry: string;
  bin: string;
  /** string decimal */
  unitPrice: string;
  /** string decimal */
  amount: string;
}

const SAMPLE_LINES: GrnLine[] = [
  {
    no: 1,
    productName: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    unit: 'thùng',
    qtyPacked: '50',
    baseEquivalent: '= 250 ream',
    lot: 'L2608',
    expiry: '—',
    bin: 'B-01-01-A',
    unitPrice: '340000',
    amount: '17000000',
  },
  {
    no: 2,
    productName: 'Giấy A4 Double A 70gsm',
    sku: 'DA-A4-70',
    unit: 'thùng',
    qtyPacked: '20',
    baseEquivalent: '= 100 ream',
    lot: 'L2608',
    expiry: '—',
    bin: 'B-01-03-D',
    unitPrice: '305000',
    amount: '6100000',
  },
  {
    no: 3,
    productName: 'Giấy A4 IK Plus 70gsm',
    sku: 'IK-A4-70',
    unit: 'thùng',
    qtyPacked: '12',
    baseEquivalent: '= 60 ream',
    lot: 'L2608',
    expiry: '—',
    bin: 'B-02-02-C',
    unitPrice: '282500',
    amount: '3390000',
  },
  {
    no: 4,
    productName: 'Giấy note 3M Post-it 76×76 vàng',
    sku: '3M-NOTE76',
    unit: 'thùng',
    qtyPacked: '5',
    baseEquivalent: '= 120 tập',
    lot: 'L2608',
    expiry: '05/2028',
    bin: 'A-02-01-C',
    unitPrice: '504000',
    amount: '2520000',
  },
  {
    no: 5,
    productName: 'Giấy in ảnh HP A4 180gsm (20 tờ)',
    sku: 'HP-PH180',
    unit: 'thùng',
    qtyPacked: '3',
    baseEquivalent: '= 60 tập',
    lot: 'L2608',
    expiry: '05/2028',
    bin: 'C-01-02-A',
    unitPrice: '1160000',
    amount: '3480000',
  },
];

interface MovementRow {
  time: string;
  movement: string;
  sku: string;
  lot: string;
  bin: string;
  qtyDelta: string;
  balanceAfter: string;
  user: string;
}

const SAMPLE_MOVEMENTS: MovementRow[] = [
  {
    time: '23/08/2026 10:12:04',
    movement: 'MV-8842171',
    sku: 'DA-A4-80',
    lot: 'L2608',
    bin: 'B-01-01-A',
    qtyDelta: '+250',
    balanceAfter: '1.250',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08/2026 10:12:04',
    movement: 'MV-8842172',
    sku: 'DA-A4-70',
    lot: 'L2608',
    bin: 'B-01-03-D',
    qtyDelta: '+100',
    balanceAfter: '412',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08/2026 10:12:04',
    movement: 'MV-8842173',
    sku: 'IK-A4-70',
    lot: 'L2608',
    bin: 'B-02-02-C',
    qtyDelta: '+60',
    balanceAfter: '318',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08/2026 10:12:05',
    movement: 'MV-8842174',
    sku: '3M-NOTE76',
    lot: 'L2608',
    bin: 'A-02-01-C',
    qtyDelta: '+120',
    balanceAfter: '364',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08/2026 10:12:05',
    movement: 'MV-8842175',
    sku: 'HP-PH180',
    lot: 'L2608',
    bin: 'C-01-02-A',
    qtyDelta: '+60',
    balanceAfter: '214',
    user: 'Trần Văn Bảo',
  },
];

function RoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex h-8 items-center rounded-md bg-muted px-2 text-sm text-muted-foreground">
        <span className={mono ? 'font-mono text-xs' : undefined}>{value}</span>
      </div>
    </div>
  );
}

export function GrnDetailScreen({ id }: { id?: string }) {
  const docNo = id && id !== 'sample' ? id : 'GRN-2608-00087';

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={docNo}
        description="Tạo bởi Trần Văn Bảo · 23/08/2026 09:41 · Kho HN-1"
        breadcrumb={[{ label: 'Kho' }, { label: 'Nhập kho', href: '/wms/grn' }, { label: docNo }]}
        actions={
          <>
            <StatusBadge tone="ok">Đã post</StatusBadge>
            <StatusBadge tone="neutral">Từ PO</StatusBadge>
            <Button variant="outline" size="sm">
              In phiếu
            </Button>
            <Button size="sm">Tạo phiếu điều chỉnh</Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Hủy
            </Button>
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <div>
          <b className="font-semibold">Đã post lúc 10:12 bởi Trần Văn Bảo.</b> Chứng từ bất biến —
          mọi trường chỉ đọc. Sai sót → tạo phiếu điều chỉnh; hủy sẽ sinh phiếu đảo toàn bộ chuyển
          động, không xóa dữ liệu.
        </div>
      </div>

      <div className="rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <RoField label="Số phiếu" value={docNo} mono />
          <RoField label="Kho nhận" value="Kho HN-1" />
          <RoField label="Nhà cung cấp" value="Công ty TNHH Giấy Double A VN" />
          <RoField label="Tham chiếu PO" value="PO-2608-00041" mono />
          <RoField label="Ngày nhập" value="23/08/2026" />
          <RoField label="Số chứng từ NCC" value="HD-08-4472" mono />
          <RoField label="Tổng giá trị" value={formatMoney('31630000', { unit: '' })} />
          <RoField label="Ghi chú" value="Xe 29H-512.44 · giao đủ, thùng nguyên đai" />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-3 py-2 text-sm font-semibold">
          Dòng nhập · 5 dòng · 90 kiện = 790 đơn vị cơ bản
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">#</TableHead>
                <TableHead className="px-2.5">Sản phẩm</TableHead>
                <TableHead className="px-2.5">ĐVT</TableHead>
                <TableHead className="px-2.5 text-right">SL</TableHead>
                <TableHead className="px-2.5 text-right">Quy đổi</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">HSD</TableHead>
                <TableHead className="px-2.5">Vị trí cất</TableHead>
                <TableHead className="px-2.5 text-right">Đơn giá</TableHead>
                <TableHead className="px-2.5 text-right">Thành tiền</TableHead>
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
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.unit}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {l.qtyPacked}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                    {l.baseEquivalent}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.lot}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{l.expiry}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.bin}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatMoney(l.unitPrice, { unit: '' })}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                    {formatMoney(l.amount, { unit: '' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Chuyển động tồn đã ghi (sổ cái · chỉ đọc · append-only)
          </span>
          <span className="text-xs font-normal text-primary">Mở sổ cái tồn</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5">Thời gian</TableHead>
                <TableHead className="px-2.5">Movement</TableHead>
                <TableHead className="px-2.5">Loại</TableHead>
                <TableHead className="px-2.5">SKU</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">Vị trí</TableHead>
                <TableHead className="px-2.5 text-right">+/− SL (cơ bản)</TableHead>
                <TableHead className="px-2.5 text-right">Tồn sau</TableHead>
                <TableHead className="px-2.5">Người</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_MOVEMENTS.map((m) => (
                <TableRow key={m.movement}>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{m.time}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.movement}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <StatusBadge tone="ok">+ Nhập</StatusBadge>
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                    {m.sku}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.lot}</TableCell>
                  <TableCell className="px-2.5 py-1.5 font-mono text-xs">{m.bin}</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-success">
                    {m.qtyDelta}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    {m.balanceAfter}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">{m.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
