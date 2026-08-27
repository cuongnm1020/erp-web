'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { formatMoney } from '@/lib/format';

interface PendingOrderRow {
  soNo: string;
  sale: string;
  customer: string;
  reasons: string[];
  total: string;
  waitingFor: string;
  overdue?: boolean;
  selected?: boolean;
}

const SAMPLE_PENDING: PendingOrderRow[] = [
  {
    soNo: 'SO-2608-01302',
    sale: 'Nguyễn Văn An',
    customer: 'Cửa hàng Minh Tâm',
    reasons: ['CK vượt trần 18% > 15%'],
    total: '1362400',
    waitingFor: '2 giờ 10 phút',
    selected: true,
  },
  {
    soNo: 'SO-2608-01295',
    sale: 'Lê Thị Hoa',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    reasons: ['Giá trị 68.500.000 > 50.000.000'],
    total: '68500000',
    waitingFor: '3 giờ 42 phút',
  },
  {
    soNo: 'SO-2608-01288',
    sale: 'Phạm Minh Đức',
    customer: 'Trường THCS Nguyễn Du',
    reasons: ['CK vượt trần 20% > 15%'],
    total: '12150000',
    waitingFor: '5 giờ 05 phút',
  },
  {
    soNo: 'SO-2608-01270',
    sale: 'Lê Thị Hoa',
    customer: 'Công ty CP Giáo dục Ánh Dương',
    reasons: ['Giá trị 53.900.000 > 50.000.000', 'CK 16% > 15%'],
    total: '53900000',
    waitingFor: '1 ngày 2 giờ',
    overdue: true,
  },
];

interface ReviewLine {
  name: string;
  qty: string;
  discountPct: number;
  amount: string;
  violation?: string;
}

const SAMPLE_REVIEW_LINES: ReviewLine[] = [
  { name: 'Bút bi Thiên Long TL-08 xanh', qty: '2 thùng', discountPct: 5, amount: '342000' },
  {
    name: 'Giấy A4 Double A 80gsm',
    qty: '10 ream',
    discountPct: 18,
    amount: '590400',
    violation: 'CK 18% — trần bảng giá 15%, chênh −21.600',
  },
  { name: 'Băng keo trong 48mm × 100y Tiến Phát', qty: '40 cây', discountPct: 0, amount: '380000' },
  { name: 'Kẹp giấy Plus 50mm (hộp 12)', qty: '6 hộp', discountPct: 0, amount: '144000' },
];

const money = (v: string) => formatMoney(v, { unit: '' });

function Kbd({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return (
    <kbd
      className={cn(
        'rounded border px-1 font-mono text-xs',
        inverted
          ? 'border-primary-foreground/50 text-primary-foreground'
          : 'border-input bg-muted text-muted-foreground',
      )}
    >
      {children}
    </kbd>
  );
}

function KeyValue({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function ApprovalQueueScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Hàng chờ duyệt"
        description="4 đơn đang chờ bạn duyệt · team Hà Nội · ngưỡng: CK trần 15%, giá trị 50.000.000"
        breadcrumb={[{ label: 'Bán hàng' }, { label: 'Chờ duyệt' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Lịch sử duyệt
            </Button>
            <Button variant="outline" size="sm">
              Quy tắc duyệt
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1 truncate">Số đơn, sale, khách hàng…</span>
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs"
        >
          Lý do: Tất cả <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs"
        >
          Sale: Tất cả <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Sắp xếp: chờ lâu nhất trước</span>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden rounded-md border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="h-8 px-2.5 text-xs">Số đơn</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Sale</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Khách hàng</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Lý do chờ duyệt</TableHead>
                  <TableHead className="h-8 px-2.5 text-right text-xs">Tổng tiền</TableHead>
                  <TableHead className="h-8 px-2.5 text-right text-xs">Chờ từ</TableHead>
                  <TableHead className="h-8 w-36 px-2.5 text-xs">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_PENDING.map((o) => (
                  <TableRow
                    key={o.soNo}
                    className={cn(o.selected && 'bg-secondary hover:bg-secondary')}
                  >
                    <TableCell className="px-2.5 py-1.5">
                      <a href="#" className="font-mono text-xs text-primary hover:underline">
                        {o.soNo}
                      </a>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2.5 py-1.5">{o.sale}</TableCell>
                    <TableCell className="max-w-56 truncate px-2.5 py-1.5">{o.customer}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <span className="flex flex-wrap gap-1">
                        {o.reasons.map((r) => (
                          <StatusBadge key={r} tone="warn">
                            {r}
                          </StatusBadge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {money(o.total)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums',
                        o.overdue && 'font-semibold text-destructive',
                      )}
                    >
                      {o.waitingFor}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <span className="flex gap-1.5">
                        <Button size="sm" className="h-6 px-2 text-xs">
                          Duyệt
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 border-destructive px-2 text-xs text-destructive"
                        >
                          Từ chối
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>4 đơn chờ · tổng giá trị 136.912.400</span>
            <span>·</span>
            <span>
              Phím tắt: <Kbd>J</Kbd>/<Kbd>K</Kbd> chọn · <Kbd>A</Kbd> duyệt · <Kbd>R</Kbd> từ chối
            </span>
          </div>
        </div>

        <aside className="flex w-96 shrink-0 flex-col self-stretch rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="flex items-center gap-2 text-base font-semibold">
              SO-2608-01302 <StatusBadge tone="warn">Chờ duyệt</StatusBadge>
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Esc đóng <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
            <div className="flex flex-col gap-1">
              <KeyValue k="Sale">Nguyễn Văn An · gửi 24/08/2026 09:20</KeyValue>
              <KeyValue k="Khách hàng">
                <a href="#" className="text-primary hover:underline">
                  Cửa hàng Minh Tâm
                </a>{' '}
                · KH-004512 · hạng Bạc
              </KeyValue>
              <KeyValue k="Công nợ">12.400.000 / hạn mức 50.000.000</KeyValue>
              <KeyValue k="Lý do chờ">
                <StatusBadge tone="warn">Dòng 2: CK 18% vượt trần 15%</StatusBadge>
              </KeyValue>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-2.5 py-1.5 text-xs font-semibold">Dòng hàng · 4 dòng</div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="h-8 px-2.5 text-xs">Sản phẩm</TableHead>
                    <TableHead className="h-8 w-16 px-2.5 text-right text-xs">SL</TableHead>
                    <TableHead className="h-8 w-12 px-2.5 text-right text-xs">CK%</TableHead>
                    <TableHead className="h-8 w-24 px-2.5 text-right text-xs">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_REVIEW_LINES.map((l) => (
                    <TableRow
                      key={l.name}
                      className={cn(l.violation && 'bg-warning/10 hover:bg-warning/10')}
                    >
                      <TableCell className="px-2.5 py-1.5">
                        <div className={cn(l.violation && 'font-semibold')}>{l.name}</div>
                        {l.violation ? (
                          <div className="text-xs text-warning">{l.violation}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums">
                        {l.qty}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'px-2.5 py-1.5 text-right tabular-nums',
                          l.violation && 'font-semibold text-warning',
                        )}
                      >
                        {l.discountPct}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {money(l.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex border-t px-2.5 py-1.5 text-sm">
                <span className="text-muted-foreground">Tổng cộng</span>
                <span className="ml-auto font-semibold tabular-nums">{money('1362400')}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Biên lợi nhuận sau CK của đơn: 11,2% (bình quân team tháng này: 14,8%)
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="reject-reason" className="text-xs text-muted-foreground">
                Lý do từ chối (bắt buộc khi từ chối)
              </label>
              <textarea
                id="reject-reason"
                readOnly
                rows={3}
                placeholder="VD: CK 18% chỉ áp cho đơn từ 5.000.000 trở lên — thương lượng lại với khách…"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <Button variant="ghost" size="sm">
              Đơn trước <Kbd>K</Kbd>
            </Button>
            <Button variant="ghost" size="sm">
              Đơn sau <Kbd>J</Kbd>
            </Button>
            <span className="flex-1" />
            <Button variant="outline" size="sm" className="border-destructive text-destructive">
              Từ chối <Kbd>R</Kbd>
            </Button>
            <Button size="sm">
              Duyệt <Kbd inverted>A</Kbd>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
