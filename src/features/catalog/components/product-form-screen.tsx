'use client';

// UI-first từ design canvas — dữ liệu mẫu, chưa nối API (nối ở phase FE-x).

import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/data/status-badge';
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
import { cn } from '@/lib/cn';

interface VariantMatrixRow {
  color: string;
  tip: string;
  sku: string;
  barcode: string | null;
  price: string;
}

const SAMPLE_MATRIX: VariantMatrixRow[] = [
  { color: 'Xanh', tip: '0.5', sku: 'TL08-BLUE-05', barcode: '8934567801234', price: '3.750' },
  { color: 'Xanh', tip: '0.7', sku: 'TL08-BLUE-07', barcode: '8934567801241', price: '3.750' },
  { color: 'Đỏ', tip: '0.5', sku: 'TL08-RED-05', barcode: '8934567801258', price: '3.750' },
  { color: 'Đỏ', tip: '0.7', sku: 'TL08-RED-07', barcode: null, price: '3.750' },
  { color: 'Đen', tip: '0.5', sku: 'TL08-BLACK-05', barcode: '8934567801272', price: '3.900' },
  { color: 'Đen', tip: '0.7', sku: 'TL08-BLACK-07', barcode: null, price: '3.900' },
];

function Kbd({ children, inverted }: { children: string; inverted?: boolean }) {
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

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function FakeInput({
  value,
  placeholder,
  select,
  readOnly,
  focus,
  mono,
  right,
  muted,
}: {
  value?: string;
  placeholder?: string;
  select?: boolean;
  readOnly?: boolean;
  focus?: boolean;
  mono?: boolean;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-sm',
        focus ? 'border-primary ring-1 ring-primary' : 'border-input',
        readOnly && 'bg-muted',
        mono && 'font-mono text-xs',
        right && 'justify-end tabular-nums',
      )}
    >
      <span className={cn('truncate', (placeholder ?? muted) && 'text-muted-foreground')}>
        {value ?? placeholder}
      </span>
      {select ? <span className="ml-auto text-muted-foreground">▾</span> : null}
    </div>
  );
}

function AttrChip({ dashed, children }: { dashed?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-card px-2 text-sm',
        dashed && 'border-dashed text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

const HEAD = 'px-2.5 text-xs';

export function ProductFormScreen() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Sửa sản phẩm"
        description="Sản phẩm cha TL08 · 6 biến thể · Tạo 02/03/2025 · Sửa lần cuối 21/08/2026"
        breadcrumb={[
          { label: 'Sản phẩm', href: '/catalog/products' },
          { label: 'Danh sách', href: '/catalog/products' },
          { label: 'Bút bi Thiên Long TL-08' },
          { label: 'Sửa' },
        ]}
        actions={
          <>
            <StatusBadge tone="draft">Đang sửa</StatusBadge>
            <Button variant="ghost" size="sm">
              Hủy <Kbd>Esc</Kbd>
            </Button>
            <Button size="sm">
              Lưu thay đổi <Kbd inverted>Ctrl S</Kbd>
            </Button>
          </>
        }
      />

      <div className="mb-3 rounded-md border bg-card p-3">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.8fr] gap-3">
          <Field
            label="Tên sản phẩm"
            required
            hint={'Tên biến thể tự ghép: Tên + thuộc tính (ví dụ "… xanh 0.5")'}
          >
            <FakeInput value="Bút bi Thiên Long TL-08" focus />
          </Field>
          <Field label="Danh mục" required>
            <FakeInput value="Bút viết / Bút bi" select />
          </Field>
          <Field label="Thương hiệu">
            <FakeInput value="Thiên Long" select />
          </Field>
          <Field label="ĐVT cơ bản" required>
            <FakeInput value="cái" select />
          </Field>
          <Field label="Nhóm thuế">
            <FakeInput placeholder="Chưa cấu hình" select />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.8fr] gap-3">
          <Field label="Mô tả ngắn">
            <FakeInput value="Ngòi bi, mực dầu, viết êm, nắp đậy cùng màu mực" muted />
          </Field>
          <Field label="NCC chính">
            <FakeInput value="Thiên Long Group" select />
          </Field>
          <Field label="Theo dõi lô / HSD">
            <div className="flex h-8 items-center gap-2 text-sm">
              <Checkbox aria-label="Theo dõi lô / HSD" checked />
              <span>Có · HSD 36 tháng</span>
            </div>
          </Field>
          <Field label="Ngưỡng đặt lại">
            <FakeInput value="5.000" right />
          </Field>
          <Field label="Mã cha">
            <FakeInput value="TL08" readOnly mono />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">
            Thuộc tính sinh biến thể{' '}
            <span className="font-normal text-muted-foreground">
              · 2 thuộc tính → 3 × 2 = 6 biến thể
            </span>
          </span>
          <Button variant="outline" size="sm" className="h-7">
            <Plus /> Thêm thuộc tính
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b p-3">
          <Field label="Màu">
            <div className="flex flex-wrap gap-1.5">
              <AttrChip>
                Xanh <span className="text-muted-foreground">✕</span>
              </AttrChip>
              <AttrChip>
                Đỏ <span className="text-muted-foreground">✕</span>
              </AttrChip>
              <AttrChip>
                Đen <span className="text-muted-foreground">✕</span>
              </AttrChip>
              <AttrChip dashed>+ giá trị</AttrChip>
            </div>
          </Field>
          <Field label="Ngòi (mm)">
            <div className="flex flex-wrap gap-1.5">
              <AttrChip>
                0.5 <span className="text-muted-foreground">✕</span>
              </AttrChip>
              <AttrChip>
                0.7 <span className="text-muted-foreground">✕</span>
              </AttrChip>
              <AttrChip dashed>+ giá trị</AttrChip>
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Ma trận biến thể</span>
          <span>· 6 dòng, tích để tạo</span>
          <span className="ml-auto">
            Áp cho tất cả: <span className="text-primary">giá</span> ·{' '}
            <span className="text-primary">trạng thái</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-8 px-2.5">
                  <Checkbox aria-label="Chọn tất cả biến thể" checked />
                </TableHead>
                <TableHead className={cn(HEAD, 'w-24')}>Màu</TableHead>
                <TableHead className={cn(HEAD, 'w-24')}>Ngòi</TableHead>
                <TableHead className={cn(HEAD, 'w-56')}>SKU (gợi ý, sửa được)</TableHead>
                <TableHead className={cn(HEAD, 'w-52')}>Barcode lẻ</TableHead>
                <TableHead className={cn(HEAD, 'w-32 text-right')}>Giá niêm yết</TableHead>
                <TableHead className={cn(HEAD, 'w-36')}>Trạng thái</TableHead>
                <TableHead className={cn(HEAD, 'w-8')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_MATRIX.map((v) => (
                <TableRow key={v.sku}>
                  <TableCell className="px-2.5 py-1.5">
                    <Checkbox aria-label={`Tạo ${v.sku}`} checked />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">{v.color}</TableCell>
                  <TableCell className="px-2.5 py-1.5">{v.tip}</TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <FakeInput value={v.sku} mono />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    {v.barcode ? (
                      <FakeInput value={v.barcode} mono />
                    ) : (
                      <FakeInput placeholder="quét hoặc nhập" mono />
                    )}
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <FakeInput value={v.price} right />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5">
                    <FakeInput value="Đang bán" select />
                  </TableCell>
                  <TableCell className="px-2.5 py-1.5 text-muted-foreground">✕</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
        <span className="text-sm text-muted-foreground">
          6 biến thể · 2 chưa có barcode (có thể bổ sung sau) · Số SKU đã dùng không đổi được sau
          khi có chứng từ
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm">
            Hủy <Kbd>Esc</Kbd>
          </Button>
          <Button size="sm">
            Lưu thay đổi <Kbd inverted>Ctrl S</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
