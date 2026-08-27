'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { formatDate, formatMoney } from '@/lib/format';

interface RmaRow {
  rmaNo: string;
  orderNo: string;
  customer: string;
  reason: string;
  lineCount: number;
  refundValue: string;
  receivedAt: string | null;
  receivedWarehouse?: string;
  status: { label: string; tone: StatusTone };
  selected?: boolean;
}

const SAMPLE_RMAS: RmaRow[] = [
  {
    rmaNo: 'RMA-2608-00031',
    orderNo: 'SO-2608-01183',
    customer: 'Nhà sách Phương Nam Q.1',
    reason: 'Hàng lỗi in ấn',
    lineCount: 2,
    refundValue: '1062000',
    receivedAt: '2026-08-24T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Đang kiểm tra', tone: 'warn' },
    selected: true,
  },
  {
    rmaNo: 'RMA-2608-00030',
    orderNo: 'SO-2608-01121',
    customer: 'Cửa hàng Hồng Phúc',
    reason: 'Giao nhầm mã màu',
    lineCount: 1,
    refundValue: '180000',
    receivedAt: '2026-08-23T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Đang kiểm tra', tone: 'warn' },
  },
  {
    rmaNo: 'RMA-2608-00029',
    orderNo: 'SO-2608-01043',
    customer: 'Tiệm photocopy Hải Yến',
    reason: 'Khách đổi ý (chưa mở hộp)',
    lineCount: 1,
    refundValue: '450000',
    receivedAt: '2026-08-23T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Đang kiểm tra', tone: 'warn' },
  },
  {
    rmaNo: 'RMA-2608-00028',
    orderNo: 'SO-2608-00988',
    customer: 'Cửa hàng Tuấn Kiệt',
    reason: 'Hỏng trong vận chuyển',
    lineCount: 3,
    refundValue: '312500',
    receivedAt: '2026-08-22T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Đang kiểm tra', tone: 'warn' },
  },
  {
    rmaNo: 'RMA-2608-00027',
    orderNo: 'SO-2608-00941',
    customer: 'Siêu thị văn phòng Ba Đình',
    reason: 'Hàng lỗi — mực khô',
    lineCount: 1,
    refundValue: '611400',
    receivedAt: '2026-08-21T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Chờ hoàn tiền', tone: 'brand' },
  },
  {
    rmaNo: 'RMA-2608-00026',
    orderNo: 'SO-2608-00902',
    customer: 'Công ty TNHH Đức Thịnh',
    reason: 'Giao thừa số lượng',
    lineCount: 1,
    refundValue: '216000',
    receivedAt: '2026-08-21T01:00:00Z',
    receivedWarehouse: 'Kho HCM-2',
    status: { label: 'Chờ hoàn tiền', tone: 'brand' },
  },
  {
    rmaNo: 'RMA-2608-00025',
    orderNo: 'SO-2608-00867',
    customer: 'Trường THCS Nguyễn Du',
    reason: 'Khách đổi ý (chưa mở hộp)',
    lineCount: 2,
    refundValue: '388000',
    receivedAt: null,
    status: { label: 'Chờ nhận hàng', tone: 'neutral' },
  },
  {
    rmaNo: 'RMA-2608-00024',
    orderNo: 'SO-2608-00812',
    customer: 'Cửa hàng Minh Tâm',
    reason: 'Hàng lỗi — nắp bút gãy',
    lineCount: 1,
    refundValue: '171000',
    receivedAt: '2026-08-20T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Hoàn tất', tone: 'ok' },
  },
  {
    rmaNo: 'RMA-2608-00023',
    orderNo: 'SO-2608-00778',
    customer: 'Công ty TNHH In Hồng Hà',
    reason: 'Hỏng trong vận chuyển',
    lineCount: 2,
    refundValue: '724000',
    receivedAt: '2026-08-19T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Hoàn tất', tone: 'ok' },
  },
  {
    rmaNo: 'RMA-2608-00022',
    orderNo: 'SO-2608-00734',
    customer: 'Nhà sách Fahasa Hà Đông',
    reason: 'Giao nhầm mã',
    lineCount: 1,
    refundValue: '92000',
    receivedAt: '2026-08-18T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Hoàn tất', tone: 'ok' },
  },
  {
    rmaNo: 'RMA-2608-00021',
    orderNo: 'SO-2608-00701',
    customer: 'Công ty CP Giáo dục Ánh Dương',
    reason: 'Khách đổi ý (chưa mở hộp)',
    lineCount: 4,
    refundValue: '1418000',
    receivedAt: '2026-08-17T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Hoàn tất', tone: 'ok' },
  },
  {
    rmaNo: 'RMA-2608-00020',
    orderNo: 'SO-2608-00688',
    customer: 'Văn phòng phẩm Thanh Hằng',
    reason: 'Hàng lỗi in ấn',
    lineCount: 1,
    refundValue: '76500',
    receivedAt: '2026-08-16T01:00:00Z',
    receivedWarehouse: 'Kho HN-1',
    status: { label: 'Hoàn tất', tone: 'ok' },
  },
];

const TABS = [
  { key: 'all', label: 'Tất cả', count: 37 },
  { key: 'awaiting', label: 'Chờ nhận hàng', count: 6 },
  { key: 'inspecting', label: 'Đang kiểm tra', count: 4 },
  { key: 'refunding', label: 'Chờ hoàn tiền', count: 3 },
  { key: 'done', label: 'Hoàn tất', count: 24 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface RmaReturnLine {
  name: string;
  sku: string;
  qty: number;
  condition: { label: string; tone: StatusTone };
  restock?: { lot: string; bin: string };
  restockNote?: { main: string; hint: string };
}

const SAMPLE_RETURN_LINES: RmaReturnLine[] = [
  {
    name: 'Sổ tay Campus A5 120 trang',
    sku: 'CP-A5-120',
    qty: 30,
    condition: { label: 'Bán lại được', tone: 'ok' },
    restock: { lot: 'L2608-CP11', bin: 'bin A-03-02-B' },
  },
  {
    name: 'Sổ lò xo Klong A4 200 trang',
    sku: 'KL-A4-200',
    qty: 12,
    condition: { label: 'Hỏng — hủy', tone: 'err' },
    restockNote: { main: 'không nhập lại', hint: 'phiếu hủy đính kèm' },
  },
];

const money = (v: string) => formatMoney(v, { unit: '' });

function KeyValue({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function RmaListScreen() {
  const [tab, setTab] = useState<TabKey>('inspecting');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Đơn hoàn / RMA"
        description="Nhận lại hàng từ khách · kiểm tra tình trạng · nhập kho lại theo lô · hoàn tiền"
        breadcrumb={[{ label: 'Bán hàng' }, { label: 'Đơn hoàn' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">Tạo đơn hoàn</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1 truncate">Mã RMA, số đơn gốc, khách hàng…</span>
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs"
        >
          Lý do: Tất cả <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-primary bg-secondary px-2 text-xs font-semibold text-primary"
        >
          Ngày: 01/08 – 24/08/2026 <X className="h-3 w-3" aria-hidden />
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Đã lưu:</span>
          <button
            type="button"
            className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            Chờ nhập kho <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex border-b" role="tablist" aria-label="Trạng thái đơn hoàn">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm',
              tab === t.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-3 pt-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden rounded-md border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="h-8 px-2.5 text-xs">Mã RMA</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Đơn gốc</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Khách hàng</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Lý do</TableHead>
                  <TableHead className="h-8 px-2.5 text-right text-xs">Dòng</TableHead>
                  <TableHead className="h-8 px-2.5 text-right text-xs">Giá trị hoàn</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Nhận hàng</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_RMAS.map((r) => (
                  <TableRow
                    key={r.rmaNo}
                    className={cn(r.selected && 'bg-secondary hover:bg-secondary')}
                  >
                    <TableCell className="px-2.5 py-1.5">
                      <a href="#" className="font-mono text-xs text-primary hover:underline">
                        {r.rmaNo}
                      </a>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <a href="#" className="font-mono text-xs text-primary hover:underline">
                        {r.orderNo}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-56 truncate px-2.5 py-1.5">{r.customer}</TableCell>
                    <TableCell className="max-w-56 truncate px-2.5 py-1.5">{r.reason}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.lineCount}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {money(r.refundValue)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2.5 py-1.5">
                      {r.receivedAt ? (
                        <span className="tabular-nums">
                          {formatDate(r.receivedAt)} · {r.receivedWarehouse}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">chưa nhận</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>Hiển thị 1–12 / 37</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-6 w-6">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Trang trước</span>
              </Button>
              <Button size="icon" className="h-6 w-6 text-xs">
                1
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6 text-xs">
                2
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6 text-xs">
                3
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Trang sau</span>
              </Button>
            </div>
          </div>
        </div>

        <aside className="flex w-96 shrink-0 flex-col self-stretch rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="flex items-center gap-2 text-base font-semibold">
              RMA-2608-00031 <StatusBadge tone="warn">Đang kiểm tra</StatusBadge>
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Esc đóng <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
            <div className="flex flex-col gap-1">
              <KeyValue k="Đơn gốc">
                <a href="#" className="font-mono text-xs text-primary hover:underline">
                  SO-2608-01183
                </a>{' '}
                · giao 21/08/2026 · Nhà sách Phương Nam Q.1
              </KeyValue>
              <KeyValue k="Lý do hoàn">Hàng lỗi in ấn — khách gửi ảnh, CSKH xác nhận</KeyValue>
              <KeyValue k="Nhận hàng">24/08/2026 08:30 · Kho HN-1 · Lê Quang Huy</KeyValue>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-2.5 py-1.5 text-xs font-semibold">Dòng hoàn · 2 dòng</div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="h-8 px-2.5 text-xs">Sản phẩm</TableHead>
                    <TableHead className="h-8 w-10 px-2.5 text-right text-xs">SL</TableHead>
                    <TableHead className="h-8 w-24 px-2.5 text-xs">Tình trạng</TableHead>
                    <TableHead className="h-8 w-28 px-2.5 text-xs">Nhập kho lại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_RETURN_LINES.map((l) => (
                    <TableRow key={l.sku}>
                      <TableCell className="px-2.5 py-1.5">
                        <div className="font-semibold">{l.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                        {l.qty}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <StatusBadge tone={l.condition.tone}>{l.condition.label}</StatusBadge>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        {l.restock ? (
                          <>
                            <div>
                              Lô <span className="font-mono text-xs">{l.restock.lot}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{l.restock.bin}</div>
                          </>
                        ) : l.restockNote ? (
                          <>
                            <div className="text-muted-foreground">{l.restockNote.main}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.restockNote.hint}
                            </div>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-2.5 py-1.5 text-xs font-semibold">Hoàn tiền</div>
              <div className="flex flex-col gap-1 px-3 py-2">
                <KeyValue k="Giá trị hoàn">
                  <span className="font-semibold tabular-nums">{money('1062000')}</span>
                </KeyValue>
                <KeyValue k="Hình thức">Cấn trừ công nợ (khách còn nợ 34.600.000)</KeyValue>
                <KeyValue k="Trạng thái">
                  <StatusBadge tone="neutral">Chờ kiểm tra xong</StatusBadge>
                </KeyValue>
              </div>
            </div>

            <div className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
              Nhập kho lại tạo movement RETURN_IN mới theo lô — không sửa phiếu xuất cũ. Hoàn tiền
              chỉ mở khi mọi dòng đã có kết luận tình trạng.
            </div>
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <Button variant="ghost" size="sm">
              Mở trang đầy đủ
            </Button>
            <span className="flex-1" />
            <Button variant="outline" size="sm">
              In phiếu nhận
            </Button>
            <Button size="sm">Xác nhận kiểm tra — nhập kho</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
