'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { AlertTriangle, ChevronDown, CircleAlert, Search, User, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/data/status-badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
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

interface OrderLine {
  no: number;
  name: string;
  sku: string;
  unit: string;
  qty: string;
  qtyHint?: string;
  listPrice: string;
  discountPct: string;
  discountWarn?: string;
  amount: string;
  available: string;
  short?: boolean;
  shortHint?: string;
}

const SAMPLE_LINES: OrderLine[] = [
  {
    no: 1,
    name: 'Bút bi Thiên Long TL-08 xanh',
    sku: 'TL08-BLUE',
    unit: 'thùng',
    qty: '2',
    qtyHint: '= 48 cái',
    listPrice: '180000',
    discountPct: '5',
    amount: '342000',
    available: '1.240 / 1.300',
  },
  {
    no: 2,
    name: 'Giấy A4 Double A 80gsm',
    sku: 'DA-A4-80',
    unit: 'ream',
    qty: '10',
    qtyHint: '= 5.000 tờ',
    listPrice: '72000',
    discountPct: '18',
    discountWarn: 'vượt trần 15%, cần duyệt',
    amount: '590400',
    available: '312 / 340',
  },
  {
    no: 3,
    name: 'Băng keo trong 48mm × 100y Tiến Phát',
    sku: 'TP-BK48-100',
    unit: 'cây',
    qty: '60',
    listPrice: '9500',
    discountPct: '0',
    amount: '570000',
    available: '46 / 120',
    short: true,
    shortHint: 'thiếu 14',
  },
  {
    no: 4,
    name: 'Kẹp giấy Plus 50mm (hộp 12)',
    sku: 'PL-KG50',
    unit: 'hộp',
    qty: '6',
    qtyHint: '= 72 cái',
    listPrice: '24000',
    discountPct: '0',
    amount: '144000',
    available: '890 / 890',
  },
];

const SAMPLE_SUMMARY = {
  subtotal: '1690400',
  discount: '-124000',
  shippingFee: '30000',
  total: '1596400',
};

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

/** Ô nhập trong bảng dòng hàng — tĩnh, hiển thị giá trị như input readOnly. */
function CellInput({
  value,
  align = 'left',
  tone,
}: {
  value: string;
  align?: 'left' | 'right';
  tone?: 'warn' | 'err';
}) {
  return (
    <input
      readOnly
      value={value}
      className={cn(
        'h-7 w-full rounded-md border border-input bg-background px-1.5 text-sm tabular-nums',
        align === 'right' && 'text-right',
        tone === 'warn' && 'border-warning',
        tone === 'err' && 'border-destructive',
      )}
    />
  );
}

export function OrderCreateScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 space-y-2">
        <Breadcrumb
          items={[
            { label: 'Bán hàng' },
            { label: 'Đơn hàng', href: '/crm/orders' },
            { label: 'Tạo đơn' },
          ]}
        />
        <div className="flex min-h-9 items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold leading-tight">
              Tạo đơn hàng <StatusBadge tone="draft">Nháp</StatusBadge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Số chứng từ: <span className="font-mono text-xs">(tự động khi lưu)</span> · Kho xuất:
              Kho HN-1
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm">
              Hủy bỏ <Kbd>Esc</Kbd>
            </Button>
            <Button variant="outline" size="sm">
              Lưu nháp <Kbd>Alt S</Kbd>
            </Button>
            <Button size="sm">
              Xác nhận đơn <Kbd inverted>Alt ↵</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-12 gap-x-4 gap-y-3 rounded-md border bg-card px-3 py-2.5">
        <div className="col-span-4 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Khách hàng <span className="text-destructive">*</span>
          </label>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-sm"
          >
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-semibold">Cửa hàng Minh Tâm</span>
            <span className="truncate text-muted-foreground">· KH-004512 · 0912 345 678</span>
            <ChevronDown
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
          <p className="truncate text-xs text-muted-foreground">
            Hạng Bạc · Bảng giá: Đại lý miền Bắc · Công nợ 12.400.000 / hạn mức 50.000.000
          </p>
        </div>
        <div className="col-span-4 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Địa chỉ giao</label>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-sm"
          >
            <span className="truncate">Số 12 Lê Lợi, P. Hàng Bài, Hoàn Kiếm, Hà Nội</span>
            <ChevronDown
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
          <p className="text-xs text-muted-foreground">Mặc định · 2 địa chỉ khác</p>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Kênh bán</label>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-sm"
          >
            <span className="truncate">Điện thoại</span>
            <ChevronDown
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Ngày đơn</label>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-sm tabular-nums"
          >
            <span className="truncate">23/08/2026</span>
            <ChevronDown
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">
              Dòng hàng{' '}
              <span className="font-normal text-muted-foreground">
                · 4 dòng · 1 dòng thiếu hàng
              </span>
            </span>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              Thêm dòng <Kbd>Alt N</Kbd>
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="h-8 w-8 px-2.5 text-xs">#</TableHead>
                  <TableHead className="h-8 px-2.5 text-xs">Sản phẩm</TableHead>
                  <TableHead className="h-8 w-24 px-2.5 text-xs">ĐVT</TableHead>
                  <TableHead className="h-8 w-24 px-2.5 text-right text-xs">SL</TableHead>
                  <TableHead className="h-8 w-28 px-2.5 text-right text-xs">Giá niêm yết</TableHead>
                  <TableHead className="h-8 w-20 px-2.5 text-right text-xs">CK%</TableHead>
                  <TableHead className="h-8 w-28 px-2.5 text-right text-xs">Thành tiền</TableHead>
                  <TableHead className="h-8 w-28 px-2.5 text-right text-xs">Khả dụng</TableHead>
                  <TableHead className="h-8 w-8 px-2.5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_LINES.map((l) => (
                  <TableRow
                    key={l.no}
                    className={cn(l.short && 'bg-destructive/10 hover:bg-destructive/10')}
                  >
                    <TableCell className="px-2.5 py-1.5 align-top text-muted-foreground">
                      {l.no}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 align-top">
                      <div className="font-semibold">{l.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 align-top">
                      <button
                        type="button"
                        className="flex h-7 w-full items-center gap-1 rounded-md border border-input bg-background px-1.5 text-sm"
                      >
                        {l.unit}
                        <ChevronDown
                          className="ml-auto h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 align-top">
                      <CellInput value={l.qty} align="right" tone={l.short ? 'err' : undefined} />
                      {l.qtyHint ? (
                        <div className="text-right text-xs text-muted-foreground">{l.qtyHint}</div>
                      ) : null}
                      {l.shortHint ? (
                        <div className="text-right text-xs text-destructive">{l.shortHint}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right align-top tabular-nums">
                      {money(l.listPrice)}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 align-top">
                      <CellInput
                        value={l.discountPct}
                        align="right"
                        tone={l.discountWarn ? 'warn' : undefined}
                      />
                      {l.discountWarn ? (
                        <div className="text-right text-xs text-warning">{l.discountWarn}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right align-top font-semibold tabular-nums">
                      {money(l.amount)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right align-top tabular-nums',
                        l.short && 'font-semibold text-destructive',
                      )}
                    >
                      {l.available}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 align-top">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Xóa dòng ${l.no}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">5</TableCell>
                  <TableCell className="px-2.5 py-1.5" colSpan={8}>
                    <div className="flex h-7 w-96 items-center gap-1.5 rounded-md border border-input bg-background px-1.5 text-sm text-muted-foreground">
                      <Search className="h-3.5 w-3.5" aria-hidden />
                      <span>Tìm theo mã SKU, tên, mọi barcode…</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-auto flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              Phím tắt: <Kbd>Alt N</Kbd> dòng mới · <Kbd>↵</Kbd> ở ô SL → dòng mới · <Kbd>Esc</Kbd>{' '}
              đóng gợi ý · <Kbd>?</Kbd> xem tất cả
            </span>
            <span className="ml-auto">Khả dụng = khả dụng / tồn thực tại Kho HN-1</span>
          </div>
        </div>

        <aside className="sticky top-4 flex w-96 shrink-0 flex-col gap-3">
          <div className="rounded-md border bg-card px-3.5 py-3">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">Tạm tính</span>
              <span className="tabular-nums">{money(SAMPLE_SUMMARY.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">
                Chiết khấu{' '}
                <button type="button" className="text-xs text-primary hover:underline">
                  · Áp mã
                </button>
              </span>
              <span className="tabular-nums">{money(SAMPLE_SUMMARY.discount)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">Thuế (VAT)</span>
              <span className="text-muted-foreground">chưa cấu hình</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">Phí vận chuyển</span>
              <span className="tabular-nums">{money(SAMPLE_SUMMARY.shippingFee)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2.5 text-xl font-semibold">
              <span>Tổng cộng</span>
              <span className="tabular-nums">{money(SAMPLE_SUMMARY.total)}</span>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Khuyến mãi đang áp</div>
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs">
                Mua 10 ream tặng 1 <X className="h-3 w-3 text-muted-foreground" aria-hidden />
              </span>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs">
                CK 5% đại lý Bạc <X className="h-3 w-3 text-muted-foreground" aria-hidden />
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <span className="font-semibold">Đơn sẽ vào chờ duyệt.</span> Dòng 2 chiết khấu 18%
              vượt trần 15%. Người duyệt: Trần Thị Bình (leader).
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <span className="font-semibold">Không đủ tồn cho 1 sản phẩm.</span> Dòng 3 thiếu 14
              cây. Giảm số lượng hoặc chọn kho khác.
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <Button variant="outline">
              Lưu nháp <Kbd>Alt S</Kbd>
            </Button>
            <Button size="lg" className="px-4">
              Gửi duyệt <Kbd inverted>Alt ↵</Kbd>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Nút đổi từ &ldquo;Xác nhận đơn&rdquo; thành &ldquo;Gửi duyệt&rdquo; vì có dòng vượt
              trần
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
