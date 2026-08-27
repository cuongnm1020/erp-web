// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import Link from 'next/link';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface PriceListRow {
  code: string;
  name: string;
  kind: 'Niêm yết' | 'Đại lý' | 'VIP';
  groups: string;
  groupsMuted?: boolean;
  from: string;
  to: string | null;
  skuCount: number;
  priority: number;
  status: { tone: StatusTone; label: string };
  updated: string;
}

const KIND_TONE: Record<PriceListRow['kind'], StatusTone> = {
  'Niêm yết': 'neutral',
  'Đại lý': 'brand',
  VIP: 'warn',
};

const SAMPLE_PRICE_LISTS: PriceListRow[] = [
  {
    code: 'PL-LIST',
    name: 'Giá niêm yết 2026',
    kind: 'Niêm yết',
    groups: 'Mặc định (mọi KH)',
    from: '2026-01-01',
    to: null,
    skuCount: 312,
    priority: 100,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '20/08/2026 · Huy',
  },
  {
    code: 'PL-DL-MB',
    name: 'Đại lý miền Bắc',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MB, Đại lý cấp 2 MB',
    from: '2026-07-01',
    to: '2026-12-31',
    skuCount: 298,
    priority: 20,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '22/08/2026 · Huy',
  },
  {
    code: 'PL-DL-MN',
    name: 'Đại lý miền Nam',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MN, Đại lý cấp 2 MN',
    from: '2026-07-01',
    to: '2026-12-31',
    skuCount: 301,
    priority: 20,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '22/08/2026 · Huy',
  },
  {
    code: 'PL-DL-MT',
    name: 'Đại lý miền Trung',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MT',
    from: '2026-07-01',
    to: '2026-12-31',
    skuCount: 276,
    priority: 20,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '15/08/2026 · Lan',
  },
  {
    code: 'PL-VIP-KIM',
    name: 'VIP Kim cương',
    kind: 'VIP',
    groups: 'Hạng Kim cương',
    from: '2026-01-01',
    to: '2026-12-31',
    skuCount: 312,
    priority: 5,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '03/08/2026 · Huy',
  },
  {
    code: 'PL-VIP-VANG',
    name: 'VIP Vàng',
    kind: 'VIP',
    groups: 'Hạng Vàng',
    from: '2026-01-01',
    to: '2026-12-31',
    skuCount: 312,
    priority: 8,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '03/08/2026 · Huy',
  },
  {
    code: 'PL-VIP-BAC',
    name: 'VIP Bạc',
    kind: 'VIP',
    groups: 'Hạng Bạc',
    from: '2026-01-01',
    to: '2026-12-31',
    skuCount: 312,
    priority: 10,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '03/08/2026 · Huy',
  },
  {
    code: 'PL-TRUONG',
    name: 'Trường học & cơ quan',
    kind: 'Đại lý',
    groups: 'Trường học, Cơ quan nhà nước',
    from: '2026-08-15',
    to: '2026-09-30',
    skuCount: 88,
    priority: 15,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '14/08/2026 · Lan',
  },
  {
    code: 'PL-NHASACH',
    name: 'Chuỗi nhà sách',
    kind: 'Đại lý',
    groups: 'Nhà sách',
    from: '2026-06-01',
    to: '2026-08-31',
    skuCount: 154,
    priority: 15,
    status: { tone: 'warn', label: 'Hết hạn sau 8 ngày' },
    updated: '30/05/2026 · Huy',
  },
  {
    code: 'PL-KHAISINH',
    name: 'Khai giảng 2026 — giấy & vở',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MB, Đại lý cấp 1 MN, Nhà sách',
    from: '2026-08-01',
    to: '2026-08-31',
    skuCount: 42,
    priority: 12,
    status: { tone: 'warn', label: 'Hết hạn sau 8 ngày' },
    updated: '28/07/2026 · Lan',
  },
  {
    code: 'PL-DL-MB-Q4',
    name: 'Đại lý miền Bắc — quý 4',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MB, Đại lý cấp 2 MB',
    from: '2026-10-01',
    to: '2026-12-31',
    skuCount: 298,
    priority: 20,
    status: { tone: 'draft', label: 'Nháp' },
    updated: '23/08/2026 · Huy',
  },
  {
    code: 'PL-ONLINE',
    name: 'Kênh online (Shopee, Lazada)',
    kind: 'Đại lý',
    groups: 'Khách online',
    from: '2026-03-01',
    to: '2026-12-31',
    skuCount: 120,
    priority: 30,
    status: { tone: 'ok', label: 'Hiệu lực' },
    updated: '10/07/2026 · Huy',
  },
  {
    code: 'PL-VIP-PLAT',
    name: 'VIP Bạch kim (thử nghiệm)',
    kind: 'VIP',
    groups: 'Chưa gán',
    groupsMuted: true,
    from: '2026-09-01',
    to: '2026-12-31',
    skuCount: 312,
    priority: 3,
    status: { tone: 'draft', label: 'Nháp' },
    updated: '21/08/2026 · Huy',
  },
  {
    code: 'PL-DL-MB-H1',
    name: 'Đại lý miền Bắc — nửa đầu 2026',
    kind: 'Đại lý',
    groups: 'Đại lý cấp 1 MB, Đại lý cấp 2 MB',
    from: '2026-01-01',
    to: '2026-06-30',
    skuCount: 284,
    priority: 20,
    status: { tone: 'neutral', label: 'Hết hạn' },
    updated: '30/06/2026 · Huy',
  },
];

const TABS = [
  { label: 'Tất cả', count: 14, active: true },
  { label: 'Niêm yết', count: 1 },
  { label: 'Đại lý', count: 7 },
  { label: 'VIP', count: 4 },
  { label: 'Sắp hết hạn', count: 2 },
];

export function PriceListsScreen() {
  return (
    <>
      <PageHeader
        title="Bảng giá"
        description="14 bảng giá · 9 đang hiệu lực · giá cuối cùng do server quyết định theo ưu tiên"
        breadcrumb={[{ label: 'Giá & KM' }, { label: 'Bảng giá' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Nhập CSV
            </Button>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm">
              Tạo bảng giá
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                N
              </kbd>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm theo tên, mã bảng giá…
        </div>
        <FilterChip>Loại: Tất cả</FilterChip>
        <FilterChip on>
          Trạng thái: Hiệu lực <X className="size-3 opacity-70" />
        </FilterChip>
        <FilterChip>Nhóm KH</FilterChip>
        <FilterChip>Hiệu lực trong: 23/08/2026</FilterChip>
        <Button variant="ghost" size="sm" className="h-7 px-2 font-normal text-muted-foreground">
          <Plus className="size-3.5" /> Lọc
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Đã lưu: <span className="font-semibold text-foreground">Đang chạy</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5">
            Cột <ChevronDown className="size-3" />
          </span>
        </div>
      </div>

      <div className="mb-3 flex h-9 border-b">
        {TABS.map((t) => (
          <span
            key={t.label}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 text-sm',
              t.active
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">
              {t.count}
            </span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-8 px-2.5">
                <Checkbox aria-label="Chọn tất cả" />
              </TableHead>
              <TableHead className="px-2.5">Mã</TableHead>
              <TableHead className="px-2.5">Tên bảng giá</TableHead>
              <TableHead className="px-2.5">Loại</TableHead>
              <TableHead className="px-2.5">Áp cho nhóm KH</TableHead>
              <TableHead className="px-2.5">Hiệu lực từ</TableHead>
              <TableHead className="px-2.5">Đến</TableHead>
              <TableHead className="px-2.5 text-right">Số SKU</TableHead>
              <TableHead className="px-2.5 text-right">Ưu tiên ▲</TableHead>
              <TableHead className="px-2.5">Trạng thái</TableHead>
              <TableHead className="px-2.5">Cập nhật</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_PRICE_LISTS.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="px-2.5 py-1.5">
                  <Checkbox aria-label={`Chọn ${r.code}`} />
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <Link
                    href={`/pricing/price-lists/${r.code}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {r.code}
                  </Link>
                </TableCell>
                <TableCell className="px-2.5 py-1.5 font-semibold">{r.name}</TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <StatusBadge tone={KIND_TONE[r.kind]}>{r.kind}</StatusBadge>
                </TableCell>
                <TableCell
                  className={cn(
                    'max-w-64 truncate px-2.5 py-1.5',
                    r.groupsMuted && 'text-muted-foreground',
                  )}
                >
                  {r.groups}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">{formatDate(r.from)}</TableCell>
                <TableCell className="px-2.5 py-1.5 tabular-nums">
                  {r.to ? formatDate(r.to) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                  {r.skuCount}
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-right">
                  <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-sm bg-muted px-1 text-xs font-semibold text-muted-foreground tabular-nums">
                    {r.priority}
                  </span>
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                </TableCell>
                <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.updated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–14 / 14</span>
          <span>· Ưu tiên: số nhỏ = ưu tiên cao hơn</span>
          <div className="ml-auto flex items-center gap-1">
            <PagerButton>‹</PagerButton>
            <PagerButton on>1</PagerButton>
            <PagerButton>›</PagerButton>
            <span className="ml-2 inline-flex items-center gap-0.5">
              40 dòng/trang <ChevronDown className="size-3" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Ghi chú: cột Ưu tiên là thứ tự server chọn bảng giá khi một KH thuộc nhiều nhóm. Chỉ admin
        sửa được, sửa xong phải xóa cache giá.
      </div>
    </>
  );
}

function FilterChip({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        on
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-background',
      )}
    >
      {children}
      {!on && <ChevronDown className="size-3 text-muted-foreground" />}
    </span>
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
