'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
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
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { Can, useAbility } from '@/lib/permission';
import {
  useAddBarcode,
  useBrands,
  useSetConversion,
  useCategories,
  useCreateProduct,
  useCreateSku,
  useProduct,
  useUoms,
  useUpdateProduct,
  useUpdateSku,
  useUploadProductImage,
  useWarehouses,
  type ProductDetail,
} from '../api/use-products';
import {
  EMPTY_SKU_ROW,
  gramsToKg,
  kgToGrams,
  parseAliases,
  productFormSchema,
  type ProductFormValues,
} from '../schema';
import { ImageDropzone, ProductGallery } from './product-images';
import { UomManagerDialog } from './uom-manager-dialog';

/**
 * C-02 Tạo / sửa sản phẩm — full page theo design/Products/ProductForm@2x.png,
 * nối API product mới (prompt-product-api 2026-09-02):
 * - Mã sản phẩm KHÔNG bắt buộc — bỏ trống backend tự sinh `{categoryCode|SP}-{seq}`;
 *   sửa được cả khi edit (server trả 409 nếu sản phẩm đã có chứng từ).
 * - Tên gọi khác (searchAliases): một ô, phân tách phẩy — ô tìm sản phẩm ăn các tên này.
 * - PATCH product/SKU bắt buộc `version` (optimistic locking) — 409 khi người khác vừa
 *   sửa: banner root.server + nút tải lại, KHÔNG retry tự động (luật 6).
 * Điểm LỆCH còn lại so với artboard (ghi ở thẻ PENDING_API):
 * - Ma trận thuộc tính sinh biến thể (Màu × Ngòi): API /attributes đã có nhưng màn ma
 *   trận là task riêng → bảng SKU nhập tay, nút "Thêm biến thể".
 * - Giá niêm yết theo biến thể: giá nằm ở bảng giá (PriceList), không phải trên SKU.
 * - NCC chính / Ngưỡng đặt lại: Product chưa có trường tương ứng.
 * - Nhóm thuế: taxRateId đã lưu được theo SKU nhưng fin.TaxRate chưa có API danh mục
 *   (chờ chốt cách tính thuế với kế toán) → vẫn hiện "Chưa cấu hình".
 * Giữ đúng design: banner lỗi 422 trên đầu "N trường chưa hợp lệ — chưa lưu", lỗi map
 * vào đúng dòng, dữ liệu đã nhập giữ nguyên; xóa dòng chỉ với biến thể CHƯA lưu, biến
 * thể đã có chỉ "Ngừng bán"; Ctrl+S lưu, Esc hủy.
 *
 * Lưu KHÔNG atomic (API tách product / từng SKU): tạo cha xong mà một dòng SKU lỗi thì
 * cha + các dòng trước đã vào DB — form nhớ lại (created ref), sửa dòng lỗi bấm Lưu
 * tiếp sẽ chỉ gửi phần còn thiếu, không tạo trùng.
 */
const PENDING_API: Array<{ title: string; need: string }> = [
  {
    title: 'Ma trận thuộc tính sinh biến thể',
    need: 'API /attributes đã có — màn ma trận làm sau',
  },
  { title: 'Giá niêm yết theo biến thể', need: 'giá thuộc bảng giá — màn Bảng giá quản lý' },
  { title: 'Nhóm thuế theo SKU', need: 'chờ chốt cách tính thuế — chưa có danh mục thuế suất' },
];

interface RowError {
  index: number;
  message: string;
}

/**
 * Ghi chú design: focus nhảy tới ô sai đầu tiên — tìm theo name của RHF, không phá id của
 * Form kit. Ô mã SKU đang ẩn nên neo vào "Tên biến thể" (ô đầu tiên còn hiện của dòng).
 */
function focusSkuRow(index: number) {
  (
    document.querySelector<HTMLInputElement>(`input[name="skus.${index}.name"]`) ??
    document.querySelector<HTMLInputElement>(`input[name^="skus.${index}."]`)
  )?.focus();
}

function initialValues(p?: ProductDetail): ProductFormValues {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    categoryId: p?.categoryId ?? '',
    brandId: p?.brandId ?? '',
    trackingMode: p?.trackingMode ?? 'NONE',
    shelfLifeDays: p?.shelfLifeDays == null ? '' : String(p.shelfLifeDays),
    defaultWarehouseId: p?.defaultWarehouseId ?? '',
    description: p?.description ?? '',
    internalNote: p?.internalNote ?? '',
    searchAliases: (p?.searchAliases ?? []).join(', '),
    allowNegativeStock: p?.allowNegativeStock ?? false,
    // Sản phẩm mới mặc định là sản phẩm đơn; sửa thì theo cờ API. Dữ liệu cũ chưa có cờ:
    // nhiều SKU, hoặc một SKU mang tên khác tên sản phẩm (nhập như biến thể) → có biến thể.
    hasVariants: p
      ? (p.hasVariants ??
        (p.skus.length > 1 || (p.skus[0] !== undefined && p.skus[0].name !== p.name)))
      : false,
    baseUom: p?.skus[0]?.baseUom.code ?? 'PCS',
    skus: p
      ? p.skus.map((s) => ({
          skuId: s.id,
          code: s.code,
          name: s.name,
          barcode: '',
          isActive: s.isActive,
          existingBarcode: s.barcodes[0]?.code ?? '',
          purchasePrice: s.purchasePrice ?? '',
          salePrice: s.salePrice ?? '',
          weightG: s.weightKg ? kgToGrams(s.weightKg) : '',
          openingQty: '',
          // F3 — alt* để TRỐNG trên SKU đã lưu (khai = thêm quy đổi mới);
          // quy đổi sẵn có hiển thị dạng chip, xóa ở API riêng khi cần.
          altUom: '',
          altFactor: '',
          altBarcode: '',
          salesUom: s.salesUom?.code ?? '',
          existingConvUoms: s.uomConversions.map((c) => c.uom.code),
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
  // F1 — picker thụt cấp theo cây: sắp DFS từ parentId, con đứng ngay dưới cha.
  const categoryOptions = useMemo(() => {
    const list = categories.data ?? [];
    const byParent = new Map<string | null, typeof list>();
    for (const c of list) {
      const key = c.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), c]);
    }
    const out: Array<{ id: string; name: string; depth: number }> = [];
    const seen = new Set<string>();
    const walk = (parentId: string | null, depth: number) => {
      for (const c of byParent.get(parentId) ?? []) {
        if (seen.has(c.id)) continue; // dữ liệu dị dạng (vòng) — không lặp vô hạn
        seen.add(c.id);
        out.push({ id: c.id, name: c.name, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    // Node có cha bị ẩn/không tải được → vẫn hiện ở cuối, không biến mất.
    for (const c of list) if (!seen.has(c.id)) out.push({ id: c.id, name: c.name, depth: 0 });
    return out;
  }, [categories.data]);
  const brands = useBrands();
  const uoms = useUoms();
  const warehouses = useWarehouses();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(product?.id ?? '');
  const createSku = useCreateSku();
  const updateSku = useUpdateSku();
  const addBarcode = useAddBarcode();
  const setConversion = useSetConversion();
  const uploadImage = useUploadProductImage();

  /**
   * Upload zone ở form TẠO: sản phẩm chưa tồn tại nên ảnh xếp hàng chờ (preview bằng
   * object URL), lưu xong tự tải tuần tự lên S3 — ảnh đầu hàng thành ảnh chính.
   * Ảnh lỗi ở lại hàng chờ, form đứng lại trang để thử lưu tiếp (cùng cơ chế created ref).
   */
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; url: string }>>([]);
  const addPending = (files: File[]) =>
    setPendingImages((prev) => [
      ...prev,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  const removePending = (url: string) =>
    setPendingImages((prev) => {
      URL.revokeObjectURL(url);
      return prev.filter((p) => p.url !== url);
    });
  useEffect(
    () => () => {
      // Rời trang: nhả hết object URL còn trong hàng chờ
      setPendingImages((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.url);
        return prev;
      });
    },
    [],
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues(product),
  });
  const rows = useFieldArray({ control: form.control, name: 'skus' });
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [saving, setSaving] = useState(false);
  const [uomManagerOpen, setUomManagerOpen] = useState(false);
  /** Tạo cha xong mà dòng SKU lỗi → nhớ để lần Lưu sau không tạo trùng (lưu không atomic). */
  const created = useRef<{ productId: string; code: string; doneRows: Set<number> } | null>(null);

  const trackingMode = form.watch('trackingMode');
  const hasVariants = form.watch('hasVariants');
  /** Sản phẩm đã có nhiều SKU lưu rồi thì không gộp về đơn được (SKU đã lưu không xóa). */
  const variantsLocked = editing && product.skus.length > 1;
  const toggleVariants = (on: boolean) => {
    form.setValue('hasVariants', on, { shouldDirty: true });
    if (!on && rows.fields.length > 1) {
      // Về sản phẩm đơn: giữ đúng một dòng (dòng đầu — dòng đã lưu nếu có).
      const first = form.getValues('skus')[0]!;
      rows.replace([first]);
    }
  };

  const onSubmit = form.handleSubmit(async (v) => {
    setSaving(true);
    setRowErrors([]);
    form.clearErrors('root.server');
    const errors: RowError[] = [];
    // Mã hiển thị trong toast — code bỏ trống thì backend tự sinh, lấy từ response.
    let savedCode = v.code || product?.code || created.current?.code || '';
    try {
      // 1. Sản phẩm cha
      let pid = editing ? product.id : created.current?.productId;
      const headerBody = {
        name: v.name,
        ...(v.categoryId ? { categoryId: v.categoryId } : {}),
        ...(v.brandId ? { brandId: v.brandId } : {}),
        trackingMode: v.trackingMode,
        ...(v.shelfLifeDays ? { shelfLifeDays: Number.parseInt(v.shelfLifeDays, 10) } : {}),
        ...(v.defaultWarehouseId ? { defaultWarehouseId: v.defaultWarehouseId } : {}),
        ...(v.description ? { description: v.description } : {}),
        ...(v.internalNote ? { internalNote: v.internalNote } : {}),
        searchAliases: parseAliases(v.searchAliases),
        allowNegativeStock: v.allowNegativeStock,
      };
      if (!pid) {
        try {
          const p = await createProduct.mutateAsync({
            ...(v.code ? { code: v.code } : {}),
            ...headerBody,
          });
          pid = p.id;
          savedCode = p.code;
          created.current = { productId: p.id, code: p.code, doneRows: new Set() };
        } catch (err) {
          applyServerErrors(form, err as ApiError, {
            knownFields: ['code', 'name', 'categoryId', 'brandId', 'trackingMode', 'searchAliases'],
          });
          return;
        }
      } else if (editing) {
        try {
          // Optimistic locking: version từ ProductDetailDto — lệch (người khác vừa sửa) → 409.
          await updateProduct.mutateAsync({
            version: product.version,
            ...headerBody,
            // code chỉ gửi khi người dùng thật sự đổi — server chặn 409 nếu đã có chứng từ.
            ...(form.formState.dirtyFields.code && v.code ? { code: v.code } : {}),
          });
        } catch (err) {
          applyServerErrors(form, err as ApiError, {
            knownFields: ['code', 'name', 'categoryId', 'brandId', 'trackingMode', 'searchAliases'],
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
                // Sản phẩm đơn: KHÔNG gửi code/name — API thừa kế mã + tên sản phẩm.
                // Có biến thể: ô mã đang ẩn → `{mã sản phẩm}-{stt}`, tên nhập tay từng dòng.
                ...(v.hasVariants
                  ? { code: row.code || `${savedCode}-${i + 1}`, name: row.name }
                  : {}),
                baseUom: v.baseUom,
                // F3 — ĐVT phụ khai trên dòng: conversion + barcode theo ĐVT + ĐVT bán
                ...(row.altUom && row.altFactor
                  ? { conversions: [{ uom: row.altUom, factor: row.altFactor }] }
                  : {}),
                ...(row.salesUom ? { salesUom: row.salesUom } : {}),
                ...(row.barcode || (row.altBarcode && row.altUom)
                  ? {
                      barcodes: [
                        ...(row.barcode ? [{ code: row.barcode }] : []),
                        ...(row.altBarcode && row.altUom
                          ? [{ code: row.altBarcode, uom: row.altUom }]
                          : []),
                      ],
                    }
                  : {}),
                ...(row.purchasePrice ? { purchasePrice: row.purchasePrice } : {}),
                ...(row.salePrice ? { salePrice: row.salePrice } : {}),
                ...(row.weightG ? { weightKg: gramsToKg(row.weightG) } : {}),
                ...(row.openingQty ? { openingQty: row.openingQty } : {}),
              },
            });
            created.current?.doneRows.add(i);
          } else if (row.skuId) {
            const dirty = form.formState.dirtyFields.skus?.[i];
            const patch = {
              ...(dirty?.name && v.hasVariants ? { name: row.name } : {}),
              ...(dirty?.isActive ? { isActive: row.isActive } : {}),
              ...(dirty?.purchasePrice && row.purchasePrice
                ? { purchasePrice: row.purchasePrice }
                : {}),
              ...(dirty?.salePrice && row.salePrice ? { salePrice: row.salePrice } : {}),
              ...(dirty?.weightG && row.weightG ? { weightKg: gramsToKg(row.weightG) } : {}),
              // F3 — đổi ĐVT bán ('' = quay về ĐVT cơ sở → gửi null)
              ...(dirty?.salesUom ? { salesUom: row.salesUom || null } : {}),
            };
            if (Object.keys(patch).length > 0) {
              // version của từng SKU lấy từ ProductDetailDto — PATCH bắt buộc (optimistic locking).
              const skuVersion = product?.skus.find((s) => s.id === row.skuId)?.version ?? 0;
              await updateSku.mutateAsync({
                skuId: row.skuId,
                body: { version: skuVersion, ...patch },
              });
            }
            // F3 — quy đổi mới khai trên SKU đã lưu: POST conversion TRƯỚC barcode
            // (trg_barcode_uom_valid đòi conversion có trước).
            if (row.altUom && row.altFactor) {
              await setConversion.mutateAsync({
                skuId: row.skuId,
                uom: row.altUom,
                factor: row.altFactor,
              });
            }
            if (row.barcode && !row.existingBarcode) {
              await addBarcode.mutateAsync({ skuId: row.skuId, code: row.barcode });
            }
            if (row.altBarcode && row.altUom) {
              await addBarcode.mutateAsync({
                skuId: row.skuId,
                code: row.altBarcode,
                uom: row.altUom,
              });
            }
          }
        } catch (err) {
          const msg = messageFor(err);
          errors.push({ index: i, message: msg });
          // Ô mã SKU ẩn → lỗi dòng gắn vào "Tên biến thể" (có biến thể) hoặc "Giá nhập"
          // (sản phẩm đơn — ô tên cũng ẩn) để FormMessage hiện đúng dòng.
          form.setError(v.hasVariants ? `skus.${i}.name` : `skus.${i}.purchasePrice`, {
            message: msg,
          });
        }
      }

      if (errors.length > 0) {
        setRowErrors(errors);
        focusSkuRow(errors[0]!.index);
        return;
      }

      // 3. Ảnh xếp hàng từ upload zone (form tạo) — tải tuần tự để ảnh đầu thành ảnh chính
      if (pendingImages.length > 0) {
        const failed: Array<{ file: File; url: string }> = [];
        for (const item of pendingImages) {
          try {
            await uploadImage.mutateAsync({ productId: pid, file: item.file });
            URL.revokeObjectURL(item.url);
          } catch (err) {
            toast.error(`Ảnh ${item.file.name}: ${messageFor(err)}`);
            failed.push(item);
          }
        }
        setPendingImages(failed);
        if (failed.length > 0) {
          toast.error(
            `${failed.length} ảnh chưa tải được — sản phẩm ĐÃ lưu, bấm Lưu để thử lại ảnh.`,
          );
          return;
        }
      }

      toast.success(editing ? 'Đã lưu thay đổi' : 'Đã lưu sản phẩm', {
        description: `${savedCode} · ${v.hasVariants ? `${v.skus.length} biến thể` : 'sản phẩm đơn'}`,
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
                onClick={() => focusSkuRow(e.index)}
              >
                Dòng {e.index + 1}: {e.message}
              </button>
            ))}
          </div>
        ) : null}

        {form.formState.errors.root?.server ? (
          /* Lỗi không gắn được vào field — nổi bật nhất là 409 optimistic locking:
             người khác vừa sửa, phải tải lại rồi nhập lại, không retry tự động (luật 6). */
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

        {/* Nhóm 1: nhận diện sản phẩm — tên, mã, phân loại, các tên gọi phục vụ tìm kiếm. */}
        <section className="rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">Thông tin chung</header>
          <div className="grid gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
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
              name="hasVariants"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 pt-6 lg:col-span-2">
                  <div className="space-y-0.5 leading-none">
                    <FormControl className="mr-2 items-center space-x-2">
                      <Checkbox
                        checked={field.value}
                        disabled={variantsLocked}
                        onCheckedChange={(v) => toggleVariants(v === true)}
                      />
                    </FormControl>
                    <FormLabel>Sản phẩm có nhiều biến thể (màu, size, quy cách…)</FormLabel>
                    <FormDescription>
                      {variantsLocked
                        ? 'Đã có nhiều SKU — không gộp về sản phẩm đơn được'
                        : 'Bỏ chọn = sản phẩm đơn: một SKU mang đúng mã và tên sản phẩm'}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {/* <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={editing ? 'TL08' : 'Để trống — tự sinh theo danh mục'}
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {editing
                      ? 'Đổi mã chỉ được khi chưa phát sinh chứng từ'
                      : 'Bỏ trống hệ thống tự sinh, ví dụ BVTV-0012'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
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
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {' '.repeat(c.depth * 3)}
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
              name="searchAliases"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-3">
                  <FormLabel>Tên gọi khác</FormLabel>
                  <FormControl>
                    <Input placeholder="thuốc bật chồi, thuốc trĩ, cheshaland" {...field} />
                  </FormControl>
                  <FormDescription>
                    Tên dân dã / viết tắt, phân tách bằng dấu phẩy — ô tìm sản phẩm ăn cả các tên
                    này
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-2">
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ngòi bi, mực dầu, viết êm…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNote"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-2">
                  <FormLabel>Ghi chú nội bộ</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Chỉ nội bộ thấy — không đưa ra kênh bán" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Nhóm 2: quy tắc kho vận — ĐVT, theo dõi lô, kho mặc định, thuế, tồn âm. */}
        <section className="rounded-md border bg-card">
          <header className="border-b px-3 py-2 text-sm font-semibold">
            Kho vận &amp; theo dõi
          </header>
          <div className="grid gap-x-4 gap-y-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
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
            {/* <FormField
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
                  {editing ? (
                    <p className="text-xs text-muted-foreground">
                      Đổi bị chặn khi SKU đã có phát sinh kho
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            /> */}
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
              name="defaultWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kho mặc định</FormLabel>
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
                      <SelectItem value="none">Chưa chọn</SelectItem>
                      {(warehouses.data ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Tồn đầu kỳ của biến thể mới ghi vào kho này</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* <FormItem>
              <FormLabel>Nhóm thuế</FormLabel>
              <Input value="Chưa cấu hình" disabled />
              <FormDescription>Chờ chốt cách tính thuế với kế toán</FormDescription>
            </FormItem> */}
            <FormField
              control={form.control}
              name="allowNegativeStock"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 pt-6 sm:col-span-2">
                  <div className="space-y-0.5 leading-none">
                    <FormControl className="mr-2 items-center space-x-2">
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>Cho phép bán tồn kho âm</FormLabel>
                    {/* <FormDescription>
                      Mới là cờ dữ liệu — chưa áp vào giữ hàng khi chốt đơn
                    </FormDescription> */}
                  </div>
                </FormItem>
              )}
            />
          </div>
        </section>

        {editing ? (
          <ProductGallery productId={product.id} images={product.images} canEdit={canEditImages} />
        ) : (
          <section className="rounded-md border bg-card">
            <header className="border-b px-3 py-2 text-sm font-semibold">
              Ảnh sản phẩm{' '}
              <span className="font-normal text-muted-foreground">
                · {pendingImages.length > 0 ? `${pendingImages.length} ảnh chờ` : 'tải lên khi lưu'}
              </span>
            </header>
            <div className="flex flex-col gap-3 px-3 py-3">
              <ImageDropzone onFiles={addPending} disabled={saving} />
              {pendingImages.length > 0 ? (
                <ul className="flex flex-wrap gap-3">
                  {pendingImages.map((p, i) => (
                    <li key={p.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview object URL cục bộ */}
                      <img
                        src={p.url}
                        alt={p.file.name}
                        className={cn(
                          'h-24 w-24 rounded-md border object-cover',
                          i === 0 && 'ring-2 ring-primary',
                        )}
                      />
                      {i === 0 ? (
                        <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          Ảnh chính
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute bottom-1 right-1 h-6 w-6 hover:text-destructive"
                        aria-label={`Bỏ ảnh khỏi hàng chờ: ${p.file.name}`}
                        title="Bỏ khỏi hàng chờ"
                        onClick={() => removePending(p.url)}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Ảnh nằm trong hàng chờ, bấm Lưu sản phẩm sẽ tải lên S3 — ảnh đầu tiên thành ảnh
                chính. Ảnh từng biến thể thêm ở màn sửa sau khi lưu.
              </p>
            </div>
          </section>
        )}

        <section className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">
              {hasVariants ? (
                <>
                  Biến thể / SKU{' '}
                  <span className="font-normal text-muted-foreground">
                    · {rows.fields.length} dòng{newRowCount > 0 ? ` · ${newRowCount} mới` : ''}
                  </span>
                </>
              ) : (
                <>
                  Giá & tồn kho{' '}
                  <span className="font-normal text-muted-foreground">
                    · sản phẩm đơn, một SKU trùng mã sản phẩm
                  </span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUomManagerOpen(true)}
              >
                Quản lý ĐVT
              </Button>
              {hasVariants ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => rows.append({ ...EMPTY_SKU_ROW, name: form.getValues('name') })}
                >
                  <Plus aria-hidden />
                  Thêm biến thể
                </Button>
              ) : null}
            </span>
          </header>
          <div className="flex flex-col divide-y">
            {rows.fields.map((f, i) => (
              <SkuRow
                key={f.id}
                form={form}
                index={i}
                editing={editing}
                simple={!hasVariants}
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
            {hasVariants
              ? 'Biến thể chưa có barcode bổ sung được sau. Mã SKU đã dùng không đổi được sau khi có chứng từ; biến thể đã lưu không xóa — chỉ Ngừng bán.'
              : 'Mã SKU = mã sản phẩm, barcode QR nội bộ tự sinh. Sau này cần thêm quy cách thì bật "có nhiều biến thể" và thêm dòng.'}
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
      {uomManagerOpen ? (
        <UomManagerDialog
          open={uomManagerOpen}
          onOpenChange={setUomManagerOpen}
          canEdit={canEditImages}
        />
      ) : null}
    </Form>
  );
}

/**
 * Một dòng biến thể: trạng thái (khi sửa) · tên · giá nhập · giá bán · tồn đầu kỳ (dòng mới).
 * Các ô ảnh / mã SKU / barcode / trọng lượng / đa ĐVT đang tạm ẩn (JSX giữ dạng comment
 * để bật lại) — bật lại thì nhớ đưa lại các prop `uoms`, `skuImage`, `canEditImages`.
 */
function SkuRow({
  form,
  index,
  editing,
  simple,
  onRemove,
}: {
  form: UseFormReturn<ProductFormValues>;
  index: number;
  editing: boolean;
  /** Sản phẩm đơn: ẩn ô tên (server lấy tên sản phẩm), không có nút xóa dòng. */
  simple: boolean;
  onRemove?: () => void;
}) {
  const skuId = form.getValues(`skus.${index}.skuId`);
  const saved = skuId !== '';

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="grid items-start gap-2 sm:grid-cols-[110px_150px_minmax(180px,1fr)_170px_150px_32px]">
        {/* {saved ? (
          <SkuImageCell skuId={skuId} image={skuImage} canEdit={canEditImages} />
        ) : (
          <span
            className="pt-2 text-xs text-muted-foreground"
            title="Ảnh biến thể thêm được sau khi lưu"
          >
            —
          </span>
        )} */}
        {/* <FormField
          control={form.control}
          name={`skus.${index}.code`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Mã SKU</FormLabel>
              <FormControl>
                <Input
                  placeholder="TL08-BLUE-05"
                  className="font-mono"
                  disabled={saved}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /> */}
        {/* {existingBarcode ? (
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
        )} */}
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
          <div className="pt-2 text-sm text-muted-foreground"></div>
        )}
        {onRemove && !simple ? (
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
      {/* Dòng 2: giá nhập / giá bán / trọng lượng (gram → kg lúc gửi) / tồn đầu kỳ (chỉ dòng mới) */}
      <div className="grid items-start gap-2 sm:grid-cols-5">
        {simple ? null : (
          <FormField
            control={form.control}
            name={`skus.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Tên biến thể</FormLabel>
                <FormControl>
                  <Input placeholder="Bút bi Thiên Long TL-08 xanh 0.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name={`skus.${index}.purchasePrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Giá nhập</FormLabel>
              <FormControl>
                <MoneyInput value={field.value ?? ''} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`skus.${index}.salePrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Giá bán</FormLabel>
              <FormControl>
                <MoneyInput value={field.value ?? ''} onChange={field.onChange} />
              </FormControl>
              <FormDescription className="text-[11px]">Ghi vào bảng giá mặc định</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`skus.${index}.weightG`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Cân nặng (g)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="vd 250"
                  className="text-right tabular-nums"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription className="text-[11px]">
                Tính cước hãng vận chuyển; lưu theo kg trên SKU
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {saved ? (
          <FormItem>
            <FormLabel className="text-xs text-muted-foreground">Tồn kho</FormLabel>
            <p className="pt-2 text-sm text-muted-foreground">
              Xem ở danh sách — nhập/xuất qua chứng từ
            </p>
          </FormItem>
        ) : (
          <FormField
            control={form.control}
            name={`skus.${index}.openingQty`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Tồn đầu kỳ</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    placeholder="0"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription className="text-[11px]">
                  Ghi movement OPENING vào kho mặc định, giá vốn = giá nhập
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      {/* F3 — hàng 3: đa ĐVT. SKU đã lưu hiện quy đổi sẵn có dạng chip; khai thêm ở các ô bên cạnh. */}
      <div className="grid items-start gap-2 sm:grid-cols-4 lg:max-w-3xl">
        {/* <FormField
          control={form.control}
          name={`skus.${index}.altUom`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">
                {saved ? 'Thêm ĐVT phụ' : 'ĐVT phụ'}
              </FormLabel>
              <Select
                value={field.value === '' ? NONE : field.value}
                onValueChange={(x) => field.onChange(x === NONE ? '' : x)}
              >
                <FormControl>
                  <SelectTrigger aria-label="ĐVT phụ">
                    <SelectValue placeholder="Không" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>Không</SelectItem>
                  {altOptions
                    .filter((u) => !existingConvUoms.includes(u.code))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.code}>
                        {u.code} — {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {existingConvUoms.length > 0 ? (
                <FormDescription className="text-[11px]">
                  Đã có: {existingConvUoms.join(', ')}
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`skus.${index}.altFactor`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Hệ số quy đổi</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  placeholder="24"
                  disabled={!altUom}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription className="text-[11px]">
                1 {altUom || 'ĐVT phụ'} = ? {baseUom}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`skus.${index}.altBarcode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Barcode ĐVT phụ</FormLabel>
              <FormControl>
                <Input
                  placeholder="quét mã thùng"
                  className="font-mono"
                  disabled={!altUom}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`skus.${index}.salesUom`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">ĐVT bán mặc định</FormLabel>
              <Select
                value={field.value === '' ? NONE : field.value}
                onValueChange={(x) => field.onChange(x === NONE ? '' : x)}
              >
                <FormControl>
                  <SelectTrigger aria-label="ĐVT bán mặc định">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>{baseUom || 'ĐVT cơ sở'}</SelectItem>
                  {[...new Set([...existingConvUoms, ...(altUom ? [altUom] : [])])].map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        /> */}
      </div>
    </div>
  );
}
