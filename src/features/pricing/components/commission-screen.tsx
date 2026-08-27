// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface TierRuleRow {
  from: string;
  to: string | null;
  rate: string;
}

const SAMPLE_TIER_RULES: TierRuleRow[] = [
  { from: '0', to: '199.999.999', rate: '1,0 %' },
  { from: '200.000.000', to: '399.999.999', rate: '1,5 %' },
  { from: '400.000.000', to: '699.999.999', rate: '2,0 %' },
  { from: '700.000.000', to: null, rate: '2,5 %' },
];

interface CommissionRow {
  name: string;
  leader?: boolean;
  teamBonus?: boolean;
  team: string;
  invoiced: string | null;
  collected: string;
  tier: string | null;
  commission: string;
  clawback: string | null;
  net: string;
  status: { tone: StatusTone; label: string };
}

const SAMPLE_COMMISSIONS: CommissionRow[] = [
  {
    name: 'Nguyễn Văn An',
    team: 'Sale Hà Nội',
    invoiced: '512.400.000',
    collected: '486.200.000',
    tier: '2,0%',
    commission: '9.724.000',
    clawback: null,
    net: '9.724.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Trần Thị Bình',
    leader: true,
    team: 'Sale Hà Nội',
    invoiced: '388.900.000',
    collected: '371.500.000',
    tier: '1,5%',
    commission: '5.572.500',
    clawback: '−180.000',
    net: '5.392.500',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: '↳ thưởng team Sale Hà Nội 0,3%',
    teamBonus: true,
    team: '',
    invoiced: null,
    collected: '1.842.600.000',
    tier: null,
    commission: '5.527.800',
    clawback: null,
    net: '5.527.800',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Lê Minh Châu',
    team: 'Sale Hà Nội',
    invoiced: '296.300.000',
    collected: '281.100.000',
    tier: '1,5%',
    commission: '4.216.500',
    clawback: null,
    net: '4.216.500',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Phạm Thu Hà',
    team: 'Sale Hà Nội',
    invoiced: '174.800.000',
    collected: '158.200.000',
    tier: '1,0%',
    commission: '1.582.000',
    clawback: null,
    net: '1.582.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Hoàng Đức Long',
    team: 'Sale Hà Nội',
    invoiced: '402.100.000',
    collected: '365.400.000',
    tier: '1,5%',
    commission: '5.481.000',
    clawback: null,
    net: '5.481.000',
    status: { tone: 'warn', label: 'Chờ đối soát' },
  },
  {
    name: 'Đặng Quang Huy',
    leader: true,
    team: 'Sale HCM',
    invoiced: '455.600.000',
    collected: '441.900.000',
    tier: '2,0%',
    commission: '8.838.000',
    clawback: null,
    net: '8.838.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: '↳ thưởng team Sale HCM 0,3%',
    teamBonus: true,
    team: '',
    invoiced: null,
    collected: '2.104.300.000',
    tier: null,
    commission: '6.312.900',
    clawback: null,
    net: '6.312.900',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Bùi Thanh Tùng',
    team: 'Sale HCM',
    invoiced: '733.200.000',
    collected: '712.800.000',
    tier: '2,5%',
    commission: '17.820.000',
    clawback: null,
    net: '17.820.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Ngô Thị Lan',
    team: 'Sale HCM',
    invoiced: '318.700.000',
    collected: '302.400.000',
    tier: '1,5%',
    commission: '4.536.000',
    clawback: '−425.000',
    net: '4.111.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Lý Hải Yến',
    team: 'Sale HCM',
    invoiced: '190.400.000',
    collected: '176.000.000',
    tier: '1,0%',
    commission: '1.760.000',
    clawback: null,
    net: '1.760.000',
    status: { tone: 'warn', label: 'Chờ đối soát' },
  },
  {
    name: 'Đỗ Kim Ngân',
    leader: true,
    team: 'Sale Đà Nẵng',
    invoiced: '302.500.000',
    collected: '288.700.000',
    tier: '1,5%',
    commission: '4.330.500',
    clawback: null,
    net: '4.330.500',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: '↳ thưởng team Sale Đà Nẵng 0,3%',
    teamBonus: true,
    team: '',
    invoiced: null,
    collected: '812.500.000',
    tier: null,
    commission: '2.437.500',
    clawback: null,
    net: '2.437.500',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Phan Gia Bảo',
    team: 'Sale Đà Nẵng',
    invoiced: '198.700.000',
    collected: '186.300.000',
    tier: '1,0%',
    commission: '1.863.000',
    clawback: null,
    net: '1.863.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
  {
    name: 'Võ Thị Hồng',
    team: 'Sale Đà Nẵng',
    invoiced: '156.200.000',
    collected: '141.800.000',
    tier: '1,0%',
    commission: '1.418.000',
    clawback: null,
    net: '1.418.000',
    status: { tone: 'draft', label: 'Tạm tính' },
  },
];

export function CommissionScreen() {
  return (
    <>
      <PageHeader
        title="Hoa hồng nhân viên"
        description="Kỳ 08/2026 · 01/08 – 31/08/2026 · tính trên hóa đơn đã phát hành và đã thu tiền"
        breadcrumb={[{ label: 'Giá & KM' }, { label: 'Hoa hồng' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Tính lại kỳ
            </Button>
            <Button variant="outline" size="sm">
              Xuất bảng kê
            </Button>
            <Button size="sm">Chốt kỳ 08/2026</Button>
          </>
        }
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-md border bg-warning/10 px-3 py-2 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Chưa chốt chính sách:</span> sale member thấy hoa hồng của
          riêng mình hay thấy cả team. Màn này chỉ dành cho admin/kế toán; màn cho sale chưa thiết
          kế cho tới khi có quyết định.
        </p>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-12">
        {/* Cột trái: quy tắc */}
        <section className="flex min-w-0 flex-col rounded-md border bg-card xl:col-span-4">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Quy tắc tính hoa hồng</h2>
            <StatusBadge tone="ok">Hiệu lực từ 01/07/2026</StatusBadge>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-3">
            <Field
              label="Cơ sở tính"
              hint="Đã thu tiền = hóa đơn phát hành và cấn trừ đủ trong kỳ hoặc kỳ sau (truy thu)"
            >
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Radio>Doanh thu đơn xác nhận</Radio>
                <Radio on>Hóa đơn đã thu tiền</Radio>
              </div>
            </Field>
            <Field label="Loại quy tắc">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Radio>Tỷ lệ % cố định</Radio>
                <Radio on>Theo bậc doanh thu tháng</Radio>
              </div>
            </Field>
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-12 gap-2 border-b bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                <span className="col-span-4">Doanh thu từ</span>
                <span className="col-span-4">Đến</span>
                <span className="col-span-3 text-right">Tỷ lệ</span>
                <span className="col-span-1" />
              </div>
              {SAMPLE_TIER_RULES.map((t, i) => (
                <div
                  key={t.from}
                  className={cn(
                    'grid grid-cols-12 items-center gap-2 px-2.5 py-1.5',
                    i < SAMPLE_TIER_RULES.length - 1 && 'border-b',
                  )}
                >
                  <FakeInput className="col-span-4 h-7 justify-end tabular-nums">
                    {t.from}
                  </FakeInput>
                  {t.to ? (
                    <FakeInput className="col-span-4 h-7 justify-end tabular-nums">
                      {t.to}
                    </FakeInput>
                  ) : (
                    <div className="col-span-4 flex h-7 items-center justify-end rounded-md border bg-muted px-2 text-sm text-muted-foreground">
                      trở lên
                    </div>
                  )}
                  <FakeInput className="col-span-3 h-7 justify-end tabular-nums">
                    {t.rate}
                  </FakeInput>
                  <span className="col-span-1 text-center text-muted-foreground">
                    <X className="inline size-3.5" />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 shrink-0">
                + Thêm bậc
              </Button>
              <p className="text-xs text-muted-foreground">
                Bậc tính lũy tiến toàn phần: đạt bậc nào áp tỷ lệ đó cho toàn bộ doanh thu
              </p>
            </div>
            <div className="flex gap-3">
              <Field label="Thưởng leader trên team" className="flex-1">
                <FakeInput className="justify-end tabular-nums">0,3 %</FakeInput>
              </Field>
              <Field label="Trừ khi hoàn/hủy HĐ" className="flex-1">
                <FakeInput caret>Truy thu kỳ sau</FakeInput>
              </Field>
            </div>
            <Field label="Loại trừ">
              <div className="flex flex-wrap gap-1.5">
                <Chip>
                  Khách online không có sale <X className="size-3 text-muted-foreground" />
                </Chip>
                <Chip>
                  Nhóm Mực in chính hãng (margin thấp){' '}
                  <X className="size-3 text-muted-foreground" />
                </Chip>
              </div>
            </Field>
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm">
                Xem lịch sử quy tắc
              </Button>
              <Button variant="outline" size="sm">
                Lưu quy tắc
              </Button>
            </div>
          </div>
        </section>

        {/* Cột phải: bảng kê kỳ */}
        <section className="min-w-0 rounded-md border bg-card xl:col-span-8">
          <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
              Kỳ: 08/2026 <X className="size-3 opacity-70" />
            </span>
            <FilterChip>Team: Tất cả</FilterChip>
            <FilterChip>Trạng thái</FilterChip>
            <span className="ml-auto text-xs text-muted-foreground">
              23 sale · DT đã thu{' '}
              <span className="font-semibold text-foreground tabular-nums">6.420.350.000</span> ·
              hoa hồng{' '}
              <span className="font-semibold text-foreground tabular-nums">104.218.500</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-8 px-2.5">
                    <Checkbox aria-label="Chọn tất cả" />
                  </TableHead>
                  <TableHead className="px-2.5">Nhân viên</TableHead>
                  <TableHead className="px-2.5">Team</TableHead>
                  <TableHead className="px-2.5 text-right">DT hóa đơn</TableHead>
                  <TableHead className="px-2.5 text-right">DT đã thu</TableHead>
                  <TableHead className="px-2.5 text-right">Bậc</TableHead>
                  <TableHead className="px-2.5 text-right">Hoa hồng</TableHead>
                  <TableHead className="px-2.5 text-right">Truy thu</TableHead>
                  <TableHead className="px-2.5 text-right">Thực nhận</TableHead>
                  <TableHead className="px-2.5">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_COMMISSIONS.map((r, i) => (
                  <TableRow key={`${r.name}-${i}`}>
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox aria-label={`Chọn ${r.name}`} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5',
                        r.teamBonus ? 'pl-7 text-muted-foreground' : 'font-semibold',
                      )}
                    >
                      {r.name} {r.leader ? <StatusBadge tone="neutral">leader</StatusBadge> : null}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{r.team}</TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        !r.invoiced && 'text-muted-foreground',
                      )}
                    >
                      {r.invoiced ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.collected}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        !r.tier && 'text-muted-foreground',
                      )}
                    >
                      {r.tier ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.commission}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'px-2.5 py-1.5 text-right tabular-nums',
                        r.clawback ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {r.clawback ?? '0'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                      {r.net}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-semibold hover:bg-muted">
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5">Tổng kỳ 08/2026</TableCell>
                  <TableCell className="px-2.5 py-1.5">23 sale</TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    6.809.400.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    6.420.350.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5" />
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    104.823.500
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums text-destructive">
                    −605.000
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                    104.218.500
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>Hiển thị 1–19 / 26 dòng</span>
            <span>· Kỳ 07/2026 đã chốt 05/08/2026 bởi Lê Thị Hương · không sửa được</span>
            <div className="ml-auto flex items-center gap-1">
              <PagerButton>‹</PagerButton>
              <PagerButton on>1</PagerButton>
              <PagerButton>2</PagerButton>
              <PagerButton>›</PagerButton>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: &quot;Chốt kỳ&quot; là không đảo ngược (bảng kê đi sang lương) → có confirm
          dialog. Sau chốt, mọi truy thu rơi vào kỳ kế tiếp.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: quy tắc có hiệu lực theo ngày; đổi quy tắc giữa kỳ không tính lại kỳ đã chốt.
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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

function Radio({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-block size-3.5 rounded-full border',
          on ? 'border-4 border-primary' : 'border-input bg-background',
        )}
      />
      {children}
    </span>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-sm">
      {children}
      <ChevronDown className="size-3 text-muted-foreground" />
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
