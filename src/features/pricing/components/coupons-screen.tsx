// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { ChevronDown, Plus, Search, X } from 'lucide-react';
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

interface CouponRow {
  code: string;
  program: string;
  value: string;
  usage: string;
  customer: string | null;
  expires: string;
  status: { tone: StatusTone; label: string };
  lastUsed: string | null;
}

const PROGRAM = 'Khai giảng: giảm 50.000 cho đơn vở ≥ 1.000.000';

const SAMPLE_COUPONS: CouponRow[] = [
  {
    code: 'KG26-7H3K-A2QM',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Nhà sách Phương Nam Q.1',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '22/08/2026 16:40',
  },
  {
    code: 'KG26-9XC2-PL4D',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'ok', label: 'Còn hiệu lực' },
    lastUsed: null,
  },
  {
    code: 'KG26-M2N8-ZK1T',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Cửa hàng Minh Tâm',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '22/08/2026 11:02',
  },
  {
    code: 'KG26-4RTY-B7WQ',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'ok', label: 'Còn hiệu lực' },
    lastUsed: null,
  },
  {
    code: 'KG26-Q8LP-3MHD',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Công ty TNHH Hòa Phát Văn Phòng Phẩm',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '21/08/2026 09:15',
  },
  {
    code: 'KG26-V5JE-8NCA',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'err', label: 'Đã thu hồi' },
    lastUsed: null,
  },
  {
    code: 'KG26-D1KS-6TRF',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'ok', label: 'Còn hiệu lực' },
    lastUsed: null,
  },
  {
    code: 'KG26-2WXN-H9PL',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Văn phòng phẩm Thu Hà (Cầu Giấy)',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '20/08/2026 14:33',
  },
  {
    code: 'KG26-8GFA-K3VB',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'ok', label: 'Còn hiệu lực' },
    lastUsed: null,
  },
  {
    code: 'KG26-N3BR-Y5QE',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Trường THCS Nguyễn Du',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '19/08/2026 10:48',
  },
  {
    code: 'KG26-T4MK-7JWN',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'err', label: 'Đã thu hồi' },
    lastUsed: null,
  },
  {
    code: 'KG26-Z6QA-F8CB',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Nhà sách Tân Định',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '18/08/2026 15:20',
  },
  {
    code: 'KG26-B2ES-4HRT',
    program: PROGRAM,
    value: '50.000',
    usage: '0 / 1',
    customer: null,
    expires: '05/09/2026',
    status: { tone: 'ok', label: 'Còn hiệu lực' },
    lastUsed: null,
  },
  {
    code: 'KG26-C5RW-9ZMT',
    program: PROGRAM,
    value: '50.000',
    usage: '1 / 1',
    customer: 'Công ty CP In & Bao bì Sao Mai',
    expires: '05/09/2026',
    status: { tone: 'neutral', label: 'Đã dùng hết' },
    lastUsed: '17/08/2026 08:57',
  },
];

const TABS = [
  { label: 'Tất cả', count: 500, active: true },
  { label: 'Còn hiệu lực', count: 355 },
  { label: 'Đã dùng hết', count: 112 },
  { label: 'Hết hạn', count: 0 },
  { label: 'Đã thu hồi', count: 33 },
];

export function CouponsScreen() {
  return (
    <>
      <PageHeader
        title="Mã giảm giá"
        description="1.240 mã · 312 đã dùng · 48 hết hạn trong 7 ngày"
        breadcrumb={[{ label: 'Giá & KM' }, { label: 'Mã giảm giá' }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              Xuất CSV
            </Button>
            <Button variant="outline" size="sm">
              Tạo 1 mã
            </Button>
            <Button size="sm">
              Sinh hàng loạt
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                N
              </kbd>
            </Button>
          </>
        }
      />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
            <div className="flex h-7 w-64 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground">
              <Search className="size-4 shrink-0" />
              Tìm mã, khách hàng…
            </div>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-secondary px-2 text-sm font-semibold text-primary">
              Chương trình: KM-2608-010 <X className="size-3 opacity-70" />
            </span>
            <FilterChip>Trạng thái</FilterChip>
            <FilterChip>Hạn dùng</FilterChip>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-normal text-muted-foreground"
            >
              <Plus className="size-3.5" /> Lọc
            </Button>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Đã lưu: <span className="font-semibold text-foreground">Khai giảng</span>
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
                  <TableHead className="px-2.5">Chương trình</TableHead>
                  <TableHead className="px-2.5">Giá trị</TableHead>
                  <TableHead className="px-2.5 text-right">Đã dùng / giới hạn</TableHead>
                  <TableHead className="px-2.5">KH đã dùng</TableHead>
                  <TableHead className="px-2.5">Hạn dùng</TableHead>
                  <TableHead className="px-2.5">Trạng thái</TableHead>
                  <TableHead className="px-2.5">Dùng gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_COUPONS.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="px-2.5 py-1.5">
                      <Checkbox aria-label={`Chọn ${r.code}`} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs font-semibold">
                      {r.code}
                    </TableCell>
                    <TableCell className="max-w-64 truncate px-2.5 py-1.5">{r.program}</TableCell>
                    <TableCell className="px-2.5 py-1.5 tabular-nums">{r.value}</TableCell>
                    <TableCell className="px-2.5 py-1.5 text-right tabular-nums">
                      {r.usage}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'max-w-52 truncate px-2.5 py-1.5',
                        !r.customer && 'text-muted-foreground',
                      )}
                    >
                      {r.customer ?? '—'}
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 tabular-nums">{r.expires}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5 tabular-nums text-muted-foreground">
                      {r.lastUsed ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span>Hiển thị 1–22 / 500</span>
              <span>· Chọn nhiều → Thu hồi (đảo ngược được trong 10 giây)</span>
              <div className="ml-auto flex items-center gap-1">
                <PagerButton>‹</PagerButton>
                <PagerButton on>1</PagerButton>
                <PagerButton>2</PagerButton>
                <PagerButton>3</PagerButton>
                <PagerButton>…</PagerButton>
                <PagerButton>23</PagerButton>
                <PagerButton>›</PagerButton>
                <span className="ml-2 inline-flex items-center gap-0.5">
                  22 dòng/trang <ChevronDown className="size-3" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Ghi chú: lượt dùng mã cũng là claim atomic ở server (giống suất KM). Cột &quot;Đã
            dùng&quot; chỉ cập nhật sau khi đơn xác nhận, không tính đơn nháp.
          </div>
        </div>

        {/* Panel sinh hàng loạt — hiển thị tĩnh cạnh danh sách */}
        <aside className="hidden w-96 shrink-0 flex-col rounded-md border bg-card xl:flex">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Sinh mã hàng loạt</span>
            <span className="text-sm text-muted-foreground">Esc đóng</span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <Field
              label="Chương trình"
              required
              hint="Mã chỉ có hiệu lực trong khoảng ngày của chương trình"
            >
              <FakeInput caret>
                <span className="mr-1 font-mono text-xs">KM-2609-002</span> Trung thu: tặng hộp bút
                màu…
              </FakeInput>
            </Field>
            <div className="flex gap-3">
              <Field label="Tiền tố" className="flex-1">
                <div className="flex h-8 items-center rounded-md border border-primary bg-background px-2 text-sm ring-2 ring-secondary">
                  TT26
                </div>
              </Field>
              <Field label="Số lượng" required className="flex-1">
                <FakeInput className="justify-end tabular-nums">300</FakeInput>
              </Field>
              <Field label="Độ dài phần ngẫu nhiên" className="flex-1">
                <FakeInput className="justify-end tabular-nums">8</FakeInput>
              </Field>
            </div>
            <div className="flex gap-3">
              <Field label="Giá trị" className="flex-1">
                <div className="flex h-8 items-center gap-4 text-sm">
                  <Radio>%</Radio>
                  <Radio on>Tiền</Radio>
                </div>
              </Field>
              <Field label="Số tiền giảm" className="flex-1">
                <FakeInput className="justify-end tabular-nums">80.000</FakeInput>
              </Field>
              <Field label="Đơn tối thiểu" className="flex-1">
                <FakeInput className="justify-end tabular-nums">3.000.000</FakeInput>
              </Field>
            </div>
            <div className="flex gap-3">
              <Field label="Hạn dùng" className="flex-1">
                <FakeInput caret>25/09/2026</FakeInput>
              </Field>
              <Field label="Mỗi mã dùng tối đa" className="flex-1">
                <FakeInput className="justify-end tabular-nums">1</FakeInput>
              </Field>
              <Field label="Mỗi KH tối đa" className="flex-1">
                <FakeInput className="justify-end tabular-nums">1</FakeInput>
              </Field>
            </div>
            <Field
              label="Gán sẵn cho khách (tùy chọn)"
              hint="Để trống = mã dùng chung, ai nhập trước được trước"
            >
              <FakeInput caret muted>
                Chọn nhóm KH để mỗi KH nhận 1 mã riêng…
              </FakeInput>
            </Field>
            <Field label="Xem trước định dạng">
              <div className="rounded-md border bg-muted p-2.5 font-mono text-xs leading-5">
                TT26-K7M2-Q9XA
                <br />
                TT26-3PLD-H4NB
                <br />
                TT26-W8ZC-R1TE
                <br />
                <span className="font-sans text-muted-foreground">
                  … 297 mã nữa, sinh ở server, không trùng toàn hệ thống
                </span>
              </div>
            </Field>
            <div className="rounded-md border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
              Sinh xong sẽ có nút <span className="font-semibold text-foreground">Xuất CSV</span> để
              gửi marketing. Mã đã sinh không sửa được, chỉ thu hồi.
            </div>
          </div>
          <div className="mt-auto flex justify-end gap-2 border-t px-4 py-3">
            <Button variant="ghost" size="sm">
              Hủy bỏ
            </Button>
            <Button size="sm">
              Sinh 300 mã
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                Ctrl ↵
              </kbd>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FakeInput({
  children,
  caret,
  muted,
  className,
}: {
  children?: React.ReactNode;
  caret?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center truncate rounded-md border border-input bg-background px-2 text-sm',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {caret ? <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
    </div>
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
