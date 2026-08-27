'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, UserRound } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
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

interface PickLine {
  no: number;
  productName: string;
  sku: string;
  bin: string;
  assignedLot: string;
  /** lô thực pick khác lô chỉ định (sai lô có lý do) */
  pickedLot?: string;
  lotWarnReason?: string;
  expiry: string;
  unit: string;
  picked: number;
  required: number;
  status: string;
  statusTone: StatusTone;
}

const SAMPLE_PICK_LINES: PickLine[] = [
  {
    no: 1,
    productName: 'Bút bi Thiên Long TL-08 xanh',
    sku: 'TL08-BLUE',
    bin: 'A-03-02-B',
    assignedLot: 'L2605',
    expiry: '10/2028',
    unit: 'cái',
    picked: 48,
    required: 48,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 2,
    productName: 'Bút bi Thiên Long TL-08 đỏ',
    sku: 'TL08-RED',
    bin: 'A-03-02-B',
    assignedLot: 'L2607',
    expiry: '12/2028',
    unit: 'cái',
    picked: 24,
    required: 24,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 3,
    productName: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    bin: 'B-01-01-A',
    assignedLot: 'L2608',
    expiry: '—',
    unit: 'ream',
    picked: 60,
    required: 60,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 4,
    productName: 'Giấy A4 Double A 70gsm',
    sku: 'DA-A4-70',
    bin: 'B-01-03-D',
    assignedLot: 'L2608',
    expiry: '—',
    unit: 'ream',
    picked: 20,
    required: 20,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 5,
    productName: 'Băng keo trong 48mm × 100y Tiến Phát',
    sku: 'TP-BK48-100',
    bin: 'B-02-02-C',
    assignedLot: 'L2605',
    pickedLot: 'L2607',
    lotWarnReason: 'Sai lô có lý do: lô L2605 không còn ở vị trí — đã ghi log, chờ kiểm ô',
    expiry: '08/2028',
    unit: 'cây',
    picked: 36,
    required: 36,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 6,
    productName: 'Sổ tay Campus A5 120 trang',
    sku: 'CP-A5-120',
    bin: 'A-01-02-B',
    assignedLot: 'L2608',
    expiry: '—',
    unit: 'cuốn',
    picked: 40,
    required: 40,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 7,
    productName: 'Keo dán giấy UHU Stic 21g',
    sku: 'UHU-21',
    bin: 'A-02-01-C',
    assignedLot: 'L2601',
    expiry: '15/09/2026',
    unit: 'cây',
    picked: 12,
    required: 12,
    status: 'Đã lấy',
    statusTone: 'ok',
  },
  {
    no: 8,
    productName: 'Kẹp giấy Plus 50mm (hộp 12)',
    sku: 'PL-KG50',
    bin: 'A-02-01-C',
    assignedLot: 'L2607',
    expiry: '—',
    unit: 'hộp',
    picked: 4,
    required: 10,
    status: 'Đang lấy',
    statusTone: 'brand',
  },
  {
    no: 9,
    productName: 'Bấm kim Deli 0326 số 10',
    sku: 'DL-0326',
    bin: 'C-02-03-B',
    assignedLot: 'L2606',
    expiry: '—',
    unit: 'cái',
    picked: 0,
    required: 6,
    status: 'Chờ',
    statusTone: 'neutral',
  },
  {
    no: 10,
    productName: 'Mực in HP 305 đen',
    sku: 'HP-305-BK',
    bin: 'C-01-01-A',
    assignedLot: 'L2606',
    expiry: '03/2028',
    unit: 'hộp',
    picked: 0,
    required: 4,
    status: 'Chờ',
    statusTone: 'neutral',
  },
  {
    no: 11,
    productName: 'Giấy note 3M Post-it 76×76 vàng',
    sku: '3M-NOTE76',
    bin: 'A-02-01-C',
    assignedLot: 'L2512',
    expiry: '31/08/2026',
    unit: 'tập',
    picked: 0,
    required: 10,
    status: 'Chờ',
    statusTone: 'neutral',
  },
  {
    no: 12,
    productName: 'Bìa lá Kokuyo A4 xanh dương',
    sku: 'KK-BL-A4',
    bin: 'D-01-01-A',
    assignedLot: 'L2604',
    expiry: '—',
    unit: 'cái',
    picked: 0,
    required: 30,
    status: 'Chờ',
    statusTone: 'neutral',
  },
];

export function GdnDetailScreen({ id }: { id?: string }) {
  const docNo = id && id !== 'sample' ? id : 'GDN-2608-01192';

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={docNo}
        description="Đơn SO-2608-01234 · Cửa hàng Minh Tâm · Kho HN-1 · Wave W-0823-03"
        breadcrumb={[{ label: 'Kho' }, { label: 'Xuất kho', href: '/wms/gdn' }, { label: docNo }]}
        actions={
          <>
            <StatusBadge tone="brand">Đang pick</StatusBadge>
            <StatusBadge tone="neutral">Bán hàng</StatusBadge>
            <Button variant="outline" size="sm">
              In phiếu pick
            </Button>
            <Button variant="outline" size="sm">
              Gán lại người pick
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Dừng pick
            </Button>
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="text-foreground">
          <b className="font-semibold">Phạm Thị Hoa đang pick</b> trên PDA-07 · bắt đầu 09:41 · dòng
          hiện tại: 8/12 · 1 cảnh báo sai lô có lý do.
        </div>
        <span className="ml-auto whitespace-nowrap font-semibold text-foreground">
          7/12 dòng xong
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-8 px-2.5">#</TableHead>
                  <TableHead className="px-2.5">Sản phẩm</TableHead>
                  <TableHead className="px-2.5">Vị trí</TableHead>
                  <TableHead className="px-2.5">Lô hệ thống chỉ định</TableHead>
                  <TableHead className="px-2.5">HSD</TableHead>
                  <TableHead className="px-2.5">ĐVT</TableHead>
                  <TableHead className="px-2.5 text-right">Đã lấy / Cần lấy</TableHead>
                  <TableHead className="px-2.5">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_PICK_LINES.map((l) => (
                  <TableRow
                    key={l.no}
                    className={l.pickedLot ? 'bg-warning/10 hover:bg-warning/10' : undefined}
                  >
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="font-semibold">{l.productName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{l.bin}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {l.pickedLot ? (
                        <>
                          <span className="font-mono text-xs text-muted-foreground line-through">
                            {l.assignedLot}
                          </span>{' '}
                          →{' '}
                          <span className="font-mono text-xs font-semibold text-warning">
                            {l.pickedLot}
                          </span>
                          <div className="text-xs text-warning">{l.lotWarnReason}</div>
                        </>
                      ) : (
                        <span className="font-mono text-xs">{l.assignedLot}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{l.expiry}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.unit}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      <span
                        className={cn(
                          'font-semibold',
                          l.picked === l.required && l.required > 0 && 'text-success',
                          l.picked === 0 && 'font-normal text-muted-foreground',
                        )}
                      >
                        {l.picked}
                      </span>{' '}
                      / {l.required}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={l.statusTone}>{l.status}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>Lộ trình pick tối ưu theo vị trí: Khu A → B → C → D</span>
            <span className="ml-auto">
              Tổng: <b className="font-semibold text-foreground">204 / 300</b> đơn vị
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Tiến độ</div>
            <div className="flex flex-col gap-2.5 px-3 py-2.5 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dòng đã xong</span>
                  <span className="font-semibold tabular-nums">7/12</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-7/12 bg-primary" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bắt đầu</span>
                <span className="tabular-nums">09:41</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dự kiến xong</span>
                <span className="tabular-nums">10:35</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SLA giao vận</span>
                <span className="font-semibold text-warning">11:00 · còn 32 phút</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Tồn của phiếu này</div>
            <div className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Đang giữ (reserve)</span>
                <span className="font-semibold tabular-nums">300</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sẽ trừ tồn thực khi</span>
                <span>Post phiếu</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Giữ chỗ tạo lúc xác nhận đơn; tồn thực chỉ trừ khi phiếu xuất post xong. Hai bước
                tách biệt.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Cảnh báo</div>
            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-2 py-1.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <div>
                  Dòng 5 pick lô <span className="font-mono text-xs">L2607</span> thay vì{' '}
                  <span className="font-mono text-xs">L2605</span> (FEFO). Lý do đã ghi.{' '}
                  <span className="text-primary">Tạo kiểm kê ô B-02-02-C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
