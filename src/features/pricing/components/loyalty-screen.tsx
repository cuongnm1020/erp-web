// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { ChevronDown, User, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, type StatusTone } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';

interface TierRow {
  tone: StatusTone;
  name: string;
  threshold: string;
  factor: string;
  customers: string;
}

const SAMPLE_TIERS: TierRow[] = [
  {
    tone: 'neutral',
    name: 'Thành viên',
    threshold: '0 – 49.999.999',
    factor: '×1,0',
    customers: '1.612',
  },
  {
    tone: 'brand',
    name: 'Bạc',
    threshold: '50.000.000 – 199.999.999',
    factor: '×1,2',
    customers: '486',
  },
  {
    tone: 'warn',
    name: 'Vàng',
    threshold: '200.000.000 – 499.999.999',
    factor: '×1,5',
    customers: '178',
  },
  { tone: 'ok', name: 'Kim cương', threshold: '≥ 500.000.000', factor: '×2,0', customers: '42' },
];

interface PointRow {
  at: string;
  kind: { tone: StatusTone; label: string };
  source: string;
  doc: string | null;
  orderValue: string | null;
  points: string;
  pointsDir: 'plus' | 'minus' | 'zero';
  balance: string;
  actor: string;
}

const SAMPLE_HISTORY: PointRow[] = [
  {
    at: '22/08/2026 16:41',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số Bạc ×1,2',
    doc: 'INV-2608-00412',
    orderValue: '2.698.000',
    points: '+324',
    pointsDir: 'plus',
    balance: '4.820',
    actor: 'Hệ thống',
  },
  {
    at: '19/08/2026 10:05',
    kind: { tone: 'err', label: 'Trừ' },
    source: 'Dùng điểm thanh toán đơn',
    doc: 'SO-2608-01187',
    orderValue: '1.596.400',
    points: '−1.200',
    pointsDir: 'minus',
    balance: '4.496',
    actor: 'Hệ thống',
  },
  {
    at: '15/08/2026 09:22',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số Bạc ×1,2',
    doc: 'INV-2608-00298',
    orderValue: '4.120.000',
    points: '+494',
    pointsDir: 'plus',
    balance: '5.696',
    actor: 'Hệ thống',
  },
  {
    at: '08/08/2026 14:17',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số Bạc ×1,2',
    doc: 'INV-2608-00141',
    orderValue: '1.880.000',
    points: '+226',
    pointsDir: 'plus',
    balance: '5.202',
    actor: 'Hệ thống',
  },
  {
    at: '01/08/2026 00:00',
    kind: { tone: 'brand', label: 'Nâng hạng' },
    source: 'Xét hạng tháng 8: Thành viên → Bạc (DT 12 tháng 63.400.000)',
    doc: null,
    orderValue: null,
    points: '0',
    pointsDir: 'zero',
    balance: '4.976',
    actor: 'Hệ thống',
  },
  {
    at: '28/07/2026 11:40',
    kind: { tone: 'warn', label: 'Điều chỉnh' },
    source: 'Bù điểm do lỗi hệ số kỳ 7/2026 — ticket TK-2607-0093',
    doc: 'TK-2607-0093',
    orderValue: null,
    points: '+150',
    pointsDir: 'plus',
    balance: '4.976',
    actor: 'Trần Thị Bình',
  },
  {
    at: '25/07/2026 15:03',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số ×1,0',
    doc: 'INV-2607-00876',
    orderValue: '3.250.000',
    points: '+325',
    pointsDir: 'plus',
    balance: '4.826',
    actor: 'Hệ thống',
  },
  {
    at: '18/07/2026 09:48',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số ×1,0',
    doc: 'INV-2607-00611',
    orderValue: '2.040.000',
    points: '+204',
    pointsDir: 'plus',
    balance: '4.501',
    actor: 'Hệ thống',
  },
  {
    at: '12/07/2026 13:30',
    kind: { tone: 'err', label: 'Trừ' },
    source: 'Hoàn điểm do hủy hóa đơn (thay thế)',
    doc: 'INV-2607-00402',
    orderValue: '980.000',
    points: '−98',
    pointsDir: 'minus',
    balance: '4.297',
    actor: 'Hệ thống',
  },
  {
    at: '11/07/2026 16:12',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số ×1,0',
    doc: 'INV-2607-00402',
    orderValue: '980.000',
    points: '+98',
    pointsDir: 'plus',
    balance: '4.395',
    actor: 'Hệ thống',
  },
  {
    at: '03/07/2026 10:20',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số ×1,0',
    doc: 'INV-2607-00118',
    orderValue: '5.600.000',
    points: '+560',
    pointsDir: 'plus',
    balance: '4.297',
    actor: 'Hệ thống',
  },
  {
    at: '30/06/2026 23:59',
    kind: { tone: 'neutral', label: 'Hết hạn' },
    source: 'Điểm tích kỳ 06/2025 hết hạn',
    doc: null,
    orderValue: null,
    points: '−210',
    pointsDir: 'minus',
    balance: '3.737',
    actor: 'Hệ thống',
  },
  {
    at: '24/06/2026 14:55',
    kind: { tone: 'ok', label: 'Cộng' },
    source: 'Hóa đơn phát hành · hệ số ×1,0',
    doc: 'INV-2606-00930',
    orderValue: '2.760.000',
    points: '+276',
    pointsDir: 'plus',
    balance: '3.947',
    actor: 'Hệ thống',
  },
  {
    at: '16/06/2026 09:05',
    kind: { tone: 'err', label: 'Trừ' },
    source: 'Dùng điểm thanh toán đơn',
    doc: 'SO-2606-00722',
    orderValue: '2.100.000',
    points: '−600',
    pointsDir: 'minus',
    balance: '3.671',
    actor: 'Hệ thống',
  },
];

const HISTORY_FILTERS = ['Tất cả', 'Cộng', 'Trừ', 'Hết hạn', 'Điều chỉnh'];

export function LoyaltyScreen() {
  return (
    <>
      <PageHeader
        title="Tích điểm khách hàng"
        description="Quy tắc áp dụng từ 01/01/2026 · 2.318 KH có điểm · tổng số dư 1.846.200 điểm"
        breadcrumb={[{ label: 'Giá & KM' }, { label: 'Tích điểm' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất lịch sử CSV
            </Button>
            <Button variant="outline" size="sm">
              Điều chỉnh điểm thủ công
            </Button>
            <Button size="sm">
              Lưu quy tắc
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                Ctrl S
              </kbd>
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-12">
        {/* Cột trái: quy tắc + hạng */}
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-4">
          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Quy tắc tích điểm</h2>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-success">
                  <span className="absolute right-0.5 size-3 rounded-full bg-background" />
                </span>
                Đang bật
              </span>
            </div>
            <div className="space-y-3 p-3">
              <Field label="Tỷ lệ tích">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FakeInput className="w-28 justify-end tabular-nums">10.000</FakeInput>
                  đồng =<FakeInput className="w-16 justify-end tabular-nums">1</FakeInput>
                  điểm
                </div>
              </Field>
              <div className="flex gap-3">
                <Field label="Tính trên" className="flex-1">
                  <FakeInput caret>Tổng sau KM, trước thuế</FakeInput>
                </Field>
                <Field label="Ghi nhận khi" className="flex-1">
                  <FakeInput caret>Hóa đơn đã phát hành</FakeInput>
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="Giá trị quy đổi" className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FakeInput className="w-16 justify-end tabular-nums">1</FakeInput>
                    điểm =<FakeInput className="w-24 justify-end tabular-nums">100</FakeInput>
                    đồng
                  </div>
                </Field>
                <Field label="Hết hạn sau" className="w-32">
                  <FakeInput className="justify-end tabular-nums">
                    12&nbsp;<span className="text-muted-foreground">tháng</span>
                  </FakeInput>
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="Tối thiểu để dùng" className="flex-1">
                  <FakeInput className="justify-end tabular-nums">
                    500&nbsp;<span className="text-muted-foreground">điểm</span>
                  </FakeInput>
                </Field>
                <Field label="Dùng tối đa / đơn" className="flex-1">
                  <FakeInput className="justify-end tabular-nums">
                    30&nbsp;<span className="text-muted-foreground">% tổng đơn</span>
                  </FakeInput>
                </Field>
              </div>
              <Field label="Loại trừ">
                <div className="flex flex-wrap gap-1.5">
                  <Chip>
                    Nhóm Mực in chính hãng <X className="size-3 text-muted-foreground" />
                  </Chip>
                  <Chip>
                    Kênh Online <X className="size-3 text-muted-foreground" />
                  </Chip>
                  <span className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-input px-2 text-xs text-primary">
                    + Thêm
                  </span>
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Hạng khách hàng</h2>
              <Button variant="outline" size="sm" className="h-7">
                + Thêm hạng
              </Button>
            </div>
            <div className="grid grid-cols-12 gap-2 border-b bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className="col-span-3">Hạng</span>
              <span className="col-span-5">Ngưỡng doanh thu 12 tháng</span>
              <span className="col-span-2 text-right">Hệ số</span>
              <span className="col-span-2 text-right">Số KH</span>
            </div>
            {SAMPLE_TIERS.map((t) => (
              <div
                key={t.name}
                className="grid grid-cols-12 items-center gap-2 border-b px-3 py-1.5 text-sm"
              >
                <span className="col-span-3">
                  <StatusBadge tone={t.tone}>{t.name}</StatusBadge>
                </span>
                <span className="col-span-5 truncate text-muted-foreground tabular-nums">
                  {t.threshold}
                </span>
                <span className="col-span-2">
                  <FakeInput className="h-7 justify-end tabular-nums">{t.factor}</FakeInput>
                </span>
                <span className="col-span-2 text-right tabular-nums">{t.customers}</span>
              </div>
            ))}
            <div className="p-3">
              <div className="flex gap-3">
                <Field label="Xét hạng lại" className="flex-1">
                  <FakeInput caret>Ngày 1 hàng tháng</FakeInput>
                </Field>
                <Field label="Hạ hạng" className="flex-1">
                  <FakeInput caret>Sau 2 kỳ không đạt</FakeInput>
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Hạng cũng quyết định bảng giá VIP (xem Bảng giá). Đổi ngưỡng ở đây không tự đổi bảng
                giá.
              </p>
            </div>
          </section>
        </div>

        {/* Cột phải: lịch sử điểm của một KH */}
        <section className="min-w-0 rounded-md border bg-card xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Lịch sử điểm</h2>
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <span className="font-semibold">Cửa hàng Minh Tâm</span>
                <span className="text-muted-foreground">· KH-004512</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-3.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                Hạng <StatusBadge tone="brand">Bạc</StatusBadge>
              </span>
              <span>
                Số dư{' '}
                <span className="text-base font-semibold text-foreground tabular-nums">4.820</span>{' '}
                điểm
              </span>
              <span className="tabular-nums">≈ 482.000</span>
              <span className="text-warning">320 điểm hết hạn 30/09/2026</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
            {HISTORY_FILTERS.map((f, i) => (
              <span
                key={f}
                className={cn(
                  'inline-flex h-6 items-center rounded-md border px-2 text-xs',
                  i === 0
                    ? 'border-primary bg-secondary font-semibold text-primary'
                    : 'border-input bg-background',
                )}
              >
                {f}
              </span>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              01/01/2026 – 23/08/2026 <ChevronDown className="inline size-3" />
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-2.5">Ngày</TableHead>
                  <TableHead className="px-2.5">Loại</TableHead>
                  <TableHead className="px-2.5">Nguồn</TableHead>
                  <TableHead className="px-2.5">Chứng từ</TableHead>
                  <TableHead className="px-2.5 text-right">Giá trị đơn</TableHead>
                  <TableHead className="px-2.5 text-right">Điểm</TableHead>
                  <TableHead className="px-2.5 text-right">Số dư</TableHead>
                  <TableHead className="px-2.5">Người thực hiện</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_HISTORY.map((r, i) => (
                  <TableRow key={`${r.at}-${i}`}>
                    <TableCell className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">
                      {r.at}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.kind.tone}>{r.kind.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-72 truncate px-2.5 py-1.5">{r.source}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      {r.doc ? (
                        <span className="font-mono text-xs text-primary">{r.doc}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        !r.orderValue && 'text-muted-foreground',
                      )}
                    >
                      {r.orderValue ?? '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        r.pointsDir === 'plus' && 'text-success',
                        r.pointsDir === 'minus' && 'text-destructive',
                        r.pointsDir === 'zero' && 'text-muted-foreground',
                      )}
                    >
                      {r.points}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      {r.balance}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-muted-foreground">{r.actor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>Hiển thị 1–20 / 61</span>
            <span>· Sổ điểm là append-only; sửa sai = dòng điều chỉnh kèm ticket</span>
            <div className="ml-auto flex items-center gap-1">
              <PagerButton>‹</PagerButton>
              <PagerButton on>1</PagerButton>
              <PagerButton>2</PagerButton>
              <PagerButton>3</PagerButton>
              <PagerButton>4</PagerButton>
              <PagerButton>›</PagerButton>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Ghi chú: điểm ghi nhận khi hóa đơn phát hành (không phải khi xác nhận đơn) để tránh cộng
        điểm cho đơn hủy. Hủy/thay thế hóa đơn tự sinh dòng trừ.
      </div>
    </>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FakeInput({
  children,
  caret,
  className,
}: {
  children?: React.ReactNode;
  caret?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center truncate rounded-md border border-input bg-background px-2 text-sm',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {caret ? <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs">
      {children}
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
