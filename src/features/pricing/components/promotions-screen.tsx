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
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

type PromoKind = 'Mua X tặng Y' | 'Giảm %' | 'Giảm tiền' | 'Combo';

interface PromotionRow {
  code: string;
  name: string;
  kind: PromoKind;
  period: string;
  periodMuted?: boolean;
  channel: string;
  /** Ngân sách: string decimal; null = chưa có ngân sách. */
  budget: { usedPct: number; used: string; total: string } | null;
  /** Suất còn: null = không giới hạn suất. */
  slotsLeft: number | null;
  slotsLow?: boolean;
  status: { tone: StatusTone; label: string };
  priority: number | null;
}

const KIND_TONE: Record<PromoKind, StatusTone> = {
  'Mua X tặng Y': 'brand',
  'Giảm %': 'neutral',
  'Giảm tiền': 'neutral',
  Combo: 'warn',
};

const SAMPLE_PROMOTIONS: PromotionRow[] = [
  {
    code: 'KM-2608-012',
    name: 'Mua 10 ream giấy tặng 1 ream',
    kind: 'Mua X tặng Y',
    period: '01/08 – 31/08/2026',
    channel: 'Tất cả',
    budget: { usedPct: 88, used: '44000000', total: '50000000' },
    slotsLeft: 62,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 10,
  },
  {
    code: 'KM-2608-011',
    name: 'Giảm 5% đại lý hạng Bạc',
    kind: 'Giảm %',
    period: '01/07 – 31/12/2026',
    channel: 'Điện thoại, Zalo',
    budget: { usedPct: 31, used: '62150000', total: '200000000' },
    slotsLeft: null,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 20,
  },
  {
    code: 'KM-2608-010',
    name: 'Khai giảng: giảm 50.000 cho đơn vở ≥ 1.000.000',
    kind: 'Giảm tiền',
    period: '10/08 – 05/09/2026',
    channel: 'Tất cả',
    budget: { usedPct: 96, used: '28800000', total: '30000000' },
    slotsLeft: 24,
    slotsLow: true,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 5,
  },
  {
    code: 'KM-2608-009',
    name: 'Combo bút TL-08 + sổ Campus A5',
    kind: 'Combo',
    period: '15/08 – 15/09/2026',
    channel: 'Online',
    budget: { usedPct: 42, used: '8400000', total: '20000000' },
    slotsLeft: 290,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 15,
  },
  {
    code: 'KM-2608-008',
    name: 'Mực in HP: mua 2 tặng 1 ream A4',
    kind: 'Mua X tặng Y',
    period: '01/08 – 31/08/2026',
    channel: 'Điện thoại',
    budget: { usedPct: 55, used: '5500000', total: '10000000' },
    slotsLeft: 45,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 12,
  },
  {
    code: 'KM-2608-007',
    name: 'Giảm 3% đơn đầu tiên khách mới',
    kind: 'Giảm %',
    period: '01/01 – 31/12/2026',
    channel: 'Tất cả',
    budget: { usedPct: 18, used: '9020000', total: '50000000' },
    slotsLeft: null,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 30,
  },
  {
    code: 'KM-2608-006',
    name: 'Băng keo Tiến Phát: mua 50 cuộn tặng 5',
    kind: 'Mua X tặng Y',
    period: '01/08 – 30/09/2026',
    channel: 'Tất cả',
    budget: { usedPct: 27, used: '2700000', total: '10000000' },
    slotsLeft: 146,
    status: { tone: 'ok', label: 'Đang chạy' },
    priority: 15,
  },
  {
    code: 'KM-2609-001',
    name: 'Tháng 9: giảm 8% nhóm Mực in cho VIP Vàng',
    kind: 'Giảm %',
    period: '01/09 – 30/09/2026',
    channel: 'Tất cả',
    budget: { usedPct: 0, used: '0', total: '40000000' },
    slotsLeft: 200,
    status: { tone: 'brand', label: 'Sắp chạy' },
    priority: 10,
  },
  {
    code: 'KM-2609-002',
    name: 'Trung thu: tặng hộp bút màu cho đơn ≥ 3.000.000',
    kind: 'Mua X tặng Y',
    period: '10/09 – 25/09/2026',
    channel: 'Tất cả',
    budget: { usedPct: 0, used: '0', total: '12000000' },
    slotsLeft: 300,
    status: { tone: 'brand', label: 'Sắp chạy' },
    priority: 8,
  },
  {
    code: 'KM-2608-013',
    name: 'Sổ Klong: mua 100 tặng 10',
    kind: 'Mua X tặng Y',
    period: 'Chưa đặt',
    periodMuted: true,
    channel: 'Tất cả',
    budget: null,
    slotsLeft: null,
    status: { tone: 'draft', label: 'Nháp' },
    priority: null,
  },
  {
    code: 'KM-2608-014',
    name: 'Giảm 10% mực tương thích Brother',
    kind: 'Giảm %',
    period: 'Chưa đặt',
    periodMuted: true,
    channel: 'Online',
    budget: null,
    slotsLeft: null,
    status: { tone: 'draft', label: 'Nháp' },
    priority: null,
  },
  {
    code: 'KM-2607-006',
    name: 'Giảm 4% đại lý miền Trung — tạm dừng do hết hàng',
    kind: 'Giảm %',
    period: '01/07 – 30/09/2026',
    channel: 'Điện thoại',
    budget: { usedPct: 63, used: '12600000', total: '20000000' },
    slotsLeft: null,
    status: { tone: 'warn', label: 'Tạm dừng' },
    priority: 20,
  },
  {
    code: 'KM-2607-005',
    name: 'Tháng 7: mua 20 ream tặng 1 hộp kẹp bướm',
    kind: 'Mua X tặng Y',
    period: '01/07 – 31/07/2026',
    channel: 'Tất cả',
    budget: { usedPct: 100, used: '15000000', total: '15000000' },
    slotsLeft: 0,
    status: { tone: 'neutral', label: 'Kết thúc' },
    priority: 10,
  },
  {
    code: 'KM-2606-003',
    name: 'Hè 2026: giảm 150.000 đơn ≥ 5.000.000',
    kind: 'Giảm tiền',
    period: '01/06 – 30/06/2026',
    channel: 'Điện thoại, Zalo',
    budget: { usedPct: 94, used: '47100000', total: '50000000' },
    slotsLeft: 0,
    status: { tone: 'neutral', label: 'Kết thúc' },
    priority: 5,
  },
  {
    code: 'KM-2602-001',
    name: 'Tết 2026: tặng lịch bàn cho đơn ≥ 1.500.000',
    kind: 'Mua X tặng Y',
    period: '15/01 – 10/02/2026',
    channel: 'Tất cả',
    budget: { usedPct: 100, used: '25000000', total: '25000000' },
    slotsLeft: 0,
    status: { tone: 'neutral', label: 'Kết thúc' },
    priority: 5,
  },
];

const TABS = [
  { label: 'Tất cả', count: 22, active: true },
  { label: 'Đang chạy', count: 9 },
  { label: 'Sắp chạy', count: 3 },
  { label: 'Nháp', count: 2 },
  { label: 'Tạm dừng', count: 1 },
  { label: 'Kết thúc', count: 7 },
];

export function PromotionsScreen() {
  return (
    <>
      <PageHeader
        title="Chương trình khuyến mãi"
        description="22 chương trình · 9 đang chạy · 2 vượt 90% ngân sách"
        breadcrumb={[{ label: 'Giá & KM' }, { label: 'Khuyến mãi' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button size="sm" asChild>
              <Link href="/pricing/promotions/new">
                Tạo chương trình
                <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                  N
                </kbd>
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
        <div className="flex h-7 w-72 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          Tìm tên, mã chương trình…
        </div>
        <FilterChip>Loại</FilterChip>
        <FilterChip>Kênh</FilterChip>
        <FilterChip on>
          Hiệu lực: tháng 8/2026 <X className="size-3 opacity-70" />
        </FilterChip>
        <FilterChip>Nhóm KH</FilterChip>
        <Button variant="ghost" size="sm" className="h-7 px-2 font-normal text-muted-foreground">
          <Plus className="size-3.5" /> Lọc
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Đã lưu: <span className="font-semibold text-foreground">Tháng này</span>
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
              <TableHead className="px-2.5">Tên chương trình</TableHead>
              <TableHead className="px-2.5">Loại</TableHead>
              <TableHead className="px-2.5">Hiệu lực</TableHead>
              <TableHead className="px-2.5">Kênh</TableHead>
              <TableHead className="w-56 px-2.5">Ngân sách / đã dùng</TableHead>
              <TableHead className="px-2.5 text-right">Suất còn</TableHead>
              <TableHead className="px-2.5">Trạng thái</TableHead>
              <TableHead className="px-2.5 text-right">Ưu tiên</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_PROMOTIONS.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="px-2.5 py-1.5">
                  <Checkbox aria-label={`Chọn ${r.code}`} />
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <span className="font-mono text-xs text-primary">{r.code}</span>
                </TableCell>
                <TableCell className="max-w-80 truncate px-2.5 py-1.5 font-semibold">
                  {r.name}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <StatusBadge tone={KIND_TONE[r.kind]}>{r.kind}</StatusBadge>
                </TableCell>
                <TableCell
                  className={cn(
                    'whitespace-nowrap px-2.5 py-1.5 tabular-nums',
                    r.periodMuted && 'text-muted-foreground',
                  )}
                >
                  {r.period}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">{r.channel}</TableCell>
                <TableCell className="px-2.5 py-1.5">
                  {r.budget ? (
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            r.budget.usedPct >= 95
                              ? 'bg-destructive'
                              : r.budget.usedPct >= 90
                                ? 'bg-warning'
                                : 'bg-primary',
                          )}
                          style={{ width: `${r.budget.usedPct}%` }}
                        />
                      </span>
                      <span className="whitespace-nowrap text-xs tabular-nums">
                        {formatMoney(r.budget.used, { unit: '' })} /{' '}
                        {formatMoney(r.budget.total, { unit: '' })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 shrink-0 rounded-full bg-muted" />
                      <span className="text-xs text-muted-foreground">Chưa có ngân sách</span>
                    </div>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 text-right tabular-nums',
                    r.slotsLeft === null && 'text-muted-foreground',
                    r.slotsLow && 'font-semibold text-destructive',
                  )}
                >
                  {r.slotsLeft === null ? '—' : r.slotsLeft}
                </TableCell>
                <TableCell className="px-2.5 py-1.5">
                  <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                </TableCell>
                <TableCell
                  className={cn(
                    'px-2.5 py-1.5 text-right tabular-nums',
                    r.priority === null && 'text-muted-foreground',
                  )}
                >
                  {r.priority === null ? '—' : r.priority}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span>Hiển thị 1–22 / 22</span>
          <span>· Đã dùng = tổng giá trị ưu đãi đã ghi nhận trên đơn xác nhận</span>
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

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: cột &quot;Suất còn&quot; là số suất chưa bị giành; server giảm bằng UPDATE
          atomic, nên con số này chỉ là ảnh chụp lúc tải trang.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: ngân sách ≥ 90% hiện vàng, ≥ 95% hiện đỏ — chỉ là cảnh báo, chương trình vẫn chạy
          tới khi hết suất.
        </div>
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
