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
import type { ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatMoney } from '@/lib/format';
import { dateKeySchema, moneySchema, quantitySchema } from '@/lib/shared';
import { useSkuSearch } from '../api/use-locations';
import { useCreateReceipt, usePostReceipt } from '../api/use-receipts';
import { isOperationalWarehouse, useWarehouses } from '../api/use-warehouses';

/**
 * Tạo phiếu nhập kho (design GrnCreate) — POST /goods-receipts (DRAFT), nút
 * "Post phiếu" gọi tiếp POST /goods-receipts/:id/post. Idempotency-Key sinh lúc
 * bấm, GIỮ NGUYÊN khi retry (luật 4); đổi khi người dùng sửa form.
 *
 * Khác design (backend chưa mô tả được):
 * - "Nhà cung cấp" + "Tham chiếu PO": chờ P2-01 — chưa có GET /purchase-orders
 *   để dựng ô chọn; phiếu tạo ở đây là NHẬP TỰ DO.
 * - "Số chứng từ NCC", cột ĐVT quy đổi / NSX / Vị trí cất: DTO chưa có trường
 *   tương ứng (SL nhập theo ĐVT cơ sở; vị trí cất do task PUT_AWAY gợi ý sau post).
 */
const lineSchema = z.object({
  skuId: z.string().min(1, 'Chọn sản phẩm'),
  /** Nhãn hiển thị của SKU đã chọn — không gửi server. */
  skuLabel: z.string(),
  /** F4 — chế độ theo dõi của SKU đã chọn (từ meta của picker, không gửi server). */
  tracking: z.enum(['NONE', 'LOT', 'SERIAL']),
  qty: quantitySchema,
  unitCost: moneySchema,
  lotNumber: z.string().trim().max(64, 'Tối đa 64 ký tự'),
  expiryDate: z.union([dateKeySchema, z.literal('')]),
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
    });
  });
type ReceiptValues = z.infer<typeof receiptSchema>;

const EMPTY_LINE: ReceiptValues['lines'][number] = {
  skuId: '',
  skuLabel: '',
  tracking: 'NONE',
  qty: '',
  unitCost: '',
  lotNumber: '',
  expiryDate: '',
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
          unitCost: l.unitCost,
          ...(l.lotNumber ? { lotNumber: l.lotNumber } : {}),
          ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}),
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
                    <TableHead className="w-28 px-2.5 text-xs">SL (ĐVT cơ sở)</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">Lô</TableHead>
                    <TableHead className="w-36 px-2.5 text-xs">HSD</TableHead>
                    <TableHead className="w-32 px-2.5 text-xs">Đơn giá</TableHead>
                    <TableHead className="w-32 px-2.5 text-right text-xs">Thành tiền</TableHead>
                    <TableHead className="w-10 px-2.5 text-xs">
                      <span className="sr-only">Xóa dòng</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f, i) => (
                    <TableRow key={f.id}>
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
                                      (option?.meta?.trackingMode as 'NONE' | 'LOT' | 'SERIAL') ??
                                        'NONE',
                                    );
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
                        <FormField
                          control={form.control}
                          name={`lines.${i}.qty`}
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
                        {fields.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Xóa dòng ${i + 1}`}
                            onClick={() => remove(i)}
                          >
                            <X aria-hidden />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
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
