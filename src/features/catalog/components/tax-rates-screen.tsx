'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  DatePicker,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { RowActions } from '@/components/data/row-actions';
import { EmptyState, ListSkeleton, QueryState } from '@/components/data/states';
import { StatusBadge } from '@/components/data/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { useHotkey } from '@/lib/use-hotkey';
import { useAbility } from '@/lib/permission';
import {
  useCreateTaxRate,
  useTaxRates,
  useUpdateTaxRate,
  type TaxRate,
} from '../api/use-tax-rates';

/**
 * Danh mục thuế suất (2026-10-23, docs/PLAN-einvoice-misa.md §11.3; mockup canvas
 * CVnCtWbPyUCdn7pppHaRWX màn 7). Thuế suất gán ở CẤP SẢN PHẨM; dòng đơn chép mức lúc tạo đơn nên
 * mức đã có đơn dùng không đổi được % (server 409 TAX_RATE_IN_USE) — ô % khóa sẵn kèm lý do.
 * Thêm / sửa: `tax_rate.manage` (kế toán + ADMIN). Form thêm / sửa là hộp thoại (chưa có primitive
 * Drawer như mockup).
 */

const KIND_LABELS: Record<TaxRate['kind'], string> = {
  TAXABLE: 'Chịu thuế',
  EXEMPT: 'Không chịu thuế (KCT)',
  NOT_DECLARED: 'Không kê khai, tính nộp (KKKNT)',
};

const NONE = '__none__';

/** Hiển thị hiệu lực "đến 31/12/2026" / "từ 01/07/2025" / "01/07/2025 – 31/12/2026". */
function periodLabel(r: Pick<TaxRate, 'validFrom' | 'validTo'>): string | null {
  const d = (k: string) => formatDate(`${k}T12:00:00Z`);
  if (r.validFrom && r.validTo) return `${d(r.validFrom)} – ${d(r.validTo)}`;
  if (r.validTo) return `đến ${d(r.validTo)}`;
  if (r.validFrom) return `từ ${d(r.validFrom)}`;
  return null;
}

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,29}$/, 'Chữ in hoa, số, _ hoặc - (tối đa 30 ký tự)'),
    name: z.string().trim().min(1, 'Nhập tên thuế suất').max(100, 'Tối đa 100 ký tự'),
    kind: z.enum(['TAXABLE', 'EXEMPT', 'NOT_DECLARED']),
    ratePercent: z.string().trim(),
    validFrom: z.string(),
    validTo: z.string(),
    replacementId: z.string(),
    isDefault: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'TAXABLE' && !/^(100|\d{1,2})([.,]\d{1,2})?$/.test(v.ratePercent)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratePercent'],
        message: 'Nhập % từ 0 đến 100, tối đa 2 số lẻ',
      });
    }
    if (v.validFrom && v.validTo && v.validFrom > v.validTo) {
      ctx.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'Ngày hết hiệu lực phải sau ngày bắt đầu',
      });
    }
  });
type Values = z.infer<typeof schema>;

function misaPreview(kind: Values['kind'], percent: string): string {
  if (kind === 'EXEMPT') return 'KCT';
  if (kind === 'NOT_DECLARED') return 'KKKNT';
  return percent ? `${percent.replace(',', '.')}%` : '—';
}

function TaxRateDialog({
  rate,
  rates,
  open,
  onOpenChange,
}: {
  /** undefined = thêm mới. */
  rate?: TaxRate;
  /** Mọi mức đang dùng — chọn mức thay thế khi hết hiệu lực. */
  rates: TaxRate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = rate !== undefined;
  const create = useCreateTaxRate();
  const update = useUpdateTaxRate();
  const isPending = create.isPending || update.isPending;
  const rateLocked = rate?.usedByOrders === true;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: rate?.code ?? '',
      name: rate?.name ?? '',
      kind: rate?.kind ?? 'TAXABLE',
      ratePercent: rate?.ratePercent ?? '',
      validFrom: rate?.validFrom ?? '',
      validTo: rate?.validTo ?? '',
      replacementId: rate?.replacementId ?? '',
      isDefault: rate?.isDefault ?? false,
    },
  });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const percent = useWatch({ control: form.control, name: 'ratePercent' });
  const validTo = useWatch({ control: form.control, name: 'validTo' });

  const onSubmit = form.handleSubmit((v) => {
    const ratePercent = v.kind === 'TAXABLE' ? v.ratePercent.replace(',', '.') : undefined;
    const common = {
      name: v.name,
      validFrom: v.validFrom || null,
      validTo: v.validTo || null,
      replacementId: v.replacementId || null,
    };
    const done = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    const fail = (err: unknown) =>
      applyServerErrors(form, err as ApiError, {
        knownFields: ['code', 'name', 'ratePercent', 'validFrom', 'validTo', 'replacementId'],
      });
    if (editing) {
      update.mutate(
        {
          id: rate.id,
          body: {
            version: rate.version,
            code: v.code,
            ...common,
            ...(rateLocked ? {} : { kind: v.kind, ratePercent }),
            ...(v.isDefault && !rate.isDefault ? { isDefault: true } : {}),
          },
        },
        { onSuccess: () => done('Đã lưu thay đổi'), onError: fail },
      );
    } else {
      create.mutate(
        { code: v.code, kind: v.kind, ratePercent, isDefault: v.isDefault, ...common },
        { onSuccess: () => done('Đã thêm thuế suất'), onError: fail },
      );
    }
  });
  const rootError = form.formState.errors.root?.server?.message;
  const replacements = rates.filter((r) => r.isActive && r.id !== rate?.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{editing ? `Sửa thuế suất ${rate.code}` : 'Thêm thuế suất'}</DialogTitle>
          <DialogDescription>
            Đổi thuế suất của sản phẩm chỉ áp cho đơn tạo sau khi lưu — đơn đã tạo giữ mức lúc tạo
            đơn.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Tên *</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Thuế GTGT 8% (giảm từ 10%)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VAT8"
                      className="font-mono"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={rateLocked}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(KIND_LABELS) as Array<TaxRate['kind']>).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ratePercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thuế suất (%){kind === 'TAXABLE' ? ' *' : ''}</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="8"
                      disabled={kind !== 'TAXABLE' || rateLocked}
                      {...field}
                      value={kind === 'TAXABLE' ? field.value : '0'}
                    />
                  </FormControl>
                  {rateLocked ? (
                    <FormDescription>
                      Đã có đơn hàng dùng mức này — không đổi được %. Muốn đổi, thêm mức mới rồi gán
                      cho sản phẩm.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Tên gửi MISA</FormLabel>
              <Input value={misaPreview(kind, percent)} readOnly disabled className="font-mono" />
              <FormDescription>Tự điền theo loại và %.</FormDescription>
            </FormItem>
            <FormField
              control={form.control}
              name="validFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hiệu lực từ</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Không giới hạn"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hiệu lực đến</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Không giới hạn"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="replacementId"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Hết hiệu lực thì sản phẩm chuyển sang</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Không tự chuyển — kế toán gán lại</SelectItem>
                      {replacements.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {validTo
                      ? 'Ghi chú cho kế toán; hệ thống chưa tự chuyển — màn này cảnh báo khi mức hết hạn.'
                      : 'Chỉ cần khi mức có ngày hết hiệu lực.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!rate?.isDefault ? (
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 sm:col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Đặt làm mặc định cho sản phẩm mới</FormLabel>
                  </FormItem>
                )}
              />
            ) : null}
            {rootError ? (
              <p className="text-sm text-destructive sm:col-span-2">{rootError}</p>
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" loading={isPending} loadingText="Đang lưu…">
                {editing ? 'Lưu thay đổi' : 'Thêm thuế suất'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function TaxRatesScreen() {
  const ability = useAbility();
  const canManage = ability.can('manage', 'TaxRate');
  const [showInactive, setShowInactive] = useState(false);
  const query = useTaxRates(true);
  const update = useUpdateTaxRate();
  const [dialog, setDialog] = useState<{ open: boolean; rate?: TaxRate }>({ open: false });

  useHotkey('n', () => setDialog({ open: true }), { enabled: canManage });

  const all = query.data?.items ?? [];
  const active = all.filter((r) => r.isActive);
  const rows = showInactive ? all : active;
  const def = active.find((r) => r.isDefault);
  const unassigned = query.data?.unassignedProductCount ?? 0;

  const patch = async (r: TaxRate, body: { isDefault?: true; isActive?: boolean }, msg: string) => {
    try {
      await update.mutateAsync({ id: r.id, body: { version: r.version, ...body } });
      toast.success(msg);
    } catch (err) {
      toast.error(messageFor(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Thuế suất"
        description={
          query.data ? (
            <>
              {active.length} mức đang dùng
              {def ? ` · mặc định cho sản phẩm mới: ${def.misaName}` : ''}
              {unassigned > 0 ? (
                <>
                  {' · '}
                  <Link href="/catalog/products?taxRate=none" className="text-primary underline">
                    {unassigned} sản phẩm chưa gán
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            'Đang tải…'
          )
        }
        breadcrumb={[{ label: 'Sản phẩm', href: '/catalog/products' }, { label: 'Thuế suất' }]}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/catalog/products?taxRate=none">Gán cho sản phẩm</Link>
            </Button>
            {canManage ? (
              <Button size="sm" onClick={() => setDialog({ open: true })} shortcut="N">
                <Plus aria-hidden /> Thêm thuế suất
              </Button>
            ) : null}
          </>
        }
      />

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <FilterChip active={!showInactive} onClick={() => setShowInactive(false)}>
            Đang dùng
          </FilterChip>
          <FilterChip active={showInactive} onClick={() => setShowInactive(true)}>
            Tất cả
          </FilterChip>
        </div>
        <QueryState
          query={query}
          skeleton={<ListSkeleton rows={5} columns={8} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              title="Chưa có thuế suất nào"
              description="Thêm mức thuế suất để gán cho sản phẩm."
              action={
                canManage ? (
                  <Button onClick={() => setDialog({ open: true })}>
                    <Plus aria-hidden />
                    Thêm thuế suất
                  </Button>
                ) : undefined
              }
            />
          }
        >
          {() => (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="px-2.5 text-xs">Tên</TableHead>
                    <TableHead className="w-24 px-2.5 text-xs">Mã</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Thuế suất</TableHead>
                    <TableHead className="w-24 px-2.5 text-xs">Gửi MISA</TableHead>
                    <TableHead className="w-48 px-2.5 text-xs">Hiệu lực</TableHead>
                    <TableHead className="w-24 px-2.5 text-right text-xs">Sản phẩm</TableHead>
                    <TableHead className="w-28 px-2.5 text-xs">Trạng thái</TableHead>
                    <TableHead className="w-20 px-2.5 text-xs">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const period = periodLabel(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="px-2.5 py-1.5">
                          <span className="font-semibold">{r.name}</span>
                          {r.isDefault ? (
                            <StatusBadge tone="brand" className="ml-2">
                              Mặc định
                            </StatusBadge>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {r.kind === 'TAXABLE' ? `${r.ratePercent}%` : '—'}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 font-mono text-xs">
                          {r.misaName}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {period ? (
                            <StatusBadge tone="warn">{period}</StatusBadge>
                          ) : (
                            <span className="text-muted-foreground">Không thời hạn</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5 text-right">
                          {r.productCount > 0 ? (
                            <Link
                              href={`/catalog/products?taxRate=${r.id}`}
                              className="text-primary underline"
                            >
                              {r.productCount}
                            </Link>
                          ) : (
                            0
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {r.isActive ? (
                            <StatusBadge tone="ok">Đang dùng</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Ngừng dùng</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1.5">
                          {canManage ? (
                            <RowActions
                              onEdit={() => setDialog({ open: true, rate: r })}
                              items={[
                                {
                                  label: 'Xem sản phẩm đang dùng',
                                  href: `/catalog/products?taxRate=${r.id}`,
                                },
                                {
                                  label: 'Đặt làm mặc định',
                                  onSelect: () =>
                                    void patch(
                                      r,
                                      { isDefault: true },
                                      `Đã đặt ${r.misaName} làm mặc định`,
                                    ),
                                  disabledReason: r.isDefault
                                    ? 'Đang là mức mặc định'
                                    : !r.isActive
                                      ? 'Mức đã ngừng dùng'
                                      : undefined,
                                },
                                r.isActive
                                  ? {
                                      label: 'Ngừng dùng',
                                      danger: true,
                                      onSelect: () =>
                                        void patch(
                                          r,
                                          { isActive: false },
                                          `Đã ngừng dùng ${r.name}`,
                                        ),
                                      disabledReason: r.isDefault
                                        ? 'Đặt mức khác làm mặc định trước'
                                        : undefined,
                                    }
                                  : {
                                      label: 'Dùng lại',
                                      onSelect: () =>
                                        void patch(r, { isActive: true }, `Đã dùng lại ${r.name}`),
                                    },
                              ]}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Thuế suất đặt ở cấp sản phẩm, mọi biến thể dùng chung. Mức đã có sản phẩm hoặc đơn hàng
          dùng thì không xóa, chỉ ngừng dùng.
        </div>
      </div>

      {dialog.open ? (
        <TaxRateDialog
          key={dialog.rate?.id ?? 'new'}
          rate={dialog.rate}
          rates={all}
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        />
      ) : null}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-sm',
        active
          ? 'border-primary bg-secondary font-semibold text-primary'
          : 'border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  );
}
