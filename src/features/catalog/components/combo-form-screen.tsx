'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
  EntityPicker,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
} from '@/components/data/form';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { type ApiError } from '@/lib/api/errors';
import { formatMoney, formatQuantity } from '@/lib/format';
import { Can } from '@/lib/permission';
import {
  useComponentSkuSearch,
  useCreateCombo,
  useCombo,
  useUpdateCombo,
  type ComboDetail,
} from '../api/use-combos';
import { useBrands, useCategories } from '../api/use-products';
import {
  comboAvailableFromRows,
  comboFormSchema,
  comboPriceFromRows,
  EMPTY_COMBO_ROW,
  parseAliases,
  type ComboFormValues,
} from '../schema';

/**
 * Tạo / sửa combo — POST /combos, PATCH /combos/{id}.
 * - Một lần gọi lưu cả product + SKU + thành phần + giá bán (server atomic) — không có
 *   chuyện "cha đã lưu, dòng lỗi" như form sản phẩm.
 * - Mã bỏ trống → server sinh `CB-{seq}`; sửa thì mã cố định (SKU/bảng giá tựa vào).
 * - Định mức theo ĐVT cơ sở của SKU thành phần (không quy đổi). "Còn bán được" tính ngay
 *   từ khả dụng của thành phần đã chọn — cùng công thức với cột trên danh sách.
 * - PATCH bắt buộc `version` (optimistic locking) — 409 → banner + tải lại, không retry (luật 6).
 * - Giá combo không nhập tay (COMBO-1): server tính Σ(giá lẻ thành phần × định mức) − giảm giá,
 *   ghi bảng giá mặc định và đẩy lên Pancake đúng giá đó. Form chỉ nhập "Giảm giá"; giá xem
 *   trước tính được khi biết giá lẻ thành phần (combo đang sửa), combo mới thì tính khi lưu.
 * - "Miễn ship" = gợi ý cho sale khi lên đơn, sale vẫn quyết định phí ship cuối.
 */
function initialValues(c?: ComboDetail): ComboFormValues {
  return {
    code: c?.code ?? '',
    name: c?.name ?? '',
    categoryId: c?.categoryId ?? '',
    brandId: c?.brandId ?? '',
    description: c?.description ?? '',
    searchAliases: c?.searchAliases.join(', ') ?? '',
    discountAmount: c && c.discountAmount !== '0' ? c.discountAmount : '',
    freeShipping: c?.freeShipping ?? false,
    isActive: c?.isActive ?? true,
    components: c
      ? c.components.map((x) => ({
          skuId: x.skuId,
          skuCode: x.code,
          skuName: x.name,
          baseUomCode: x.baseUomCode,
          available: x.available,
          unitPrice: x.unitPrice ?? '',
          qty: x.qty,
        }))
      : [{ ...EMPTY_COMBO_ROW }],
  };
}

export function ComboFormScreen({ comboId }: { comboId?: string }) {
  const editing = comboId !== undefined && comboId !== '';
  const query = useCombo(comboId ?? '');
  if (!editing) return <ComboFormBody />;
  return (
    <QueryState query={query} skeleton={<DetailSkeleton fields={6} />}>
      {(c) =>
        c ? (
          <ComboFormBody combo={c} />
        ) : (
          <EmptyState title="Không tìm thấy combo" description="Combo có thể đã bị xóa." />
        )
      }
    </QueryState>
  );
}

function ComboFormBody({ combo }: { combo?: ComboDetail }) {
  const editing = combo !== undefined;
  const router = useRouter();
  const create = useCreateCombo();
  const update = useUpdateCombo(combo?.id ?? '');
  const categories = useCategories();
  const brands = useBrands();

  const form = useForm<ComboFormValues>({
    resolver: zodResolver(comboFormSchema),
    defaultValues: initialValues(combo),
  });
  const rows = useFieldArray({ control: form.control, name: 'components' });
  const components = useWatch({ control: form.control, name: 'components' });
  const available = comboAvailableFromRows(components ?? []);
  const discount = useWatch({ control: form.control, name: 'discountAmount' });
  const price = comboPriceFromRows(components ?? [], discount ?? '');
  const saving = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit(async (v) => {
    form.clearErrors('root.server');
    const components = v.components.map((r) => ({ skuId: r.skuId, qty: r.qty }));
    const common = {
      name: v.name,
      ...(v.categoryId ? { categoryId: v.categoryId } : {}),
      ...(v.brandId ? { brandId: v.brandId } : {}),
      ...(v.description ? { description: v.description } : {}),
      searchAliases: parseAliases(v.searchAliases),
      discountAmount: v.discountAmount || '0',
      freeShipping: v.freeShipping,
    };
    try {
      if (editing) {
        const r = await update.mutateAsync({
          version: combo.version,
          ...common,
          // Bỏ danh mục / thương hiệu = gửi null (undefined = giữ nguyên).
          categoryId: v.categoryId || null,
          brandId: v.brandId || null,
          isActive: v.isActive,
          components,
        });
        toast.success('Đã lưu thay đổi', { description: `Combo ${r.code} · ${r.name}` });
      } else {
        const r = await create.mutateAsync({
          ...(v.code ? { code: v.code } : {}),
          ...common,
          components,
        });
        toast.success('Đã lưu combo', { description: `${r.code} · ${r.name}` });
      }
      router.push('/catalog/combos');
    } catch (err) {
      applyServerErrors(form, err as ApiError, {
        knownFields: [
          'code',
          'name',
          'categoryId',
          'brandId',
          'discountAmount',
          'freeShipping',
          'searchAliases',
          'components',
        ],
      });
      const root = form.formState.errors.root?.server?.message;
      if (root) toast.error(root);
    }
  });

  // Ctrl+S lưu — qua ref để listener gắn một lần
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = () => void onSubmit();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const saveLabel = editing ? 'Lưu thay đổi' : 'Lưu combo';

  return (
    <Form {...form}>
      <form id="combo-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <PageHeader
          title={editing ? 'Sửa combo' : 'Tạo combo'}
          description={
            editing
              ? `${combo.code} · ${combo.components.length} thành phần · còn bán được ${formatQuantity(combo.available)}`
              : 'Chọn SKU thành phần và định mức cho MỘT combo — tồn và pick vẫn tính trên thành phần'
          }
          breadcrumb={[
            { label: 'Sản phẩm', href: '/catalog/products' },
            { label: 'Combo sản phẩm', href: '/catalog/combos' },
            { label: editing ? 'Sửa' : 'Tạo combo' },
          ]}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/catalog/combos">Hủy bỏ</Link>
              </Button>
              <Can I={editing ? 'update' : 'create'} a="Product">
                <Button size="sm" type="submit" form="combo-form" disabled={saving}>
                  {saving ? 'Đang lưu…' : saveLabel}{' '}
                  <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                    Ctrl S
                  </kbd>
                </Button>
              </Can>
            </>
          }
        />

        {form.formState.errors.root?.server ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-destructive">
              {form.formState.errors.root.server.message}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => window.location.reload()}
            >
              Tải lại dữ liệu
            </Button>
          </div>
        ) : null}

        <section className="rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">Thông tin combo</header>
          <div className="grid gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Tên combo *</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus={!editing}
                      placeholder="Combo 2 chai trừ sâu + 1 bình xịt"
                      {...field}
                    />
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
                  <FormLabel>Mã combo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={editing ? undefined : 'Bỏ trống để tự sinh CB-0001'}
                      disabled={editing}
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  {editing ? (
                    <FormDescription>
                      Mã dùng chung cho SKU và bảng giá — không đổi.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discountAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giảm giá</FormLabel>
                  <FormControl>
                    <MoneyInput
                      aria-label="Giảm giá"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormDescription>
                    {price
                      ? `Giá combo = ${formatMoney(price.componentsPrice)} − giảm = ${formatMoney(price.salePrice)}`
                      : 'Giá combo = tổng giá lẻ thành phần − giảm giá (tính khi lưu, đẩy lên Pancake giá này)'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(x) => field.onChange(x === 'none' ? '' : x)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Danh mục">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Không phân loại</SelectItem>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thương hiệu</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(x) => field.onChange(x === 'none' ? '' : x)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Thương hiệu">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Không thương hiệu</SelectItem>
                      {(brands.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
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
              name="searchAliases"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Tên gọi khác</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="combo trừ sâu, bộ 3 chai (phân tách bằng dấu phẩy)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-3">
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="freeShipping"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 pt-6">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-label="Miễn ship"
                    />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel>Miễn ship</FormLabel>
                    <FormDescription>Gợi ý miễn phí ship cho sale khi lên đơn.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {editing ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-2 pt-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        aria-label="Đang bán"
                      />
                    </FormControl>
                    <div className="space-y-0.5 leading-none">
                      <FormLabel>Đang bán</FormLabel>
                      <FormDescription>
                        Bỏ tick = ngừng bán, không chọn được khi lên đơn.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            ) : null}
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>
              Thành phần{' '}
              <span className="font-normal text-muted-foreground">· {rows.fields.length}</span>
            </span>
            <span className="flex items-center gap-3">
              <span
                className="text-xs font-normal text-muted-foreground"
                title="min(khả dụng ÷ định mức) trên các thành phần"
              >
                Còn bán được:{' '}
                <b className={available === '0' ? 'text-destructive' : 'text-foreground'}>
                  {available === null ? '—' : `${formatQuantity(available)} combo`}
                </b>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => rows.append({ ...EMPTY_COMBO_ROW })}
              >
                <Plus aria-hidden />
                Thêm thành phần
              </Button>
            </span>
          </header>
          <div className="hidden gap-2 px-3 pt-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[20px_minmax(220px,2fr)_120px_80px_120px_minmax(120px,1fr)_32px]">
            <span>#</span>
            <span>SKU thành phần</span>
            <span>Mã</span>
            <span>ĐVT</span>
            <span className="text-right">Định mức / combo</span>
            <span className="text-right">Khả dụng</span>
            <span />
          </div>
          <div className="flex flex-col divide-y">
            {rows.fields.map((f, i) => (
              <ComponentRow
                key={f.id}
                form={form}
                index={i}
                onRemove={rows.fields.length > 1 ? () => rows.remove(i) : undefined}
              />
            ))}
          </div>
          {form.formState.errors.components?.root?.message ||
          form.formState.errors.components?.message ? (
            <p className="border-t px-3 py-2 text-sm text-destructive">
              {form.formState.errors.components.root?.message ??
                form.formState.errors.components.message}
            </p>
          ) : null}
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Định mức theo ĐVT cơ sở của từng SKU · combo không lồng combo · tồn kho không nhập vào
            combo mà vào từng thành phần
          </p>
        </section>
      </form>
    </Form>
  );
}

function ComponentRow({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<ComboFormValues>;
  index: number;
  onRemove?: () => void;
}) {
  const row = useWatch({ control: form.control, name: `components.${index}` });
  return (
    <div className="grid items-start gap-2 px-3 py-2 sm:grid-cols-[20px_minmax(220px,2fr)_120px_80px_120px_minmax(120px,1fr)_32px]">
      <div className="pt-2 text-xs text-muted-foreground">{index + 1}</div>
      <FormField
        control={form.control}
        name={`components.${index}.skuId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">SKU thành phần</FormLabel>
            <FormControl>
              <EntityPicker
                value={field.value}
                onChange={(id, option) => {
                  field.onChange(id);
                  // Mã / tên / ĐVT / khả dụng đi kèm option — không gọi thêm API.
                  form.setValue(`components.${index}.skuCode`, option?.meta?.code ?? '');
                  form.setValue(
                    `components.${index}.skuName`,
                    option?.meta?.name ?? option?.label ?? '',
                  );
                  form.setValue(`components.${index}.baseUomCode`, option?.meta?.baseUomCode ?? '');
                  form.setValue(`components.${index}.available`, option?.meta?.available ?? '');
                  // /skus không trả giá — giá lẻ thành phần mới chỉ biết sau khi lưu.
                  form.setValue(`components.${index}.unitPrice`, '');
                }}
                useSearch={useComponentSkuSearch}
                selectedLabel={row?.skuName || undefined}
                placeholder="Tìm mã SKU, tên, barcode…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="pt-2 font-mono text-xs text-muted-foreground">{row?.skuCode || '—'}</div>
      <div className="pt-2 text-sm text-muted-foreground">{row?.baseUomCode || '—'}</div>
      <FormField
        control={form.control}
        name={`components.${index}.qty`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Định mức</FormLabel>
            <FormControl>
              <Input
                inputMode="decimal"
                aria-label="Định mức"
                className="text-right tabular-nums"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="pt-2 text-right text-sm tabular-nums text-muted-foreground">
        {row?.skuId ? (row.available === '' ? '—' : formatQuantity(row.available)) : null}
      </div>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Xóa dòng"
          title="Xóa dòng"
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
