'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x: api chưa có
// GET /purchase-orders; phiếu tạo từ màn này sẽ là POST /goods-receipts kèm poId + `uom` mỗi dòng,
// cùng hợp đồng màn GRN).

import Decimal from 'decimal.js';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { KpiCard } from '@/components/data/kpi-card';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

/** Cùng regex với quantitySchema — guard trước khi new Decimal(). */
const QTY_RE = /^\d{1,12}(\.\d{1,6})?$/;

/** ĐVT nhập được của SKU: đơn vị bán chính (factor 1) + quy cách thùng / pallet khai ở form SP. */
interface UnitOption {
  code: string;
  label: string;
  /** Số đơn vị bán chính trong 1 ĐVT này — chuỗi decimal. */
  factor: string;
}

interface PoReceiveLine {
  no: number;
  productName: string;
  sku: string;
  /** Mã ĐVT của dòng PO — "Đặt" / "Đã nhận trước" tính theo ĐVT này. */
  poUnit: string;
  units: UnitOption[];
  ordered: string;
  receivedBefore: string;
  /** Mặc định: nhận theo ĐVT của PO, SL = phần còn thiếu (thủ kho sửa). */
  receiveNow: string;
  hint?: string;
  hintWarn?: boolean;
  lot: string;
  mfgDate: string;
  expiry: string;
  bin: string;
}

const units = (base: string, perCarton: string, perPallet?: string): UnitOption[] => [
  { code: 'BASE', label: base, factor: '1' },
  { code: 'CTN', label: 'thùng', factor: perCarton },
  ...(perPallet ? [{ code: 'PLT', label: 'pallet', factor: perPallet }] : []),
];

const SAMPLE_LINES: PoReceiveLine[] = [
  {
    no: 1,
    productName: 'Vua Bật Chồi 40gr (combo 10 gói)',
    sku: 'VBC-40G-10',
    poUnit: 'CTN',
    units: units('gói', '50', '2000'),
    ordered: '100',
    receivedBefore: '50',
    receiveNow: '50',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-01-A',
  },
  {
    no: 2,
    productName: 'Rooting Extra 500ml',
    sku: 'RTX-500',
    poUnit: 'CTN',
    units: units('chai', '20', '800'),
    ordered: '40',
    receivedBefore: '20',
    receiveNow: '20',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-01-03-D',
  },
  {
    no: 3,
    productName: 'Rooting 500ml',
    sku: 'RT-500',
    poUnit: 'CTN',
    units: units('chai', '20', '800'),
    ordered: '30',
    receivedBefore: '12',
    receiveNow: '20',
    hint: 'NCC giao dôi 2 thùng — nhận được, ghi lý do, giá theo PO',
    hintWarn: true,
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'B-02-02-C',
  },
  {
    no: 4,
    productName: 'Thuốc trừ sâu sinh học 250ml',
    sku: 'TSSH-250',
    poUnit: 'CTN',
    units: units('chai', '40'),
    ordered: '10',
    receivedBefore: '5',
    receiveNow: '3',
    hint: 'NCC báo thiếu, giao nốt đợt sau — PO vẫn mở',
    lot: 'L2608',
    mfgDate: '05/2026',
    expiry: '05/2028',
    bin: 'A-02-01-C',
  },
  {
    no: 5,
    productName: 'Phân bón lá NPK 20-20-20 1kg',
    sku: 'NPK-202020-1KG',
    poUnit: 'CTN',
    units: units('gói', '12', '480'),
    ordered: '6',
    receivedBefore: '3',
    receiveNow: '3',
    lot: 'L2608',
    mfgDate: '05/2026',
    expiry: '05/2028',
    bin: 'C-01-02-A',
  },
  {
    no: 6,
    productName: 'Purger (gói)',
    sku: 'PUR-GOI',
    poUnit: 'CTN',
    units: units('gói', '100'),
    ordered: '8',
    receivedBefore: '0',
    receiveNow: '8',
    lot: 'L2608',
    mfgDate: '08/2026',
    expiry: '—',
    bin: 'A-01-02-B',
  },
];

/** Lựa chọn của thủ kho trên một dòng: SL theo ĐVT nhập đang chọn. */
interface LineInput {
  qty: string;
  unit: string;
}

const factorOf = (l: PoReceiveLine, code: string) =>
  new Decimal(l.units.find((u) => u.code === code)?.factor ?? '1');
const labelOf = (l: PoReceiveLine, code: string) =>
  l.units.find((u) => u.code === code)?.label ?? code;

/**
 * Quy đổi một dòng về đơn vị bán chính (decimal.js — luật 10). `now` null khi SL chưa hợp lệ.
 * Chênh lệch tính trên đơn vị bán chính rồi hiển thị theo ĐVT của PO.
 */
function lineMath(l: PoReceiveLine, input: LineInput) {
  const poFactor = factorOf(l, l.poUnit);
  const orderedBase = new Decimal(l.ordered).mul(poFactor);
  const beforeBase = new Decimal(l.receivedBefore).mul(poFactor);
  const now = QTY_RE.test(input.qty) ? new Decimal(input.qty).mul(factorOf(l, input.unit)) : null;
  const remaining = now ? orderedBase.sub(beforeBase).sub(now) : null;
  return { poFactor, now, remaining };
}

function diffOf(l: PoReceiveLine, remaining: Decimal | null) {
  if (remaining === null) return { tone: 'under' as const, text: '—' };
  const inPoUnit = (d: Decimal) =>
    `${formatQuantity(d.abs().toString(), { factor: factorOf(l, l.poUnit).toString() })} ${labelOf(l, l.poUnit)}`;
  if (remaining.isZero()) return { tone: 'ok' as const, text: 'đủ' };
  if (remaining.isNegative())
    return { tone: 'over' as const, text: `+${inPoUnit(remaining)} thừa` };
  return { tone: 'under' as const, text: `còn ${inPoUnit(remaining)}` };
}

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
  const [inputs, setInputs] = useState<Record<number, LineInput>>(() =>
    Object.fromEntries(SAMPLE_LINES.map((l) => [l.no, { qty: l.receiveNow, unit: l.poUnit }])),
  );
  const setLine = (no: number, patch: Partial<LineInput>) =>
    setInputs((cur) => ({ ...cur, [no]: { ...cur[no]!, ...patch } }));

  const rows = SAMPLE_LINES.map((l) => {
    const input = inputs[l.no]!;
    const math = lineMath(l, input);
    return { l, input, ...math, diff: diffOf(l, math.remaining) };
  });
  // KPI theo ĐVT của PO (kiện) — dòng đổi sang gói / pallet vẫn quy về kiện để so với số đặt.
  const sum = (pick: (r: (typeof rows)[number]) => Decimal) =>
    rows.reduce((acc, r) => acc.add(pick(r)), new Decimal(0));
  const orderedPo = sum((r) => new Decimal(r.l.ordered));
  const beforePo = sum((r) => new Decimal(r.l.receivedBefore));
  const nowPo = sum((r) => (r.now ? r.now.div(r.poFactor) : new Decimal(0)));
  const nowBase = sum((r) => r.now ?? new Decimal(0));
  const overCount = rows.filter((r) => r.diff.tone === 'over').length;
  const underCount = rows.filter((r) => r.diff.tone === 'under').length;
  const leftPo = orderedPo.sub(beforePo).sub(nowPo);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Nhận hàng đối chiếu PO-2608-00041"
        description="Công ty TNHH Vật tư Nông nghiệp Xanh · Kho HN-1 · phiếu nhập sẽ tạo: GRN (tự động) · ngày 23/08/2026"
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
        <KpiCard
          label="Tổng đặt (kiện)"
          value={formatQuantity(orderedPo.toString())}
          detail={`${SAMPLE_LINES.length} dòng`}
        />
        <KpiCard
          label="Đã nhận trước"
          value={formatQuantity(beforePo.toString())}
          detail="GRN-2608-00079 · 18/08"
        />
        <KpiCard
          label="Nhận lần này"
          value={<span className="text-primary">{formatQuantity(nowPo.toString())}</span>}
          detail={`${overCount} dòng thừa · ${underCount} dòng thiếu`}
        />
        <KpiCard
          label="Còn lại sau lần này"
          value={formatQuantity(Decimal.max(leftPo, 0).toString())}
          detail={leftPo.gt(0) ? 'PO vẫn mở chờ giao nốt' : 'PO nhận đủ'}
        />
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
                <TableHead className="px-2.5">ĐVT PO</TableHead>
                <TableHead className="px-2.5 text-right">Đặt</TableHead>
                <TableHead className="px-2.5 text-right">Đã nhận trước</TableHead>
                <TableHead className="px-2.5">Nhận lần này · ĐVT nhập</TableHead>
                <TableHead className="px-2.5 text-right">Chênh lệch</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">NSX</TableHead>
                <TableHead className="px-2.5">HSD</TableHead>
                <TableHead className="px-2.5">Vị trí cất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ l, input, now, diff }) => {
                const base = l.units[0]!.label;
                return (
                  <TableRow
                    key={l.no}
                    className={
                      diff.tone === 'over' ? 'bg-warning/10 hover:bg-warning/10' : undefined
                    }
                  >
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{l.no}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="font-semibold">{l.productName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      {labelOf(l, l.poUnit)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {formatQuantity(l.ordered)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatQuantity(l.receivedBefore)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1">
                        <Input
                          inputMode="decimal"
                          value={input.qty}
                          onChange={(e) => setLine(l.no, { qty: e.target.value.trim() })}
                          aria-label={`Số lượng nhận dòng ${l.no}`}
                          className={cn(
                            'h-7 w-20 text-right tabular-nums',
                            diff.tone === 'over' && 'border-warning bg-warning/10',
                            input.qty !== '' && !QTY_RE.test(input.qty) && 'border-destructive',
                          )}
                        />
                        <Select
                          value={input.unit}
                          onValueChange={(unit) => setLine(l.no, { unit })}
                        >
                          <SelectTrigger className="h-7 w-32" aria-label={`ĐVT nhập dòng ${l.no}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {l.units.map((u) => (
                              <SelectItem key={u.code} value={u.code}>
                                {u.factor === '1'
                                  ? u.label
                                  : `${u.label} (${formatQuantity(u.factor)} ${base})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {now && input.unit !== 'BASE' ? (
                        <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          = {formatQuantity(now.toString())} {base}
                        </div>
                      ) : null}
                      {l.hint ? (
                        <div
                          className={cn(
                            'mt-0.5 text-xs',
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
                          diff.tone === 'ok' && 'font-semibold text-success',
                          diff.tone === 'over' && 'font-semibold text-warning',
                          diff.tone === 'under' && 'text-muted-foreground',
                        )}
                      >
                        {diff.text}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            ĐVT nhập: đơn vị bán chính hoặc quy cách thùng / pallet của sản phẩm — tự quy ra đơn vị
            bán chính. Thừa = vàng (nhận được, ghi lý do) · Thiếu = xám (PO mở chờ giao nốt) · chỉ
            chặn khi vượt quá 10% giá trị PO
          </span>
          <span className="ml-auto">
            Sẽ ghi {formatQuantity(nowPo.toString())} kiện ={' '}
            <b className="font-semibold text-foreground">{formatQuantity(nowBase.toString())}</b>{' '}
            đơn vị bán chính
          </span>
        </div>
      </div>
    </div>
  );
}
