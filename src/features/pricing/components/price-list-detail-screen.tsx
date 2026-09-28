// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { ChevronDown, Info, Plus, Search, X } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/data/status-badge';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

interface PriceRow {
  sku: string;
  name: string;
  unit: string;
  /** Giá string decimal — hiển thị qua formatMoney, không tính toán ở client. */
  listPrice: string;
  /** Bậc số lượng 1+ / 10+ / 50+ / 100+; null = không có giá bậc đó. */
  tiers: [string, string | null, string | null, string | null];
  maxDiscountPct: number;
  updated: string;
  /** Trạng thái sửa tại chỗ trên từng ô (mockup: ô vàng chưa lưu). */
  editState?: 'editing' | 'edited';
  editedTierIndexes?: number[];
}

const SAMPLE_ROWS: PriceRow[] = [
  {
    sku: 'VBC-40G',
    name: 'Vua Bật Chồi 40gr (gói lẻ)',
    unit: 'gói',
    listPrice: '3750',
    tiers: ['3600', '3500', '3400', '3300'],
    maxDiscountPct: 15,
    updated: '22/08/2026',
  },
  {
    sku: 'VBC-40G-10',
    name: 'Vua Bật Chồi 40gr (combo 10 gói)',
    unit: 'thùng',
    listPrice: '3750',
    tiers: ['3600', '3500', '3400', '3300'],
    maxDiscountPct: 15,
    updated: '22/08/2026',
  },
  {
    sku: 'VBC-40G-20',
    name: 'Vua Bật Chồi 40gr (combo 20 gói)',
    unit: 'thùng',
    listPrice: '3750',
    tiers: ['3600', '3500', '3400', '3300'],
    maxDiscountPct: 15,
    updated: '22/08/2026',
  },
  {
    sku: 'VBC-40G-50',
    name: 'Vua Bật Chồi 40gr (combo 50 gói)',
    unit: 'thùng',
    listPrice: '4200',
    tiers: ['4000', '3900', '3800', '3700'],
    maxDiscountPct: 15,
    updated: '22/08/2026',
  },
  {
    sku: 'RTX-500',
    name: 'Rooting Extra 500ml',
    unit: 'chai',
    listPrice: '72000',
    tiers: ['69000', '67500', '66000', '65000'],
    maxDiscountPct: 10,
    updated: 'đang sửa',
    editState: 'editing',
  },
  {
    sku: 'RT-500',
    name: 'Rooting 500ml',
    unit: 'chai',
    listPrice: '64000',
    tiers: ['61500', '60000', '59000', '58000'],
    maxDiscountPct: 10,
    updated: '22/08/2026',
  },
  {
    sku: 'PUR-GOI',
    name: 'Purger (gói)',
    unit: 'gói',
    listPrice: '58000',
    tiers: ['56000', '54500', '53500', '52500'],
    maxDiscountPct: 10,
    updated: 'đã sửa',
    editState: 'edited',
    editedTierIndexes: [0, 1],
  },
  {
    sku: 'NPK-202020-1KG',
    name: 'Phân bón lá NPK 20-20-20 1kg',
    unit: 'gói',
    listPrice: '52000',
    tiers: ['50000', '49000', '48000', '47000'],
    maxDiscountPct: 10,
    updated: '22/08/2026',
  },
  {
    sku: 'TSSH-250',
    name: 'Thuốc trừ sâu sinh học 250ml',
    unit: 'chai',
    listPrice: '9500',
    tiers: ['9000', '8700', '8400', '8100'],
    maxDiscountPct: 12,
    updated: '15/08/2026',
  },
  {
    sku: 'TSSH-250-T20',
    name: 'Thuốc trừ sâu sinh học 250ml (thùng 20 chai)',
    unit: 'thùng',
    listPrice: '17500',
    tiers: ['16800', '16200', '15700', '15200'],
    maxDiscountPct: 12,
    updated: '15/08/2026',
  },
  {
    sku: 'HCVS-25KG',
    name: 'Phân hữu cơ vi sinh 25kg',
    unit: 'bao',
    listPrice: '22000',
    tiers: ['20500', '19800', '19200', '18500'],
    maxDiscountPct: 15,
    updated: '10/08/2026',
  },
  {
    sku: 'NPK-202020-25KG',
    name: 'Phân bón NPK 20-20-20 (bao 25kg)',
    unit: 'bao',
    listPrice: '38000',
    tiers: ['35500', '34500', '33500', '32500'],
    maxDiscountPct: 15,
    updated: '10/08/2026',
  },
  {
    sku: 'HG-DUALUOI-100',
    name: 'Hạt giống dưa lưới F1 (gói 100 hạt)',
    unit: 'gói',
    listPrice: '24000',
    tiers: ['22500', '21800', '21000', '20500'],
    maxDiscountPct: 10,
    updated: '10/08/2026',
  },
  {
    sku: 'BXD-16L',
    name: 'Bình xịt điện 16L',
    unit: 'cái',
    listPrice: '1250000',
    tiers: ['1190000', '1170000', '1150000', null],
    maxDiscountPct: 5,
    updated: '05/08/2026',
  },
  {
    sku: 'BXD-20L',
    name: 'Bình xịt điện 20L',
    unit: 'cái',
    listPrice: '1380000',
    tiers: ['1320000', '1300000', '1280000', null],
    maxDiscountPct: 5,
    updated: '05/08/2026',
  },
  {
    sku: 'BXD-PIN-12V',
    name: 'Pin thay thế bình xịt điện 12V',
    unit: 'cái',
    listPrice: '420000',
    tiers: ['395000', '385000', '375000', '365000'],
    maxDiscountPct: 8,
    updated: '05/08/2026',
  },
];

const TIER_LABELS = ['1+', '10+', '50+', '100+'];
const SAMPLE_GROUPS = ['Đại lý cấp 1 MB', 'Đại lý cấp 2 MB', 'Cửa hàng VTNN Hà Nội'];

export function PriceListDetailScreen({ id }: { id?: string }) {
  const code = id ?? 'PL-DL-MB';
  return (
    <>
      <header className="mb-4 space-y-2">
        <Breadcrumb
          items={[
            { label: 'Giá & KM' },
            { label: 'Bảng giá', href: '/pricing/price-lists' },
            { label: code },
          ]}
        />
        <div className="flex min-h-9 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold leading-tight">
              Đại lý miền Bắc
              <StatusBadge tone="ok">Hiệu lực</StatusBadge>
              <StatusBadge tone="brand">Đại lý</StatusBadge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {code} · 01/07/2026 – 31/12/2026 · ưu tiên 20 · 298 SKU · cập nhật 22/08/2026 14:05
              bởi Phạm Quốc Huy
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm">
              Nhân bản
            </Button>
            <Button variant="outline" size="sm">
              Nhập CSV giá
            </Button>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              Lưu thay đổi
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                Ctrl S
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      <div className="mb-3 flex items-start gap-2.5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold text-foreground">Giá cuối cùng do server tính</span> qua{' '}
          <span className="font-mono text-xs">resolve_price</span> (bảng giá → bậc số lượng → khuyến
          mãi). Màn hình này chỉ hiển thị và sửa dữ liệu nguồn; không tự tính giá ở trình duyệt.
        </p>
        <span className="ml-auto whitespace-nowrap font-semibold text-foreground">
          3 ô đã sửa, chưa lưu
        </span>
      </div>

      <div className="mb-3 rounded-md border bg-card px-3 py-2.5">
        <div className="grid gap-x-4 gap-y-3 lg:grid-cols-12">
          <div className="space-y-1 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Tên bảng giá</Label>
            <Input defaultValue="Đại lý miền Bắc" className="h-8" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Hiệu lực từ</Label>
            <div className="flex h-8 items-center rounded-md border border-input bg-background px-2 text-sm">
              01/07/2026 <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Đến</Label>
            <div className="flex h-8 items-center rounded-md border border-input bg-background px-2 text-sm">
              31/12/2026 <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-xs text-muted-foreground">Ưu tiên</Label>
            <Input defaultValue="20" className="h-8 text-right tabular-nums" />
          </div>
          <div className="space-y-1 lg:col-span-4">
            <Label className="text-xs text-muted-foreground">Gán cho nhóm KH</Label>
            <div className="flex min-h-8 flex-wrap items-center gap-1.5">
              {SAMPLE_GROUPS.map((g) => (
                <span
                  key={g}
                  className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-sm"
                >
                  {g} <X className="size-3 text-muted-foreground" />
                </span>
              ))}
              <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-input px-2 text-sm text-muted-foreground">
                <Plus className="size-3" /> Thêm nhóm
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm SKU, tên, barcode…
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
          Danh mục <ChevronDown className="size-3 text-muted-foreground" />
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
          Thương hiệu <ChevronDown className="size-3 text-muted-foreground" />
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
          Đã sửa <X className="size-3 opacity-70" />
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Giá theo ĐVT cơ bản · chưa gồm VAT</span>
          <span>·</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 font-normal text-muted-foreground">
            Thêm SKU vào bảng
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="px-2.5">SKU</TableHead>
              <TableHead className="px-2.5">Tên sản phẩm</TableHead>
              <TableHead className="px-2.5">ĐVT</TableHead>
              <TableHead className="px-2.5 text-right">Niêm yết</TableHead>
              {TIER_LABELS.map((t) => (
                <TableHead key={t} className="px-2.5 text-right">
                  {t}
                </TableHead>
              ))}
              <TableHead className="px-2.5 text-right">Trần CK%</TableHead>
              <TableHead className="px-2.5">Cập nhật</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ROWS.map((r) => (
              <TableRow key={r.sku}>
                <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.sku}</TableCell>
                <TableCell className="max-w-72 truncate px-2.5 py-1.5">{r.name}</TableCell>
                <TableCell className="px-2.5 py-1.5">{r.unit}</TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                  {formatMoney(r.listPrice, { unit: '' })}
                </TableCell>
                {r.tiers.map((price, i) => (
                  <TableCell
                    key={TIER_LABELS[i]}
                    className={cn(
                      'px-2.5 py-1.5 text-right tabular-nums',
                      r.editedTierIndexes?.includes(i) && 'font-semibold text-warning',
                    )}
                  >
                    {price === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : r.editState === 'editing' && i === 1 ? (
                      <span className="inline-flex h-6 items-center rounded-sm border border-primary bg-background px-1.5 ring-2 ring-secondary">
                        {formatMoney(price, { unit: '' })}
                      </span>
                    ) : (
                      formatMoney(price, { unit: '' })
                    )}
                  </TableCell>
                ))}
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                  {r.maxDiscountPct}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5',
                    r.editState ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  {r.updated}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–23 / 298</span>
          <span className="hidden items-center gap-1 md:flex">
            · Phím tắt: <Kbd>↵</Kbd> sửa ô · <Kbd>Tab</Kbd> ô kế · <Kbd>Esc</Kbd> bỏ sửa ·{' '}
            <Kbd>Ctrl S</Kbd> lưu
          </span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>2</PagerButton>
            <PagerButton>3</PagerButton>
            <PagerButton>…</PagerButton>
            <PagerButton>13</PagerButton>
            <PagerButton>›</PagerButton>
            <span className="ml-2 inline-flex items-center gap-0.5">
              23 dòng/trang <ChevronDown className="size-3" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: sửa giá trực tiếp trong ô, ô đã sửa hiện vàng cho tới khi Lưu. Lưu = một PATCH
          batch, server xóa cache Redis của bảng giá này.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: ô &quot;—&quot; ở bậc 100+ nghĩa là không có giá bậc đó, server rơi về bậc gần
          nhất thấp hơn.
        </div>
      </div>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-b-2 bg-background px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

function PagerButton({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border px-1.5',
        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
      )}
    >
      {children}
    </span>
  );
}
