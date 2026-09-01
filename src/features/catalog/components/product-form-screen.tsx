'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { DetailSkeleton, EmptyState, QueryState } from '@/components/data/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { type ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import {
  useAddBarcode,
  useBrands,
  useCategories,
  useCreateProduct,
  useCreateSku,
  useProduct,
  useUoms,
  useUpdateProduct,
  useUpdateSku,
  type ProductDetail,
} from '../api/use-products';
import { EMPTY_SKU_ROW, productFormSchema, type ProductFormValues } from '../schema';
import { ProductGallery, SkuImageCell } from './product-images';

/**
 * C-02 Tạo / sửa sản phẩm — full page theo design/Products/ProductForm@2x.png.
 * Điểm LỆCH so với artboard (API chưa cho phép — ghi ở thẻ PENDING_API):
 * - Ma trận thuộc tính sinh biến thể (Màu × Ngòi): chưa có API thuộc tính → bảng SKU
 *   nhập tay, nút "Thêm biến thể"; tên dòng mới mặc định = tên sản phẩm (sửa được).
 * - Giá niêm yết theo biến thể: giá nằm ở bảng giá (PriceList), không phải trên SKU.
 * - Mô tả ngắn / NCC chính / Ngưỡng đặt lại: Product chưa có trường tương ứng.
 * - Nhóm thuế: hiện "Chưa cấu hình" đúng design (P3-01 chưa chốt cách tính thuế).
 * Giữ đúng design: banner lỗi 422 trên đầu "N trường chưa hợp lệ — chưa lưu", lỗi map
 * vào đúng dòng, dữ liệu đã nhập giữ nguyên; xóa dòng chỉ với biến thể CHƯA lưu, biến
 * thể đã có chỉ "Ngừng bán"; Ctrl+S lưu, Esc hủy.
 *
 * Lưu KHÔNG atomic (API tách product / từng SKU): tạo cha xong mà một dòng SKU lỗi thì
 * cha + các dòng trước đã vào DB — form nhớ lại (created ref), sửa dòng lỗi bấm Lưu
 * tiếp sẽ chỉ gửi phần còn thiếu, không tạo trùng.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  { title: 'Ma trận thuộc tính sinh biến thể', need: 'chưa có API thuộc tính sản phẩm' },
  { title: 'Giá niêm yết theo biến thể', need: 'giá thuộc bảng giá — màn Bảng giá quản lý' },
  { title: 'Mô tả ngắn, NCC chính, ngưỡng đặt lại', need: 'Product chưa có trường tương ứng' },
];

const TRACKING_OPTIONS = [
  { value: 'NONE', label: 'Không theo dõi' },
  { value: 'LOT', label: 'Theo lô + hạn dùng (FEFO)' },
  { value: 'SERIAL', label: 'Theo serial' },
] as const;

interface RowError {
  index: number;
  message: string;
}

/** Ghi chú design: focus nhảy tới ô sai đầu tiên — tìm theo name của RHF, không phá id của Form kit. */
function focusSkuCode(index: number) {
  document.querySelector<HTMLInputElement>(`input[name="skus.${index}.code"]`)?.focus();
}

function initialValues(p?: ProductDetail): ProductFormValues {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    categoryId: p?.categoryId ?? '',
    brandId: p?.brandId ?? '',
    trackingMode: p?.trackingMode ?? 'NONE',
    shelfLifeDays: p?.shelfLifeDays == null ? '' : String(p.shelfLifeDays),
    baseUom: p?.skus[0]?.baseUom.code ?? 'PCS',
    skus: p
      ? p.skus.map((s) => ({
          skuId: s.id,
          code: s.code,
          name: s.name,
          barcode: '',
          isActive: s.isActive,
          existingBarcode: s.barcodes[0]?.code ?? '',
        }))
      : [{ ...EMPTY_SKU_ROW }],
  };
}

export function ProductFormScreen({ productId }: { productId?: string }) {
  const editing = productId !== undefined && productId !== '';
  const query = useProduct(productId ?? '');
  if (!editing) return <ProductFormBody />;
  return (
    <QueryState query={query} skeleton={<DetailSkeleton fields={8} />}>
      {(p) =>
        p ? (
          <ProductFormBody product={p} />
        ) : (
          <EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã bị xóa." />
        )
      }
    </QueryState>
  );
}

function ProductFormBody({ product }: { product?: ProductDetail }) {
  const editing = product !== undefined;
  const router = useRouter();
  const canEditImages = useAbility().can('update', 'Product');
  const categories = useCategories();
  const brands = useBrands();
  const uoms = useUoms();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(product?.id ?? '');
  const createSku = useCreateSku();
  const updateSku = useUpdateSku();
  const addBarcode = useAddBarcode();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues(product),
  });
  const rows = useFieldArray({ control: form.control, name: 'skus' });
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [saving, setSaving] = useState(false);
  /** Tạo cha xong mà dòng SKU lỗi → nhớ để lần Lưu sau không tạo trùng (lưu không atomic). */
  const created = useRef<{ productId: string; doneRows: Set<number> } | null>(null);

  const trackingMode = form.watch('trackingMode');

  const onSubmit = form.handleSubmit(async (v) => {
    setSaving(true);
    setRowErrors([]);
    const errors: RowError[] = [];
    try {
      // 1. Sản phẩm cha
      let pid = editing ? product.id : created.current?.productId;
      const headerBody = {
        name: v.name,
        ...(v.categoryId ? { categoryId: v.categoryId } : {}),
        ...(v.brandId ? { brandId: v.brandId } : {}),
        trackingMode: v.trackingMode,
        ...(v.shelfLifeDays ? { shelfLifeDays: Number.parseInt(v.shelfLifeDays, 10) } : {}),
      };
      if (!pid) {
        try {
          const p = await createProduct.mutateAsync({ code: v.code, ...headerBody });
          pid = p.id;
          created.current = { productId: p.id, doneRows: new Set() };
        } catch (err) {
          applyServerErrors(form, err as ApiError, {
            knownFields: ['code', 'name', 'categoryId', 'brandId', 'trackingMode'],
          });
          return;
        }
      } else if (editing) {
        try {
          await updateProduct.mutateAsync(headerBody);
        } catch (err) {
          applyServerErrors(form, err as ApiError, {
            knownFields: ['name', 'categoryId', 'brandId', 'trackingMode'],
          });
          return;
        }
      }

      // 2. Từng dòng biến thể — lỗi dòng nào ghi dòng đó, các dòng khác vẫn lưu
      for (let i = 0; i < v.skus.length; i += 1) {
        const row = v.skus[i]!;
        try {
          if (!row.skuId && !created.current?.doneRows.has(i)) {
            await createSku.mutateAsync({
              productId: pid,
              body: {
                code: row.code,
                name: row.name,
                baseUom: v.baseUom,
                ...(row.barcode ? { barcodes: [{ code: row.barcode }] } : {}),
              },
            });
            created.current?.doneRows.add(i);
          } else if (row.skuId) {
            const dirty = form.formState.dirtyFields.skus?.[i];
            if (dirty?.name || dirty?.isActive) {
              await updateSku.mutateAsync({
                skuId: row.skuId,
                body: { name: row.name, isActive: row.isActive },
              });
            }
            if (row.barcode && !row.existingBarcode) {
              await addBarcode.mutateAsync({ skuId: row.skuId, code: row.barcode });
            }
          }
        } catch (err) {
          const msg = messageFor(err);
          errors.push({ index: i, message: msg });
          form.setError(`skus.${i}.code`, { message: msg });
        }
      }

      if (errors.length > 0) {
        setRowErrors(errors);
        focusSkuCode(errors[0]!.index);
        return;
      }
      toast.success(editing ? 'Đã lưu thay đổi' : 'Đã lưu sản phẩm', {
        description: `${v.code} · ${v.skus.length} biến thể`,
      });
      router.push('/catalog/products');
    } finally {
      setSaving(false);
    }
  });

  // Ctrl+S lưu (design) — qua ref để listener gắn một lần
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

  const saveLabel = editing ? 'Lưu thay đổi' : 'Lưu sản phẩm';
  const newRowCount = form.getValues('skus').filter((r) => !r.skuId).length;

  return (
    <Form {...form}>
      <form id="product-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <PageHeader
          title={editing ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}
          description={
            editing
              ? `Sản phẩm cha ${product.code} · ${product.skus.length} biến thể`
              : 'Sản phẩm cha + các biến thể / SKU — lưu xong bổ sung quy đổi ĐVT ở màn chi tiết'
          }
          breadcrumb={[
            { label: 'Sản phẩm', href: '/catalog/products' },
            { label: 'Danh sách', href: '/catalog/products' },
            { label: editing ? 'Sửa' : 'Tạo sản phẩm' },
          ]}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/catalog/products">Hủy bỏ</Link>
              </Button>
              <Can I={editing ? 'update' : 'create'} a="Product">
                <Button size="sm" type="submit" form="product-form" disabled={saving}>
                  {saving ? 'Đang lưu…' : saveLabel}{' '}
                  <kbd className="rounded-sm border border-primary-foreground/50 px-1 font-mono text-xs">
                    Ctrl S
                  </kbd>
                </Button>
              </Can>
            </>
          }
        />

        {rowErrors.length > 0 ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-destructive">
              {rowErrors.length} dòng chưa hợp lệ — chưa lưu hết.
            </span>{' '}
            Dữ liệu bạn nhập vẫn được giữ nguyên; phần hợp lệ đã lưu.{' '}
            {rowErrors.map((e) => (
              <button
                key={e.index}
                type="button"
                className="mr-2 text-destructive underline"
                onClick={() => focusSkuCode(e.index)}
              >
                Dòng {e.index + 1}: {e.message}
              </button>
            ))}
          </div>
        ) : null}

        <section className="rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">Thông tin chung</header>
          <div className="grid gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel>Tên sản phẩm *</FormLabel>
                  <FormControl>
                    <Input autoFocus={!editing} placeholder="Bút bi Thiên Long TL-08" {...field} />
                  </FormControl>
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
                      <SelectTrigger>
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
                      <SelectTrigger>
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
              name="baseUom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ĐVT cơ bản *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ĐVT" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(uoms.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.code}>
                          {u.code} — {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editing ? (
                    <p className="text-xs text-muted-foreground">
                      ĐVT lưu kho không đổi sau khi tạo
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trackingMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theo dõi lô / HSD</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRACKING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {trackingMode === 'LOT' ? (
              <FormField
                control={form.control}
                name="shelfLifeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn dùng (ngày)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="1080"
                        className="text-right tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã cha *</FormLabel>
                  <FormControl>
                    <Input placeholder="TL08" className="font-mono" disabled={editing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Nhóm thuế</FormLabel>
              <Input value="Chưa cấu hình" disabled />
            </FormItem>
          </div>
        </section>

        {editing ? (
          <ProductGallery productId={product.id} images={product.images} canEdit={canEditImages} />
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Ảnh sản phẩm và ảnh từng biến thể thêm được sau khi lưu (ảnh lưu trên S3).
          </p>
        )}

        <section className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">
              Biến thể / SKU{' '}
              <span className="font-normal text-muted-foreground">
                · {rows.fields.length} dòng{newRowCount > 0 ? ` · ${newRowCount} mới` : ''}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => rows.append({ ...EMPTY_SKU_ROW, name: form.getValues('name') })}
            >
              <Plus aria-hidden />
              Thêm biến thể
            </Button>
          </header>
          <div className="flex flex-col divide-y">
            {rows.fields.map((f, i) => (
              <SkuRow
                key={f.id}
                form={form}
                index={i}
                editing={editing}
                canEditImages={canEditImages}
                skuImage={
                  product?.skus.find((s) => s.id === form.getValues(`skus.${i}.skuId`))?.images[0]
                }
                onRemove={
                  // Design: chỉ xóa dòng CHƯA lưu; biến thể đã có chỉ "Ngừng bán"
                  !form.getValues(`skus.${i}.skuId`) && rows.fields.length > 1
                    ? () => rows.remove(i)
                    : undefined
                }
              />
            ))}
          </div>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Biến thể chưa có barcode bổ sung được sau. Mã SKU đã dùng không đổi được sau khi có
            chứng từ; biến thể đã lưu không xóa — chỉ Ngừng bán.
          </p>
          {form.formState.errors.skus?.root?.message || form.formState.errors.skus?.message ? (
            <p className="border-t px-3 py-2 text-sm text-destructive">
              {form.formState.errors.skus.root?.message ?? form.formState.errors.skus.message}
            </p>
          ) : null}
        </section>

        <section className="rounded-md border bg-card">
          <header className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
            <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Bổ sung khi API sẵn sàng
          </header>
          <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
            {PENDING_API.map((m) => (
              <li key={m.title}>
                <span className="font-medium">{m.title}</span>{' '}
                <span className="text-xs text-muted-foreground">— {m.need}</span>
              </li>
            ))}
          </ul>
        </section>
      </form>
    </Form>
  );
}

/** Một dòng biến thể: ảnh (SKU đã lưu) · mã (khóa khi đã lưu) · tên · barcode lẻ · trạng thái (khi sửa). */
function SkuRow({
  form,
  index,
  editing,
  canEditImages,
  skuImage,
  onRemove,
}: {
  form: UseFormReturn<ProductFormValues>;
  index: number;
  editing: boolean;
  canEditImages: boolean;
  skuImage?: ProductDetail['skus'][number]['images'][number];
  onRemove?: () => void;
}) {
  const skuId = form.getValues(`skus.${index}.skuId`);
  const existingBarcode = form.getValues(`skus.${index}.existingBarcode`);
  const saved = skuId !== '';

  return (
    <div className="grid items-start gap-2 px-3 py-2 sm:grid-cols-[110px_150px_minmax(180px,1fr)_170px_150px_32px]">
      {saved ? (
        <SkuImageCell skuId={skuId} image={skuImage} canEdit={canEditImages} />
      ) : (
        <span
          className="pt-2 text-xs text-muted-foreground"
          title="Ảnh biến thể thêm được sau khi lưu"
        >
          —
        </span>
      )}
      <FormField
        control={form.control}
        name={`skus.${index}.code`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Mã SKU</FormLabel>
            <FormControl>
              <Input placeholder="TL08-BLUE-05" className="font-mono" disabled={saved} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`skus.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Tên biến thể</FormLabel>
            <FormControl>
              <Input placeholder="Bút bi Thiên Long TL-08 xanh 0.5" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {existingBarcode ? (
        <div
          className="pt-2 font-mono text-sm text-muted-foreground"
          title="Quản lý barcode đầy đủ ở màn chi tiết"
        >
          {existingBarcode}
        </div>
      ) : (
        <FormField
          control={form.control}
          name={`skus.${index}.barcode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Barcode lẻ</FormLabel>
              <FormControl>
                <Input
                  placeholder="quét hoặc nhập"
                  className="font-mono"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {editing && saved ? (
        <FormField
          control={form.control}
          name={`skus.${index}.isActive`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Trạng thái</FormLabel>
              <Select
                value={field.value ? 'active' : 'inactive'}
                onValueChange={(v) => field.onChange(v === 'active')}
              >
                <FormControl>
                  <SelectTrigger aria-label="Trạng thái">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Đang bán</SelectItem>
                  <SelectItem value="inactive">Ngừng bán</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      ) : (
        <div className="pt-2 text-sm text-muted-foreground">Đang bán</div>
      )}
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Xóa dòng"
          title="Xóa dòng (chỉ dòng chưa lưu)"
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
