'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  applyServerErrors,
  EntityPicker,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/data/form';
import { ScanInput } from '@/components/data/scan-input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { isApiError, type ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatMoney, formatQuantity } from '@/lib/format';
import { dateKeySchema, moneySchema, quantitySchema } from '@/lib/shared';
import { useContainerTypes } from '../api/use-containers';
import {
  useBarcodeLookup,
  useSkuConversions,
  useSkuSearch,
  type ScannedBarcode,
} from '../api/use-locations';
import { useCreateReceipt, usePostReceipt } from '../api/use-receipts';
import { isOperationalWarehouse, useWarehouses } from '../api/use-warehouses';

/** Cùng regex với quantitySchema — dùng để guard trước khi new Decimal(). */
const QTY_RE = /^\d{1,12}(\.\d{1,6})?$/;

/** SL dòng (theo ĐVT dòng) × factor → SL đơn vị bán chính; null khi chưa nhập hợp lệ. */
function baseQty(qty: string, factor: string): Decimal | null {
  if (!QTY_RE.test(qty) || !QTY_RE.test(factor)) return null;
  return new Decimal(qty).mul(factor);
}

/**
 * Tạo phiếu nhập kho (design GrnCreate) — POST /goods-receipts (DRAFT), nút
 * "Post phiếu" gọi tiếp POST /goods-receipts/:id/post. Idempotency-Key sinh lúc
 * bấm, GIỮ NGUYÊN khi retry (luật 4); đổi khi người dùng sửa form.
 *
 * Khác design (backend chưa mô tả được):
 * - "Nhà cung cấp" + "Tham chiếu PO": chờ P2-01 — chưa có GET /purchase-orders
 *   để dựng ô chọn; phiếu tạo ở đây là NHẬP TỰ DO.
 * - "Số chứng từ NCC", NSX / Vị trí cất: DTO chưa có trường tương ứng (vị trí cất do
 *   task PUT_AWAY gợi ý sau post).
 *
 * 2026-10-01 — nhập theo thùng / pallet: chọn ĐVT của dòng trong các quy đổi của SKU (quy cách
 * khai ở form sản phẩm); gửi `uom` + SL + đơn giá THEO ĐVT ĐÓ, server quy ra đơn vị bán chính
 * (qtyBase = SL × factor, giá mỗi đơn vị = đơn giá / factor) và snapshot factor lên dòng. Chọn
 * ĐVT là cấp đóng gói → điền sẵn khối "Đóng gói" (mỗi thùng / pallet = factor đơn vị).
 *
 * 2026-10-04 — ĐVT nhập chỉ còn đơn vị bán chính + thùng / pallet đã khai quy cách ở sản phẩm
 * (quy đổi có containerTypeId); khối "Đóng gói" không còn hiện trên form — vỏ thùng / pallet
 * suy ra từ ĐVT nhập (mỗi vỏ = factor đơn vị). Ô quét barcode: mã nhà sản xuất dán sẵn trên
 * sản phẩm / thùng / pallet (khai ở chi tiết sản phẩm) → thêm dòng đúng SKU + ĐVT, quét lại
 * cùng mã thì cộng 1.
 */
const lineSchema = z.object({
  skuId: z.string().min(1, 'Chọn sản phẩm'),
  /** Nhãn hiển thị của SKU đã chọn — không gửi server. */
  skuLabel: z.string(),
  /** F4 — chế độ theo dõi của SKU đã chọn (từ meta của picker, không gửi server). */
  tracking: z.enum(['NONE', 'LOT', 'SERIAL']),
  /** SL theo ĐVT của dòng (`uom`). */
  qty: quantitySchema,
  /** Mã ĐVT nhập — '' = đơn vị bán chính (ĐVT cơ sở). */
  uom: z.string(),
  /** Hệ số của `uom` về ĐVT cơ sở ('1' khi nhập theo ĐVT cơ sở) — chỉ để hiển thị / kiểm form. */
  factor: z.string(),
  /** ĐVT cơ sở của SKU đã chọn (meta picker) — chỉ hiển thị. */
  baseUomCode: z.string(),
  /** Đơn giá theo ĐVT của dòng — server chia factor ra giá mỗi đơn vị bán chính. */
  unitCost: moneySchema,
  lotNumber: z.string().trim().max(64, 'Tối đa 64 ký tự'),
  expiryDate: z.union([dateKeySchema, z.literal('')]),
  /** PLAN-packaging-hierarchy D — đóng thùng lúc nhận: loại thùng ('' = hàng rời). */
  packType: z.string(),
  /** Số ĐVT cơ sở trong MỘT thùng — bắt buộc khi có packType; SL dòng phải chia hết. */
  packQtyPer: z.union([quantitySchema, z.literal('')]),
  /** Bọc tất cả thùng vào một cha (pallet) — '' = không bọc. */
  packWrapIn: z.string(),
});
const receiptSchema = z
  .object({
    warehouseId: z.string().min(1, 'Chọn kho nhận'),
    receivedAt: dateKeySchema,
    note: z.string().trim().max(1000, 'Tối đa 1000 ký tự'),
    lines: z.array(lineSchema).min(1, 'Phiếu phải có ít nhất một dòng'),
  })
  .superRefine((v, ctx) => {
    // F4 — mirror 422 RECEIPT_LOT_REQUIRED: SKU theo lô phải có số lô ngay từ form
    v.lines.forEach((l, i) => {
      if (l.tracking === 'LOT' && !l.lotNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', i, 'lotNumber'],
          message: 'SKU theo lô — bắt buộc số lô',
        });
      }
      // D — mirror 422 của api: count × qtyPerContainer = qtyBase (chia hết).
      if (l.packType) {
        if (!l.packQtyPer) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['lines', i, 'qty'],
            message: 'Thiếu quy cách thùng — chọn lại ĐVT nhập',
          });
        } else if (QTY_RE.test(l.qty) && QTY_RE.test(l.packQtyPer)) {
          // Guard cả 2 vế: superRefine vẫn chạy khi field con sai regex (status
          // "dirty"), nên new Decimal('1/10') sẽ throw nếu không kiểm tra trước.
          // SL mỗi thùng tính theo ĐVT cơ sở → so với SL dòng ĐÃ quy đổi (× factor).
          const per = new Decimal(l.packQtyPer);
          const qtyBase = baseQty(l.qty, l.factor);
          // Khối đóng gói không hiện trên form — báo lỗi ở ô số lượng (nhập số thùng / pallet nguyên).
          if (per.lte(0) || !qtyBase || !qtyBase.div(per).isInteger()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['lines', i, 'qty'],
              message: `Nhập số ${l.uom || 'thùng'} nguyên`,
            });
          }
        }
      }
    });
  });
type ReceiptValues = z.infer<typeof receiptSchema>;

const EMPTY_LINE: ReceiptValues['lines'][number] = {
  skuId: '',
  skuLabel: '',
  tracking: 'NONE',
  qty: '',
  uom: '',
  factor: '1',
  baseUomCode: '',
  unitCost: '',
  lotNumber: '',
  expiryDate: '',
  packType: '',
  packQtyPer: '',
  packWrapIn: '',
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Thành tiền một dòng — decimal.js, chỉ để hiển thị (server tự tính lại). */
function LineValue({ form, index }: { form: UseFormReturn<ReceiptValues>; index: number }) {
  const qty = useWatch({ control: form.control, name: `lines.${index}.qty` });
  const unitCost = useWatch({ control: form.control, name: `lines.${index}.unitCost` });
  const ok = /^\d{1,12}(\.\d{1,6})?$/.test(qty) && /^-?\d{1,14}(\.\d{1,4})?$/.test(unitCost);
  return (
    <span className="tabular-nums">
      {ok ? formatMoney(new Decimal(qty).times(unitCost).toFixed(4)) : '—'}
    </span>
  );
}

function TotalValue({ form }: { form: UseFormReturn<ReceiptValues> }) {
  const lines = useWatch({ control: form.control, name: 'lines' });
  const sum = (lines ?? []).reduce((acc, l) => {
    const ok = /^\d{1,12}(\.\d{1,6})?$/.test(l.qty) && /^-?\d{1,14}(\.\d{1,4})?$/.test(l.unitCost);
    return ok ? acc.plus(new Decimal(l.qty).times(l.unitCost)) : acc;
  }, new Decimal(0));
  return <b className="tabular-nums">{formatMoney(sum.toFixed(4))}</b>;
}

export function GrnCreateScreen() {
  const router = useRouter();
  const warehouses = useWarehouses();
  const containerTypes = useContainerTypes();
  const create = useCreateReceipt();
  const post = usePostReceipt();
  const isPending = create.isPending || post.isPending;
  // Idempotency-Key theo phiên form — sinh khi bấm lần đầu, reset khi form đổi.
  const idemKey = useRef<string | null>(null);

  const form = useForm<ReceiptValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      warehouseId: '',
      receivedAt: todayKey(),
      note: '',
      lines: [EMPTY_LINE],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const lookupBarcode = useBarcodeLookup();
  const typeCodeById = new Map((containerTypes.data ?? []).map((t) => [t.id, t.code]));

  /**
   * Quét mã dán sẵn trên sản phẩm / thùng / pallet: cùng SKU + ĐVT đã có dòng → +1; dòng cuối
   * còn trống → điền vào; còn lại thêm dòng. Mã gắn ĐVT không phải cấp đóng gói → quy về đơn
   * vị bán chính (+factor). Không tìm thấy → báo, không thêm gì.
   */
  const onScan = async (code: string) => {
    let scanned: ScannedBarcode;
    try {
      scanned = await lookupBarcode(code);
    } catch (err) {
      toast.error(
        isApiError(err) && err.status === 404
          ? `Không tìm thấy barcode ${code}. Khai mã ở chi tiết sản phẩm → tab Barcode rồi quét lại.`
          : messageFor(err),
      );
      return;
    }
    const { lookup, containerTypeId } = scanned;
    const container = containerTypeId ? typeCodeById.get(containerTypeId) : undefined;
    const isBase = lookup.uom.id === lookup.baseUom.id;
    // ĐVT thường (không phải thùng / pallet) không có trong danh sách ĐVT nhập → nhập theo ĐVT cơ sở.
    const uom = !isBase && containerTypeId ? lookup.uom.code : '';
    const factor = uom ? new Decimal(lookup.factor).toString() : '1';
    const step = !isBase && !containerTypeId ? new Decimal(lookup.factor) : new Decimal(1);
    const lines = form.getValues('lines');
    const same = lines.findIndex((l) => l.skuId === lookup.sku.id && l.uom === uom);
    if (same >= 0) {
      const cur = lines[same]!.qty;
      const next = (QTY_RE.test(cur) ? new Decimal(cur) : new Decimal(0)).plus(step);
      form.setValue(`lines.${same}.qty`, next.toString(), { shouldValidate: true });
      toast.success(
        `${lookup.sku.name}: ${formatQuantity(next.toString())} ${uom || lookup.baseUom.code}`,
      );
      return;
    }
    const line: ReceiptValues['lines'][number] = {
      ...EMPTY_LINE,
      skuId: lookup.sku.id,
      skuLabel: lookup.sku.name,
      tracking: lookup.sku.trackingMode,
      qty: step.toString(),
      uom,
      factor,
      baseUomCode: lookup.baseUom.code,
      ...(uom && container ? { packType: container, packQtyPer: factor } : {}),
    };
    const last = lines.length - 1;
    if (last >= 0 && lines[last]!.skuId === '') form.setValue(`lines.${last}`, line);
    else append(line);
    idemKey.current = null;
    toast.success(`Đã thêm ${lookup.sku.name} (${uom || lookup.baseUom.code})`);
  };

  const submit = (thenPost: boolean) =>
    form.handleSubmit(async (v) => {
      idemKey.current ??= crypto.randomUUID();
      const body = {
        warehouseId: v.warehouseId,
        receivedAt: v.receivedAt,
        ...(v.note ? { note: v.note } : {}),
        lines: v.lines.map((l) => ({
          skuId: l.skuId,
          qty: l.qty,
          // Nhập theo thùng / pallet: SL + đơn giá theo ĐVT này, server quy ra đơn vị bán chính.
          ...(l.uom ? { uom: l.uom } : {}),
          unitCost: l.unitCost,
          ...(l.lotNumber ? { lotNumber: l.lotNumber } : {}),
          ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}),
          // D — vỏ thùng tạo ngay khi lưu nháp (in tem trước khi post), tồn vào thùng lúc post.
          ...(l.packType
            ? {
                packaging: {
                  containerType: l.packType,
                  qtyPerContainer: l.packQtyPer,
                  ...(l.packWrapIn ? { wrapIn: { containerType: l.packWrapIn } } : {}),
                },
              }
            : {}),
        })),
      };
      try {
        const draft = await create.mutateAsync({ body, key: idemKey.current });
        if (thenPost) {
          try {
            await post.mutateAsync(draft.receiptId);
            toast.success(`Đã post phiếu ${draft.docNumber}`);
          } catch (err) {
            // Phiếu đã tạo nhưng post trượt (ví dụ thiếu lô) — đưa về nháp để sửa
            toast.error(messageFor(err));
          }
        } else {
          toast.success(`Đã lưu nháp ${draft.docNumber}`);
        }
        router.push(`/wms/grn/${draft.receiptId}`);
      } catch (err) {
        applyServerErrors(form, err as ApiError, {
          knownFields: ['warehouseId', 'receivedAt', 'note', 'lines'],
        });
      }
    })();

  // Người dùng sửa form sau một lần gửi lỗi → khóa mới cho lần gửi sau
  const resetKeyOnChange = () => {
    if (!isPending) idemKey.current = null;
  };

  const rootError = form.formState.errors.root?.server?.message;
  const linesError =
    form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message;

  return (
    <>
      <PageHeader
        title="Tạo phiếu nhập kho"
        description="Số phiếu cấp tự động khi lưu · nhập tự do (nhập theo PO chờ P2-01)"
        breadcrumb={[
          { label: 'Kho' },
          { label: 'Nhập kho', href: '/wms/grn' },
          { label: 'Tạo phiếu' },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => router.push('/wms/grn')}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => void submit(false)}
            >
              {create.isPending && !post.isPending ? 'Đang lưu…' : 'Lưu nháp'}
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => void submit(true)}>
              {post.isPending ? 'Đang post…' : 'Post phiếu'}
            </Button>
          </>
        }
      />

      <Form {...form}>
        <form className="flex flex-col gap-3" noValidate onChange={resetKeyOnChange}>
          <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kho nhận *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn kho" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(warehouses.data ?? []).filter(isOperationalWarehouse).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
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
              name="receivedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày nhập</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Input placeholder="Ghi chú giao nhận, biển số xe…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {rootError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {rootError}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-md border bg-card">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">Dòng nhập · {fields.length} dòng</h2>
              <ScanInput
                className="ml-auto mr-2 w-80"
                label="Quét barcode sản phẩm / thùng / pallet"
                placeholder="Quét mã trên sản phẩm / thùng / pallet…"
                paused
                onScan={(code) => void onScan(code)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_LINE)}>
                <Plus aria-hidden />
                Thêm dòng
              </Button>
            </header>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="w-8 px-2.5 text-xs">#</TableHead>
                    <TableHead className="min-w-64 px-2.5 text-xs">Sản phẩm</TableHead>
                    <TableHead className="w-56 px-2.5 text-xs">Số lượng · ĐVT nhập</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">Lô</TableHead>
                    <TableHead className="w-36 px-2.5 text-xs">HSD</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">Đơn giá / ĐVT nhập</TableHead>
                    <TableHead className="w-32 px-2.5 text-right text-xs">Thành tiền</TableHead>
                    <TableHead className="w-10 px-2.5 text-xs">
                      <span className="sr-only">Xóa dòng</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f, i) => (
                    <LineRows
                      key={f.id}
                      form={form}
                      i={i}
                      canRemove={fields.length > 1}
                      remove={() => remove(i)}
                      containerTypes={containerTypes.data ?? []}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <footer className="flex items-center justify-between border-t px-3 py-2 text-sm">
              {linesError ? <span className="text-destructive">{linesError}</span> : <span />}
              <span>
                Tổng giá trị: <TotalValue form={form} />
              </span>
            </footer>
          </section>
        </form>
      </Form>
    </>
  );
}

/** Một dòng nhập — vỏ thùng / pallet suy từ ĐVT nhập, không còn hàng "Đóng gói" riêng. */
function LineRows({
  form,
  i,
  canRemove,
  remove,
  containerTypes,
}: {
  form: UseFormReturn<ReceiptValues>;
  i: number;
  canRemove: boolean;
  remove: () => void;
  containerTypes: { id: string; code: string; name: string }[];
}) {
  return (
    <>
      <TableRow>
        <TableCell className="px-2.5 py-1.5 text-muted-foreground">{i + 1}</TableCell>
        <TableCell className="px-2.5 py-1.5">
          <FormField
            control={form.control}
            name={`lines.${i}.skuId`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <EntityPicker
                    value={field.value}
                    onChange={(id, option) => {
                      field.onChange(id);
                      form.setValue(`lines.${i}.skuLabel`, option?.label ?? '');
                      form.setValue(
                        `lines.${i}.tracking`,
                        (option?.meta?.trackingMode as 'NONE' | 'LOT' | 'SERIAL') ?? 'NONE',
                      );
                      // Đổi SKU → về đơn vị bán chính; quy đổi của SKU mới tải lại.
                      form.setValue(
                        `lines.${i}.baseUomCode`,
                        (option?.meta?.baseUomCode as string | undefined) ?? '',
                      );
                      form.setValue(`lines.${i}.uom`, '');
                      form.setValue(`lines.${i}.factor`, '1');
                      form.setValue(`lines.${i}.packType`, '');
                      form.setValue(`lines.${i}.packQtyPer`, '');
                    }}
                    useSearch={useSkuSearch}
                    selectedLabel={form.getValues(`lines.${i}.skuLabel`) || undefined}
                    placeholder="Tìm SKU…"
                    searchPlaceholder="Mã / tên SKU / barcode…"
                    clearable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          <QtyUnitCell form={form} i={i} containerTypes={containerTypes} />
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          <FormField
            control={form.control}
            name={`lines.${i}.lotNumber`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="L2608" className="font-mono" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          <FormField
            control={form.control}
            name={`lines.${i}.expiryDate`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          <FormField
            control={form.control}
            name={`lines.${i}.unitCost`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TableCell>
        <TableCell className="px-2.5 py-1.5 text-right">
          <LineValue form={form} index={i} />
        </TableCell>
        <TableCell className="px-2.5 py-1.5">
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Xóa dòng ${i + 1}`}
              onClick={remove}
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * Ô số lượng + ĐVT nhập của một dòng: đơn vị bán chính hoặc một quy đổi của SKU (thùng / pallet
 * khai ở form sản phẩm). Chọn ĐVT là cấp đóng gói → điền sẵn "Đóng gói" mỗi thùng = factor; dưới
 * ô hiện SL đã quy ra đơn vị bán chính (decimal.js, chỉ hiển thị — server tự tính lại).
 */
function QtyUnitCell({
  form,
  i,
  containerTypes,
}: {
  form: UseFormReturn<ReceiptValues>;
  i: number;
  containerTypes: { id: string; code: string; name: string }[];
}) {
  const skuId = useWatch({ control: form.control, name: `lines.${i}.skuId` });
  const uom = useWatch({ control: form.control, name: `lines.${i}.uom` });
  const qty = useWatch({ control: form.control, name: `lines.${i}.qty` });
  const factor = useWatch({ control: form.control, name: `lines.${i}.factor` });
  const baseUom = useWatch({ control: form.control, name: `lines.${i}.baseUomCode` });
  const conversions = useSkuConversions(skuId);
  const typeById = new Map(containerTypes.map((t) => [t.id, t]));
  // Chỉ thùng / pallet đã khai quy cách ở sản phẩm (quy đổi là cấp đóng gói) — ĐVT phụ khác bỏ.
  const options = (conversions.data ?? [])
    .filter((c) => c.containerTypeId !== null)
    .sort((a, b) => new Decimal(a.factor).comparedTo(new Decimal(b.factor)));
  const BASE = '__base__';
  const qtyBase = uom ? baseQty(qty, factor) : null;

  const onUnit = (code: string) => {
    if (code === BASE) {
      form.setValue(`lines.${i}.uom`, '');
      form.setValue(`lines.${i}.factor`, '1');
      // Về hàng rời — bỏ vỏ thùng / pallet đã suy từ ĐVT trước.
      form.setValue(`lines.${i}.packType`, '');
      form.setValue(`lines.${i}.packQtyPer`, '');
      return;
    }
    const c = options.find((o) => o.uom.code === code);
    if (!c) return;
    form.setValue(`lines.${i}.uom`, code);
    form.setValue(`lines.${i}.factor`, new Decimal(c.factor).toString());
    const container = c.containerTypeId ? typeById.get(c.containerTypeId)?.code : undefined;
    if (container) {
      // Nhập theo thùng / pallet → mỗi vỏ chứa đúng factor đơn vị bán chính (sửa được).
      form.setValue(`lines.${i}.packType`, container);
      form.setValue(`lines.${i}.packQtyPer`, new Decimal(c.factor).toString());
      form.setValue(`lines.${i}.packWrapIn`, '');
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1">
        <FormField
          control={form.control}
          name={`lines.${i}.qty`}
          render={({ field }) => (
            <FormItem className="w-24">
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Số lượng dòng ${i + 1}`}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Select value={uom || BASE} onValueChange={onUnit} disabled={!skuId}>
          <SelectTrigger className="w-28" aria-label={`ĐVT nhập dòng ${i + 1}`}>
            <SelectValue placeholder="ĐVT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BASE}>{baseUom || 'Đơn vị bán chính'}</SelectItem>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.uom.code}>
                {`${(c.containerTypeId && typeById.get(c.containerTypeId)?.name) || c.uom.code} (${formatQuantity(c.factor)} ${baseUom})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {qtyBase ? (
        <span className="text-xs tabular-nums text-muted-foreground">
          = {formatQuantity(qtyBase.toString())} {baseUom}
        </span>
      ) : null}
    </div>
  );
}
