// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).
'use client';

import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
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
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';

interface PreviewLine {
  sku: string;
  qty: string;
  amount: string;
  gift?: boolean;
}

const SAMPLE_PREVIEW_LINES: PreviewLine[] = [
  { sku: 'DA-A4-80', qty: '12 ream', amount: '828.000' },
  { sku: 'IK-A4-70', qty: '20 ream', amount: '1.120.000' },
  { sku: 'TL08-BLUE', qty: '5 thùng', amount: '850.000' },
  { sku: 'PL-KG50', qty: '1 hộp', amount: 'tặng', gift: true },
];

export function PromotionBuilderScreen() {
  return (
    <>
      <header className="mb-4 space-y-2">
        <Breadcrumb
          items={[
            { label: 'Giá & KM' },
            { label: 'Khuyến mãi', href: '/pricing/promotions' },
            { label: 'Tạo chương trình' },
          ]}
        />
        <div className="flex min-h-9 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold leading-tight">
              Tạo chương trình khuyến mãi
              <StatusBadge tone="draft">Nháp</StatusBadge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Mã: <span className="font-mono text-xs">(tự động khi lưu)</span> · chưa lưu
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
              Kích hoạt
              <kbd className="rounded-sm border border-primary-foreground/40 px-1 font-mono text-xs">
                Alt ↵
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-12">
        {/* Cột trái: thông tin chung */}
        <section className="rounded-md border bg-card xl:col-span-3">
          <h2 className="border-b px-3 py-2 text-sm font-semibold">Thông tin chung</h2>
          <div className="space-y-3 p-3">
            <Field label="Tên chương trình" required>
              <FakeInput>Quý 4: giảm 100.000 nhóm Giấy</FakeInput>
            </Field>
            <Field label="Loại ưu đãi">
              <FakeInput caret>Giảm tiền</FakeInput>
            </Field>
            <div className="flex gap-2">
              <Field label="Từ ngày" className="flex-1">
                <FakeInput caret>01/10/2026</FakeInput>
              </Field>
              <Field label="Đến ngày" className="flex-1">
                <FakeInput caret>31/12/2026</FakeInput>
              </Field>
            </div>
            <Field label="Kênh áp dụng">
              <div className="flex flex-wrap gap-1.5">
                <Chip on>Điện thoại</Chip>
                <Chip on>Zalo</Chip>
                <Chip>Online</Chip>
                <Chip>Tại quầy</Chip>
              </div>
            </Field>
            <Field label="Nhóm khách hàng">
              <div className="flex flex-wrap gap-1.5">
                <Chip>
                  Đại lý cấp 1 MB <X className="size-3 text-muted-foreground" />
                </Chip>
                <Chip>
                  Đại lý cấp 1 MN <X className="size-3 text-muted-foreground" />
                </Chip>
                <span className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-input px-2 text-sm text-primary">
                  + Thêm
                </span>
              </div>
            </Field>
            <Field label="Ưu tiên">
              <FakeInput className="w-24 justify-end tabular-nums">10</FakeInput>
              <p className="text-xs text-muted-foreground">
                Số nhỏ = xét trước. Cùng đơn chỉ áp 1 KM giảm tiền.
              </p>
            </Field>
            <Field label="Cộng gộp với KM khác">
              <div className="flex items-center gap-4 text-sm">
                <Radio on>Không</Radio>
                <Radio>Có</Radio>
              </div>
            </Field>
            <Field label="Ngân sách tối đa">
              <FakeInput className="justify-end tabular-nums">80.000.000</FakeInput>
            </Field>
            <Field label="Mô tả nội bộ">
              <div className="flex h-14 items-start rounded-md border border-input bg-background px-2 pt-1.5 text-sm text-muted-foreground">
                Ghi chú cho sale…
              </div>
            </Field>
          </div>
        </section>

        {/* Cột giữa: điều kiện + ưu đãi */}
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-6">
          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Điều kiện áp dụng</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Đơn phải thỏa:</span>
                <Switch2 a="Tất cả (AND)" b="Bất kỳ (OR)" onA />
              </div>
            </div>
            <div className="space-y-1.5 p-3">
              <RuleRow
                c1={<FakeInput caret>Tổng đơn</FakeInput>}
                c2={<FakeInput muted>sau chiết khấu dòng, trước thuế</FakeInput>}
                c3={<FakeInput caret>≥</FakeInput>}
                c4={<FakeInput className="justify-end tabular-nums">2.000.000</FakeInput>}
              />
              <OpRow onA />
              <RuleRow
                c1={<FakeInput caret>SL trong nhóm</FakeInput>}
                c2={<FakeInput caret>Giấy in &amp; photocopy</FakeInput>}
                c3={<FakeInput caret>≥</FakeInput>}
                c4={
                  <FakeInput className="justify-end tabular-nums">
                    10&nbsp;<span className="text-muted-foreground">ream</span>
                  </FakeInput>
                }
              />
              <OpRow onA />
              <RuleRow
                c1={<FakeInput caret>Nhóm KH</FakeInput>}
                c2={<FakeInput caret>Đại lý cấp 1 MB, Đại lý cấp 1 MN</FakeInput>}
                c3={<FakeInput caret>thuộc</FakeInput>}
                c4={<FakeInput muted>—</FakeInput>}
              />
              <OpRow onB />
              <div className="flex items-center gap-1.5 rounded-md border border-dashed bg-background p-1.5">
                <div className="flex h-8 w-40 shrink-0 items-center rounded-md border border-primary bg-background px-2 text-sm text-muted-foreground ring-2 ring-secondary">
                  Chọn điều kiện…
                  <ChevronDown className="ml-auto size-3.5" />
                </div>
                <div className="h-8 flex-1 rounded-md border bg-muted" />
                <div className="h-8 w-16 shrink-0 rounded-md border bg-muted" />
                <div className="h-8 w-28 shrink-0 rounded-md border bg-muted" />
                <span className="w-5" />
              </div>
              <p className="text-xs text-muted-foreground">
                Điều kiện khả dụng: Tổng đơn · SL SKU · SL trong nhóm · Nhóm KH · Hạng KH · Kênh ·
                Lần mua đầu · Ngày trong tuần
              </p>
            </div>
          </section>

          <section className="flex-1 rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Ưu đãi</h2>
              <Button variant="outline" size="sm" className="h-7">
                + Thêm ưu đãi
              </Button>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="flex items-center gap-1.5">
                <FakeInput caret className="w-40 shrink-0">
                  Giảm tiền
                </FakeInput>
                <FakeInput muted className="min-w-0 flex-1">
                  trừ thẳng vào tổng đơn
                </FakeInput>
                <FakeInput className="w-28 shrink-0 justify-end tabular-nums">100.000</FakeInput>
                <X className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-1.5">
                <FakeInput caret className="w-40 shrink-0">
                  Tặng SKU
                </FakeInput>
                <FakeInput caret className="min-w-0 flex-1">
                  <span className="mr-1 font-mono text-xs">PL-KG50</span> Kẹp giấy Plus 50mm (hộp
                  12)
                </FakeInput>
                <FakeInput className="w-28 shrink-0 justify-end tabular-nums">
                  1&nbsp;<span className="text-muted-foreground">hộp</span>
                </FakeInput>
                <X className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-4 px-0.5">
                <Field label="Giảm % (nếu có)" className="w-40">
                  <FakeInput muted className="justify-end">
                    —
                  </FakeInput>
                </Field>
                <Field label="Trần giảm tối đa / đơn" className="w-40">
                  <FakeInput className="justify-end tabular-nums">100.000</FakeInput>
                </Field>
                <Field label="Áp dụng lặp" className="flex-1">
                  <div className="flex h-8 items-center gap-4 text-sm">
                    <Radio on>1 lần / đơn</Radio>
                    <Radio>Mỗi bội số điều kiện</Radio>
                  </div>
                </Field>
              </div>
              <div className="flex items-start gap-2.5 rounded-md border bg-warning/10 px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  SKU tặng <span className="font-semibold">PL-KG50</span> sẽ được reserve như dòng
                  hàng bình thường khi đơn xác nhận. Tồn khả dụng hiện tại ở Kho HN-1: 890 hộp, Kho
                  HCM-2: 120 hộp.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Cột phải: giới hạn suất + xem trước */}
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
          <section className="rounded-md border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Giới hạn suất</h2>
            <div className="space-y-2.5 p-3">
              <div className="flex gap-2">
                <Field label="Tổng số suất" className="flex-1">
                  <FakeInput className="justify-end tabular-nums">500</FakeInput>
                </Field>
                <Field label="Mỗi khách tối đa" className="flex-1">
                  <FakeInput className="justify-end tabular-nums">2</FakeInput>
                </Field>
              </div>
              <Field label="Mỗi khách / ngày">
                <FakeInput muted className="w-32 justify-end">
                  không giới hạn
                </FakeInput>
              </Field>
              <div className="rounded-md border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Giành suất là atomic.</span> Server{' '}
                <span className="font-mono text-xs">UPDATE … WHERE used &lt; total RETURNING</span>;
                0 dòng = hết suất, đơn báo ngay &quot;Khuyến mãi đã hết suất&quot; chứ không
                oversell.
              </div>
            </div>
          </section>

          <section className="flex-1 rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Xem trước</h2>
              <span className="text-xs text-muted-foreground">đơn mẫu</span>
            </div>
            <div className="space-y-1.5 p-3">
              <p className="text-xs text-muted-foreground">
                Khách: Công ty TNHH Hòa Phát Văn Phòng Phẩm · Đại lý cấp 1 MB · kênh Điện thoại
              </p>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="h-8 px-2.5 text-xs">SKU</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">SL</TableHead>
                    <TableHead className="h-8 px-2.5 text-right text-xs">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_PREVIEW_LINES.map((l) => (
                    <TableRow
                      key={l.sku}
                      className={cn(l.gift && 'bg-success/10 hover:bg-success/10')}
                    >
                      <TableCell
                        className={cn('px-2.5 py-1.5 font-mono text-xs', l.gift && 'text-success')}
                      >
                        {l.sku}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'px-2.5 py-1.5 text-right tabular-nums',
                          l.gift && 'text-success',
                        )}
                      >
                        {l.qty}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'px-2.5 py-1.5 text-right tabular-nums',
                          l.gift && 'text-success',
                        )}
                      >
                        {l.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SumRow label="Tạm tính" value="2.798.000" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Điều kiện 1: tổng ≥ 2.000.000</span>
                <StatusBadge tone="ok">thỏa</StatusBadge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Điều kiện 2: Giấy ≥ 10 ream (32)</span>
                <StatusBadge tone="ok">thỏa</StatusBadge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Giảm tiền</span>
                <span className="tabular-nums text-success">−100.000</span>
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                <span>Tổng sau KM</span>
                <span className="tabular-nums">2.698.000</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Xem trước do server tính (
                <span className="font-mono">POST /promotions/preview</span>), cùng engine với lúc
                lên đơn.
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: mỗi dòng điều kiện là 1 bản ghi; AND/OR chỉ 1 cấp, không lồng nhóm — đủ cho 95%
          chương trình, tránh builder quá phức tạp cho admin.
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Ghi chú: Kích hoạt không phải post chứng từ — đảo ngược được bằng &quot;Tạm dừng&quot;,
          nên không cần confirm dialog.
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
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
        'flex h-8 items-center truncate rounded-md border px-2 text-sm',
        muted ? 'border-border bg-muted text-muted-foreground' : 'border-input bg-background',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {caret ? <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}

function Chip({ children, on }: { children: React.ReactNode; on?: boolean }) {
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

function Switch2({ a, b, onA }: { a: string; b: string; onA?: boolean }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border text-xs">
      <span
        className={cn(
          'px-2 py-1',
          onA
            ? 'bg-primary font-semibold text-primary-foreground'
            : 'bg-background text-muted-foreground',
        )}
      >
        {a}
      </span>
      <span
        className={cn(
          'px-2 py-1',
          !onA
            ? 'bg-primary font-semibold text-primary-foreground'
            : 'bg-background text-muted-foreground',
        )}
      >
        {b}
      </span>
    </span>
  );
}

function OpRow({ onA, onB }: { onA?: boolean; onB?: boolean }) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <Switch2 a="VÀ" b="HOẶC" onA={onA && !onB} />
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function RuleRow({
  c1,
  c2,
  c3,
  c4,
}: {
  c1: React.ReactNode;
  c2: React.ReactNode;
  c3: React.ReactNode;
  c4: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-40 shrink-0">{c1}</div>
      <div className="min-w-0 flex-1">{c2}</div>
      <div className="w-16 shrink-0">{c3}</div>
      <div className="w-28 shrink-0">{c4}</div>
      <X className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-b-2 bg-background px-1 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}
