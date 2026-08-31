'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
  EntityPicker,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
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
import { toast } from '@/components/ui/toaster';
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError, type ApiError } from '@/lib/api/errors';
import { messageFor } from '@/lib/error-messages';
import { formatQuantity } from '@/lib/format';
import {
  useCustomerSearch,
  useSkuAvailability,
  useSkuDetail,
  useSkuSearch,
} from '../api/use-line-entry';
import { useCreateOrder, useOrder } from '../api/use-orders';
import { orderChannelLabel } from '../labels';
import {
  createOrderSchema,
  EMPTY_LINE,
  ORDER_CHANNELS,
  toCreateOrderBody,
  type CreateOrderValues,
} from '../schema';

/**
 * D-01 Nhập đơn — nối POST /sales-orders. Khác bản thiết kế UI-first ở các điểm API chưa cho phép:
 * - KHÔNG hiện giá/thành tiền/tổng trước khi chốt: client không gửi giá, server chốt qua
 *   core.resolve_price() lúc POST (bất biến 12; luật 10 cấm tính tiền ở client). Số cuối cùng
 *   xem ở màn chi tiết ngay sau khi tạo.
 * - KHÔNG có "Lưu nháp": POST luôn ra APPROVED hoặc PENDING_APPROVAL, chưa có endpoint nháp.
 * - Nút chốt không đoán trước có cần duyệt hay không (rule duyệt nằm trong DB) — toast theo
 *   status trả về.
 * - ?from=<orderId>: tạo lại từ đơn cũ (luồng "sửa" = hủy đơn cũ + tạo đơn mới) — đổ sẵn
 *   khách + dòng hàng; CK% không khôi phục được (đơn cũ lưu tiền, không lưu tỉ lệ).
 */
export function OrderCreateScreen() {
  const router = useRouter();
  const fromId = useSearchParams().get('from') ?? '';
  const source = useOrder(fromId);
  const create = useCreateOrder();
  // Idempotency-Key sinh lúc bấm, GIỮ NGUYÊN khi retry lỗi mạng/5xx; đổi khi người dùng sửa form.
  const idemKey = useRef<string | null>(null);

  const form = useForm<CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { customerId: '', channel: 'DIRECT', shippingFee: '', lines: [EMPTY_LINE] },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !source.data) return;
    prefilled.current = true;
    form.reset({
      customerId: source.data.customer.id,
      channel: source.data.channel,
      shippingFee: source.data.shippingFee,
      lines: source.data.lines
        .filter((l) => !l.isGift) // dòng quà do KM sinh — engine sẽ tự sinh lại nếu còn KM
        .map((l) => ({ skuId: l.skuId, uomId: l.uomId, qty: l.qty, discountPercent: '' })),
    });
  }, [source.data, form]);

  useEffect(() => {
    const sub = form.watch(() => {
      idemKey.current = null; // form đổi = đơn khác → key mới ở lần bấm sau
    });
    return () => sub.unsubscribe();
  }, [form]);

  const onSubmit = form.handleSubmit((values) => {
    idemKey.current ??= newIdempotencyKey();
    create.mutate(
      { body: toCreateOrderBody(values), key: idemKey.current },
      {
        onSuccess: (r) => {
          if (r.status === 'PENDING_APPROVAL') {
            toast.success(`Đã gửi duyệt đơn ${r.docNumber}`, {
              description: 'Đơn vượt ngưỡng duyệt — chờ quản lý xác nhận.',
            });
          } else {
            toast.success(`Đã chốt đơn ${r.docNumber}`, {
              description: 'Hàng đã được giữ cho đơn này.',
            });
          }
          router.push(`/crm/orders/${r.orderId}`);
        },
        onError: (err) => {
          // 409 thiếu tồn / 422 vượt trần CK: gắn lỗi vào đúng dòng theo skuId trong details
          if (isApiError(err)) {
            const skuId = (err.details as { skuId?: string } | undefined)?.skuId;
            const idx = skuId ? values.lines.findIndex((l) => l.skuId === skuId) : -1;
            if (idx >= 0) {
              const field = err.code === 'DISCOUNT_ABOVE_MAX' ? 'discountPercent' : 'qty';
              form.setError(`lines.${idx}.${field}`, { message: messageFor(err) });
              toast.error(messageFor(err));
              return;
            }
          }
          applyServerErrors(form, err as ApiError, {
            knownFields: ['customerId', 'channel', 'shippingFee', 'lines'],
          });
          const root = form.formState.errors.root?.server?.message;
          if (root) toast.error(root);
        },
      },
    );
  });

  return (
    <Form {...form}>
      <form id="order-create" onSubmit={onSubmit} className="flex flex-col gap-3">
        <PageHeader
          title={fromId ? 'Tạo lại đơn' : 'Tạo đơn hàng'}
          description={
            fromId && source.data
              ? `Từ đơn ${source.data.docNumber} — kiểm tra lại rồi chốt`
              : 'Số chứng từ cấp tự động khi chốt · giá chốt theo bảng giá của khách'
          }
          breadcrumb={[
            { label: 'Bán hàng' },
            { label: 'Đơn hàng', href: '/crm/orders' },
            { label: 'Tạo đơn' },
          ]}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/crm/orders">Hủy bỏ</Link>
              </Button>
              <Button size="sm" type="submit" form="order-create" disabled={create.isPending}>
                {create.isPending ? 'Đang chốt…' : 'Chốt đơn'}
              </Button>
            </>
          }
        />

        <div className="grid items-start gap-3 lg:grid-cols-3">
          <section className="rounded-md border bg-card lg:col-span-2">
            <header className="border-b px-3 py-2 text-sm font-semibold">Thông tin đơn</header>
            <div className="grid gap-3 px-3 py-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Khách hàng</FormLabel>
                    <FormControl>
                      <EntityPicker
                        value={field.value}
                        onChange={field.onChange}
                        useSearch={useCustomerSearch}
                        selectedLabel={
                          fromId && source.data?.customer.id === field.value
                            ? source.data.customer.name
                            : undefined
                        }
                        placeholder="Tìm theo tên, mã, SĐT…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kênh bán</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ORDER_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {orderChannelLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <header className="border-b px-3 py-2 text-sm font-semibold">Thanh toán</header>
            <div className="flex flex-col gap-3 px-3 py-3">
              <FormField
                control={form.control}
                name="shippingFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phí vận chuyển</FormLabel>
                    <FormControl>
                      <MoneyInput value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Giá bán, chiết khấu KM và tổng tiền do hệ thống chốt theo bảng giá của khách khi bấm
                Chốt đơn — xem con số cuối ở màn chi tiết. Đơn vượt ngưỡng sẽ tự chuyển chờ duyệt.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-md border bg-card">
          <header className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">
              Dòng hàng{' '}
              <span className="font-normal text-muted-foreground">· {lines.fields.length}</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => lines.append(EMPTY_LINE)}
            >
              <Plus aria-hidden />
              Thêm dòng
            </Button>
          </header>
          <div className="flex flex-col divide-y">
            {lines.fields.map((f, i) => (
              <LineRow
                key={f.id}
                form={form}
                index={i}
                onRemove={lines.fields.length > 1 ? () => lines.remove(i) : undefined}
              />
            ))}
          </div>
          {form.formState.errors.lines?.root?.message || form.formState.errors.lines?.message ? (
            <p className="border-t px-3 py-2 text-sm text-destructive">
              {form.formState.errors.lines.root?.message ?? form.formState.errors.lines.message}
            </p>
          ) : null}
        </section>
      </form>
    </Form>
  );
}

/** Một dòng hàng: SKU → ĐVT (base + quy đổi) → SL (kèm quy đổi cơ sở) → CK% → khả dụng. */
function LineRow({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<CreateOrderValues>;
  index: number;
  onRemove?: () => void;
}) {
  const skuId = useWatch({ control: form.control, name: `lines.${index}.skuId` });
  const uomId = useWatch({ control: form.control, name: `lines.${index}.uomId` });
  const qty = useWatch({ control: form.control, name: `lines.${index}.qty` });
  const sku = useSkuDetail(skuId);
  const stock = useSkuAvailability(sku.data?.code ?? '');

  // SKU vừa chọn (hoặc đổi): mặc định ĐVT cơ sở; ĐVT cũ không thuộc SKU mới thì thay
  useEffect(() => {
    if (!sku.data) return;
    const valid = [sku.data.baseUomId, ...sku.data.uomConversions.map((c) => c.uomId)];
    if (!uomId || !valid.includes(uomId)) {
      form.setValue(`lines.${index}.uomId`, sku.data.baseUomId);
    }
  }, [sku.data, uomId, form, index]);

  const factor =
    sku.data && uomId !== sku.data.baseUomId
      ? sku.data.uomConversions.find((c) => c.uomId === uomId)?.factor
      : null;
  const baseHint =
    factor && qty && /^\d/.test(qty)
      ? `= ${formatQuantity(new Decimal(qty).mul(factor).toString())} ${sku.data?.baseUom.code}`
      : null;
  const low =
    stock.data && qty
      ? new Decimal(stock.data.available).lessThan(
          factor ? new Decimal(qty).mul(factor) : new Decimal(qty || '0'),
        )
      : false;

  return (
    <div className="grid items-start gap-2 px-3 py-2 sm:grid-cols-[minmax(220px,2fr)_140px_120px_100px_minmax(120px,1fr)_32px]">
      <FormField
        control={form.control}
        name={`lines.${index}.skuId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Sản phẩm</FormLabel>
            <FormControl>
              <EntityPicker
                value={field.value}
                onChange={field.onChange}
                useSearch={useSkuSearch}
                selectedLabel={sku.data ? sku.data.name : undefined}
                placeholder="Tìm mã SKU, tên, barcode…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`lines.${index}.uomId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Đơn vị</FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={!sku.data}>
              <FormControl>
                <SelectTrigger aria-label="Đơn vị tính">
                  <SelectValue placeholder="ĐVT" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {sku.data ? (
                  <>
                    <SelectItem value={sku.data.baseUomId}>{sku.data.baseUom.code}</SelectItem>
                    {sku.data.uomConversions.map((c) => (
                      <SelectItem key={c.uomId} value={c.uomId}>
                        {c.uom.code} (= {formatQuantity(c.factor)} {sku.data!.baseUom.code})
                      </SelectItem>
                    ))}
                  </>
                ) : null}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`lines.${index}.qty`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Số lượng</FormLabel>
            <FormControl>
              <Input
                inputMode="decimal"
                aria-label="Số lượng"
                className="text-right tabular-nums"
                {...field}
              />
            </FormControl>
            {baseHint ? <p className="text-xs text-muted-foreground">{baseHint}</p> : null}
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`lines.${index}.discountPercent`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Chiết khấu %</FormLabel>
            <FormControl>
              <Input
                inputMode="decimal"
                aria-label="Chiết khấu %"
                placeholder="CK %"
                className="text-right tabular-nums"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="pt-2 text-right text-sm tabular-nums">
        {skuId === '' ? null : stock.isPending ? (
          <span className="text-muted-foreground">Đang xem tồn…</span>
        ) : stock.data ? (
          <span className={low ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
            Khả dụng {formatQuantity(stock.data.available)} / {formatQuantity(stock.data.onHand)}{' '}
            {stock.data.baseUomCode}
            {low ? ' — thiếu hàng' : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">Chưa có tồn</span>
        )}
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
