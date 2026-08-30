'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-1). Form tĩnh, chưa có zod.
import { ChevronDown, Info, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface AddressRow {
  isDefault: boolean;
  address: string;
  receiver: string;
  phone: string;
}

const SAMPLE_ADDRESSES: AddressRow[] = [
  {
    isDefault: true,
    address: 'Số 8 Nguyễn Khang, P. Yên Hòa, Cầu Giấy, Hà Nội',
    receiver: 'Chị Nhiên',
    phone: '0936 481 220',
  },
  {
    isDefault: false,
    address: 'Ki-ốt 12, chợ Nghĩa Tân, Cầu Giấy, Hà Nội',
    receiver: 'Anh Toàn',
    phone: '0975 660 138',
  },
];

function Radio({ on, label }: { on?: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={
          on
            ? 'flex h-3.5 w-3.5 items-center justify-center rounded-full border-4 border-primary bg-background'
            : 'h-3.5 w-3.5 rounded-full border border-input bg-background'
        }
      />
      {label ? <span className="text-sm">{label}</span> : null}
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `flex flex-col gap-1 ${className}` : 'flex flex-col gap-1'}>
      <Label className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SelectLike({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm">
      <span className={muted ? 'text-muted-foreground' : undefined}>{value}</span>
      <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <header className="border-b px-3 py-2 text-sm font-semibold">{title}</header>
      {children}
    </section>
  );
}

export function CustomerFormScreen({ customerId }: { customerId?: string } = {}) {
  const editing = Boolean(customerId);
  return (
    <>
      <PageHeader
        title={editing ? 'Sửa khách hàng' : 'Tạo khách hàng'}
        description={
          editing
            ? 'Đổi thông tin sẽ áp dụng ngay sau khi lưu'
            : 'Mã KH: (tự động khi lưu) · Team Hà Nội · sẽ gán cho: Nguyễn Văn An'
        }
        breadcrumb={[
          { label: 'Khách hàng', href: '/crm/customers' },
          { label: 'Danh sách', href: '/crm/customers' },
          { label: editing ? 'Sửa khách hàng' : 'Tạo khách hàng' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Hủy bỏ{' '}
              <kbd className="rounded-sm border bg-muted px-1 font-mono text-xs text-muted-foreground">
                Esc
              </kbd>
            </Button>
            <Button size="sm">
              Lưu khách hàng{' '}
              <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                Alt S
              </kbd>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 items-start gap-3">
        <div className="flex flex-col gap-3">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
              <Field label="Tên khách hàng" required className="col-span-2">
                <Input className="h-8 text-sm" defaultValue="Cửa hàng An Nhiên" />
              </Field>
              <Field label="Loại khách">
                <div className="flex h-8 items-center gap-3">
                  <Radio on label="Cá nhân / hộ KD" />
                  <Radio label="Doanh nghiệp" />
                </div>
              </Field>
              <Field label="SĐT" required hint="Dùng để dò trùng khách khi lưu">
                <Input className="h-8 font-mono text-sm" defaultValue="0936 481 220" />
              </Field>
              <Field label="Email">
                <Input className="h-8 text-sm" placeholder="ví dụ: annhien@gmail.com" />
              </Field>
              <Field label="Mã số thuế">
                <Input className="h-8 text-sm" placeholder="chỉ bắt buộc với doanh nghiệp" />
              </Field>
            </div>
          </Section>

          <Section title="Phân loại & bán hàng">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
              <Field label="Nhóm khách hàng">
                <SelectLike value="Bán lẻ" />
              </Field>
              <Field label="Cấp độ" hint="Tự nâng hạng theo doanh thu 12 tháng — xem Nhóm & cấp độ">
                <div className="flex h-8 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                  Chưa xếp hạng
                </div>
              </Field>
              <Field label="Tag">
                <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
                  <span className="inline-flex h-5 items-center gap-1 rounded-md border border-input bg-card px-1.5 text-xs">
                    Bán lẻ <X className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="inline-flex h-5 items-center gap-1 rounded-md border border-input bg-card px-1.5 text-xs">
                    Cầu Giấy <X className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="text-sm text-muted-foreground">+ thêm tag…</span>
                </div>
              </Field>
              <Field label="Bảng giá áp dụng">
                <SelectLike value="Mặc định" />
              </Field>
              <Field label="Hạn mức công nợ" hint="Mặc định nhóm Bán lẻ · vượt cần leader duyệt">
                <Input className="h-8 text-right text-sm tabular-nums" defaultValue="20.000.000" />
              </Field>
              <Field
                label="Người phụ trách"
                hint="Member chỉ tạo khách cho chính mình — leader mới gán người khác"
              >
                <div className="flex h-8 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                  Nguyễn Văn An (tôi)
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Đồng ý nhận marketing (PDPD)">
            <div className="flex items-center gap-5 px-3 py-3">
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox defaultChecked /> Email
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox defaultChecked /> SMS
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox /> Zalo
              </label>
              <Field label="Nguồn đồng ý * (bắt buộc khi tích kênh)" className="flex-1">
                <SelectLike value="Khách xác nhận qua điện thoại (có ghi âm)" />
              </Field>
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-3">
          <Section title="Địa chỉ giao hàng · 2 địa chỉ">
            <div className="flex items-center justify-between px-3 pt-2">
              <span className="text-xs text-muted-foreground">
                Địa chỉ mặc định tự điền khi tạo đơn; đổi được từng đơn.
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                <Plus aria-hidden />
                Thêm địa chỉ
              </Button>
            </div>
            <Table className="mt-2 text-sm">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-16 px-2.5 text-center text-xs">Mặc định</TableHead>
                  <TableHead className="px-2.5 text-xs">Địa chỉ</TableHead>
                  <TableHead className="w-32 px-2.5 text-xs">Người nhận</TableHead>
                  <TableHead className="w-28 px-2.5 text-xs">SĐT nhận</TableHead>
                  <TableHead className="w-14 px-2.5 text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ADDRESSES.map((a) => (
                  <TableRow key={a.address}>
                    <TableCell className="px-2.5 py-1.5 text-center">
                      <Radio on={a.isDefault} />
                    </TableCell>
                    <TableCell className="px-2.5 py-1.5">{a.address}</TableCell>
                    <TableCell className="px-2.5 py-1.5">{a.receiver}</TableCell>
                    <TableCell className="px-2.5 py-1.5 font-mono text-xs">{a.phone}</TableCell>
                    <TableCell className="px-2.5 py-1.5">
                      <button type="button" className="text-primary hover:underline">
                        Sửa
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="px-2.5 py-1.5 text-center">
                    <Radio />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5" colSpan={4}>
                    <div className="flex h-8 items-center rounded-md border border-dashed border-input px-2.5 text-sm text-muted-foreground">
                      + Nhập địa chỉ mới — Enter để thêm dòng
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Section>

          <div className="flex items-start gap-2.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Khi lưu, hệ thống dò trùng theo SĐT trên toàn công ty. Nếu trùng sẽ báo và gợi ý gộp —
              không tạo bản ghi thứ hai.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm">
              Hủy bỏ
            </Button>
            <Button variant="outline" size="sm">
              Lưu và tạo tiếp
            </Button>
            <Button size="sm">
              Lưu khách hàng{' '}
              <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                Alt S
              </kbd>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
