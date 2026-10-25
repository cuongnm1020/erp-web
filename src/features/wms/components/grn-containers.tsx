'use client';

import { AlertTriangle, Check, Printer } from 'lucide-react';
import { useState } from 'react';
import { DraftInput } from '@/components/data/draft-input';
import { QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useReceiptContainers, type ReceiptContainers } from '../api/use-receipts';

const PAGE = 50;
type View = 'PENDING' | 'STORED' | 'ALL';

/**
 * "Thùng của phiếu" (2026-10-25, mockup ADxsASqeanb4ZeAUkwG3Av): phiếu nhập theo thùng có hàng
 * trăm thùng — thay vì đọc sổ cái từng dòng, thấy ngay đã cất / chưa cất (còn ở khu nhận), ở vị trí
 * nào, và danh sách thùng theo trạng thái (lọc + phân trang ở server). Bộ lọc là trạng thái tạm của
 * một khối trong trang chi tiết nên giữ trong state, không ghi lên URL của phiếu.
 */
export function GrnContainers({
  receiptId,
  labelCount,
  onPrintAll,
  onPrintOne,
}: {
  receiptId: string;
  /** Số tem "In tất cả" sẽ in (thùng + vỏ pallet bọc ngoài, theo các dòng đóng gói). */
  labelCount: number;
  onPrintAll: () => void;
  onPrintOne: (barcode: string) => void;
}) {
  const [view, setView] = useState<View>('PENDING');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const query = useReceiptContainers(receiptId, {
    view: view === 'ALL' ? undefined : view,
    q: q || undefined,
    take: PAGE,
    skip: page * PAGE,
  });
  const pick = (v: View) => {
    setView(v);
    setPage(0);
  };

  return (
    <section className="overflow-hidden rounded-md border bg-card" aria-labelledby="grn-box-title">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 id="grn-box-title" className="text-sm font-semibold">
          Thùng của phiếu
        </h2>
        {query.data ? (
          <span className="text-xs text-muted-foreground">{query.data.total} thùng chứa hàng</span>
        ) : null}
        <Button variant="outline" size="sm" className="ml-auto" onClick={onPrintAll}>
          <Printer aria-hidden />
          In tất cả tem thùng ({labelCount})
        </Button>
      </header>
      <QueryState
        query={query}
        skeleton={<Skeleton className="m-3 h-32" />}
        isEmpty={(d) => d.total === 0}
        empty={<p className="p-3 text-sm text-muted-foreground">Phiếu chưa có thùng nào.</p>}
      >
        {(data) => (
          <div>
            <Totals data={data} />
            <ByLocation data={data} onPick={pick} />
            <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <h3 className="text-sm font-semibold">Danh sách thùng</h3>
              <div role="tablist" aria-label="Lọc thùng" className="flex gap-1">
                {(
                  [
                    ['PENDING', `Chưa cất ${data.pending}`],
                    ['STORED', `Đã cất ${data.stored}`],
                    ['ALL', `Tất cả ${data.total}`],
                  ] as const
                ).map(([v, label]) => (
                  <Button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    size="sm"
                    variant={view === v ? 'secondary' : 'ghost'}
                    onClick={() => pick(v)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <DraftInput
                value={q}
                onCommit={(v) => {
                  setQ(v);
                  setPage(0);
                }}
                clearOnEscape
                aria-label="Tìm mã thùng"
                placeholder="Quét / gõ mã thùng"
                className="h-7 w-56"
              />
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {data.itemsTotal === 0
                  ? '0 thùng'
                  : `${page * PAGE + 1}–${Math.min((page + 1) * PAGE, data.itemsTotal)} / ${data.itemsTotal}`}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE >= data.itemsTotal}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
            {data.items.length === 0 ? (
              <p className="border-t p-3 text-sm text-muted-foreground">Không có thùng nào khớp.</p>
            ) : (
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="px-2.5 text-xs">Mã thùng</TableHead>
                      <TableHead className="px-2.5 text-right text-xs">SL trong thùng</TableHead>
                      <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
                      <TableHead className="px-2.5 text-xs">Trạng thái</TableHead>
                      <TableHead className="px-2.5 text-xs">Cất lúc</TableHead>
                      <TableHead className="px-2.5 text-xs">
                        <span className="sr-only">In lại tem</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          {c.barcode}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                          {formatQuantity(c.qty)}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          {c.locationCode}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          <StatusBadge tone={c.stored ? 'ok' : 'warn'}>
                            {c.stored ? 'Đã cất' : 'Chưa cất'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-muted-foreground">
                          {c.storedAt ? formatDateTime(c.storedAt) : '—'}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`In lại tem thùng ${c.barcode}`}
                            onClick={() => onPrintOne(c.barcode)}
                          >
                            <Printer aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}

function Totals({ data }: { data: ReceiptContainers }) {
  const pct = data.total > 0 ? Math.round((data.stored / data.total) * 100) : 0;
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-3">
      <div className="flex flex-col gap-0.5 rounded-md border px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <Check className="h-4 w-4" aria-hidden />
          Đã cất vào vị trí
        </span>
        <span className="text-xl font-semibold tabular-nums">{data.stored} thùng</span>
        <span className="text-xs text-muted-foreground">
          {formatQuantity(data.storedQty)} đơn vị
        </span>
      </div>
      <div
        className={cn(
          'flex flex-col gap-0.5 rounded-md border px-3 py-2.5',
          data.pending > 0 && 'border-warning-line bg-warning-weak text-warning',
        )}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {data.pending > 0 ? <AlertTriangle className="h-4 w-4" aria-hidden /> : null}
          Chưa cất
        </span>
        <span className="text-xl font-semibold tabular-nums">{data.pending} thùng</span>
        <span className={cn('text-xs', data.pending === 0 && 'text-muted-foreground')}>
          {formatQuantity(data.pendingQty)} đơn vị · còn ở khu nhận hàng
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
        <span className="text-sm font-semibold text-muted-foreground">Tiến độ cất hàng</span>
        <span className="text-xl font-semibold tabular-nums">
          {data.stored} / {data.total}
        </span>
        <div
          role="img"
          aria-label={`Đã cất ${data.stored} trên ${data.total} thùng`}
          className="h-2 overflow-hidden rounded-sm bg-muted"
        >
          <div className="h-full bg-success" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ByLocation({ data, onPick }: { data: ReceiptContainers; onPick: (v: View) => void }) {
  return (
    <div className="overflow-x-auto border-t">
      <Table>
        <caption className="px-3 py-2 text-left text-sm font-semibold">Theo vị trí</caption>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="px-2.5 text-xs">Vị trí</TableHead>
            <TableHead className="px-2.5 text-xs">Trạng thái</TableHead>
            <TableHead className="px-2.5 text-right text-xs">Số thùng</TableHead>
            <TableHead className="px-2.5 text-right text-xs">Số lượng</TableHead>
            <TableHead className="px-2.5 text-xs">Mã thùng</TableHead>
            <TableHead className="px-2.5 text-xs">
              <span className="sr-only">Xem thùng</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.byLocation.map((g) => (
            <TableRow key={g.locationId}>
              <TableCell className="px-2.5 py-1.5">
                <span className="font-mono text-xs">{g.locationCode}</span>
                {g.stored ? null : <span className="text-muted-foreground"> · khu nhận hàng</span>}
              </TableCell>
              <TableCell className="px-2.5 py-1.5">
                <StatusBadge tone={g.stored ? 'ok' : 'warn'}>
                  {g.stored ? 'Đã cất' : 'Chưa cất'}
                </StatusBadge>
              </TableCell>
              <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                {g.count}
              </TableCell>
              <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                {formatQuantity(g.qty)}
              </TableCell>
              <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                {g.count === 1 ? g.firstBarcode : `${g.firstBarcode} → ${g.lastBarcode}`}
              </TableCell>
              <TableCell className="px-2.5 py-1.5">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onPick(g.stored ? 'STORED' : 'PENDING')}
                >
                  Xem {g.count} thùng
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
