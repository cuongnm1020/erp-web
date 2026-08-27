'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Fragment } from 'react';
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
import { formatMoney } from '@/lib/format';

interface CostLayerRow {
  sourceDoc: string;
  receivedAt: string;
  /** string decimal */
  unitCost: string;
  qtyTaken: string;
  /** string decimal */
  cogs: string;
  layerLeft: string;
}

interface LedgerRow {
  time: string;
  doc: string;
  kind: string;
  kindTone: StatusTone;
  sku: string;
  lot: string;
  bin: string;
  qtyDelta: string;
  negative: boolean;
  balanceAfter: string;
  user: string;
  /** dòng đang mở drill-down cost layer FIFO */
  expanded?: boolean;
  costLayers?: CostLayerRow[];
}

const SAMPLE_ROWS: LedgerRow[] = [
  {
    time: '23/08 10:12',
    doc: 'GRN-2608-00087',
    kind: '+ Nhập',
    kindTone: 'ok',
    sku: 'DA-A4-80',
    lot: 'L2608',
    bin: 'B-01-01-A',
    qtyDelta: '+250',
    negative: false,
    balanceAfter: '1.250',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08 10:05',
    doc: 'SO-2608-01240',
    kind: 'Reserve',
    kindTone: 'brand',
    sku: 'TL08-BLUE',
    lot: '—',
    bin: '—',
    qtyDelta: '−96',
    negative: true,
    balanceAfter: 'không đổi',
    user: 'hệ thống',
  },
  {
    time: '23/08 09:58',
    doc: 'GDN-2608-01188',
    kind: '− Xuất',
    kindTone: 'err',
    sku: 'TL08-BLUE',
    lot: 'L2605',
    bin: 'A-03-02-B',
    qtyDelta: '−48',
    negative: true,
    balanceAfter: '1.192',
    user: 'Phạm Thị Hoa',
    expanded: true,
    costLayers: [
      {
        sourceDoc: 'GRN-2607-00061',
        receivedAt: '28/07/2026',
        unitCost: '2850',
        qtyTaken: '30',
        cogs: '85500',
        layerLeft: '0 — đóng lớp',
      },
      {
        sourceDoc: 'GRN-2608-00082',
        receivedAt: '23/08/2026',
        unitCost: '2900',
        qtyTaken: '18',
        cogs: '52200',
        layerLeft: '582',
      },
    ],
  },
  {
    time: '23/08 09:58',
    doc: 'GDN-2608-01188',
    kind: 'Release',
    kindTone: 'draft',
    sku: 'TL08-BLUE',
    lot: '—',
    bin: '—',
    qtyDelta: '+48',
    negative: false,
    balanceAfter: 'không đổi',
    user: 'hệ thống',
  },
  {
    time: '23/08 09:41',
    doc: 'SO-2608-01234',
    kind: 'Reserve',
    kindTone: 'brand',
    sku: 'TL08-BLUE',
    lot: '—',
    bin: '—',
    qtyDelta: '−48',
    negative: true,
    balanceAfter: 'không đổi',
    user: 'hệ thống',
  },
  {
    time: '23/08 09:31',
    doc: 'GRN-2608-00084',
    kind: '+ Nhập',
    kindTone: 'ok',
    sku: 'TL08-BLUE',
    lot: 'L2607',
    bin: 'A-03-02-B',
    qtyDelta: '+480',
    negative: false,
    balanceAfter: '1.240',
    user: 'Ngô Văn Tuấn',
  },
  {
    time: '23/08 09:12',
    doc: 'ADJ-2608-00012',
    kind: 'Điều chỉnh',
    kindTone: 'warn',
    sku: 'TL08-RED',
    lot: 'L2607',
    bin: 'A-03-02-B',
    qtyDelta: '−12',
    negative: true,
    balanceAfter: '468',
    user: 'Lê Minh Hùng',
  },
  {
    time: '23/08 08:55',
    doc: 'GDN-2608-01186',
    kind: '− Xuất',
    kindTone: 'err',
    sku: 'TL08-BLUE',
    lot: 'L2605',
    bin: 'A-03-02-B',
    qtyDelta: '−120',
    negative: true,
    balanceAfter: '760',
    user: 'Bùi Thị Mai',
  },
  {
    time: '23/08 08:55',
    doc: 'SO-2608-01201',
    kind: 'Release',
    kindTone: 'draft',
    sku: 'TL08-BLUE',
    lot: '—',
    bin: '—',
    qtyDelta: '+120',
    negative: false,
    balanceAfter: 'không đổi',
    user: 'hệ thống',
  },
  {
    time: '23/08 08:40',
    doc: 'SO-2608-01228',
    kind: 'Reserve',
    kindTone: 'brand',
    sku: 'TL08-BLUE',
    lot: '—',
    bin: '—',
    qtyDelta: '−72',
    negative: true,
    balanceAfter: 'không đổi',
    user: 'hệ thống',
  },
  {
    time: '23/08 08:22',
    doc: 'TRF-2608-00031',
    kind: '− Xuất chuyển kho',
    kindTone: 'err',
    sku: 'TL08-BLUE',
    lot: 'L2607',
    bin: 'A-03-02-B',
    qtyDelta: '−480',
    negative: true,
    balanceAfter: '880',
    user: 'Trần Văn Bảo',
  },
  {
    time: '23/08 08:10',
    doc: 'GDN-2608-01185',
    kind: '− Xuất',
    kindTone: 'err',
    sku: 'TL08-BLUE',
    lot: 'L2605',
    bin: 'A-03-02-B',
    qtyDelta: '−36',
    negative: true,
    balanceAfter: '1.360',
    user: 'Phạm Thị Hoa',
  },
  {
    time: '23/08 07:45',
    doc: 'GRN-2608-00082',
    kind: '+ Nhập',
    kindTone: 'ok',
    sku: 'TL08-BLUE',
    lot: 'L2605',
    bin: 'A-03-02-B',
    qtyDelta: '+600',
    negative: false,
    balanceAfter: '1.396',
    user: 'Ngô Văn Tuấn',
  },
  {
    time: '23/08 07:30',
    doc: 'STK-2608-00008',
    kind: 'Điều chỉnh kiểm kê',
    kindTone: 'warn',
    sku: 'TL08-BLUE',
    lot: 'L2603',
    bin: 'A-03-01-B',
    qtyDelta: '−4',
    negative: true,
    balanceAfter: '796',
    user: 'Lê Minh Hùng',
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

export function StockLedgerScreen() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Sổ cái chuyển động tồn"
        description="Mỗi thay đổi tồn là một dòng bất biến — nguồn sự thật của mọi con số tồn kho"
        breadcrumb={[{ label: 'Kho' }, { label: 'Sổ cái tồn' }]}
        actions={
          <>
            <StatusBadge tone="neutral">Chỉ đọc · append-only</StatusBadge>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button variant="outline" size="sm">
              Đối chiếu tồn ↔ sổ
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">Tìm chứng từ, movement…</span>
        </div>
        <FilterChip active>
          SKU: TL08-BLUE <X className="h-3 w-3" aria-hidden />
        </FilterChip>
        <FilterChip active>
          Kho: HN-1 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          01/08 – 23/08/2026 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <FilterChip>
          Loại: Tất cả <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </FilterChip>
        <Button variant="ghost" size="sm">
          + Lọc
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Nhập +1.330 · Xuất −684 · ròng +646 trong khoảng lọc
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="px-2.5 text-primary">Thời gian ↓</TableHead>
                <TableHead className="px-2.5">Chứng từ</TableHead>
                <TableHead className="px-2.5">Loại</TableHead>
                <TableHead className="px-2.5">SKU</TableHead>
                <TableHead className="px-2.5">Lô</TableHead>
                <TableHead className="px-2.5">Vị trí</TableHead>
                <TableHead className="px-2.5 text-right">+/− SL</TableHead>
                <TableHead className="px-2.5 text-right">Tồn thực sau</TableHead>
                <TableHead className="px-2.5">Người</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((r, i) => (
                <Fragment key={`${r.doc}-${i}`}>
                  <TableRow className={r.expanded ? 'bg-secondary hover:bg-secondary' : undefined}>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {r.expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {r.time}
                      </span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                      {r.doc}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.kindTone}>{r.kind}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.lot}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.bin}</TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right font-semibold tabular-nums',
                        r.negative ? 'text-destructive' : 'text-success',
                      )}
                    >
                      {r.qtyDelta}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.balanceAfter === 'không đổi' ? (
                        <span className="text-muted-foreground">không đổi</span>
                      ) : (
                        <span className="font-semibold">{r.balanceAfter}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.user}</TableCell>
                  </TableRow>
                  {r.expanded && r.costLayers ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="bg-muted/50 px-4 py-3">
                        <div className="max-w-3xl overflow-hidden rounded-md border bg-card">
                          <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                            <span className="font-semibold">
                              Cost layer FIFO tiêu thụ — movement MV-8841902 · 48 cái TL08-BLUE
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              wms.consume_fifo()
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted hover:bg-muted">
                                  <TableHead className="px-2.5">
                                    Lớp giá vốn (từ phiếu nhập)
                                  </TableHead>
                                  <TableHead className="px-2.5">Ngày nhập</TableHead>
                                  <TableHead className="px-2.5 text-right">Đơn giá vốn</TableHead>
                                  <TableHead className="px-2.5 text-right">SL lấy</TableHead>
                                  <TableHead className="px-2.5 text-right">Giá trị COGS</TableHead>
                                  <TableHead className="px-2.5 text-right">Lớp còn lại</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {r.costLayers.map((c) => (
                                  <TableRow key={c.sourceDoc}>
                                    <TableCell className="px-2.5 py-1.5 font-mono text-xs text-primary">
                                      {c.sourceDoc}
                                    </TableCell>
                                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                                      {c.receivedAt}
                                    </TableCell>
                                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                                      {formatMoney(c.unitCost, { unit: '' })}
                                    </TableCell>
                                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                                      {c.qtyTaken}
                                    </TableCell>
                                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                                      {formatMoney(c.cogs, { unit: '' })}
                                    </TableCell>
                                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                                      {c.layerLeft}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell className="px-2.5 py-1.5 font-semibold">
                                    Tổng COGS movement
                                  </TableCell>
                                  <TableCell className="px-2.5 py-1.5" />
                                  <TableCell className="px-2.5 py-1.5" />
                                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                                    48
                                  </TableCell>
                                  <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                                    {formatMoney('137700', { unit: '' })}
                                  </TableCell>
                                  <TableCell className="px-2.5 py-1.5" />
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–40 / 2.418 movement</span>
          <span>· Reserve/Release đổi &quot;đang giữ&quot;, không đổi tồn thực</span>
          <span className="ml-auto">Trang 1 / 61</span>
        </div>
      </div>
    </div>
  );
}
