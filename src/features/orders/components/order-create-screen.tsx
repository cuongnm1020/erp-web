'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { Plus, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { formatMoney, formatQuantity } from '@/lib/format';
import { Can } from '@/lib/permission';
import {
  useCustomerBrief,
  useCustomerSearch,
  useLinePrice,
  useSkuAvailability,
  useSkuDetail,
  useSkuSearch,
} from '../api/use-line-entry';
import { useCreateOrder, useOrder } from '../api/use-orders';
import { orderChannelLabel } from '../labels';
import { QuickCustomerDialog } from './quick-customer-dialog';
import {
  createOrderSchema,
  EMPTY_LINE,
  ORDER_CHANNELS,
  toCreateOrderBody,
  type CreateOrderValues,
} from '../schema';

/**
 * D-01 Nhập đơn — nối POST /sales-orders, bám design canvas (luật 15) trong phạm vi API:
 * - Giá niêm yết / thành tiền / tạm tính: XEM TRƯỚC qua GET /prices/resolve (server resolve,
 *   client chỉ nhân-trừ hiển thị bằng decimal.js — luật 10). Giá CUỐI vẫn do POST snapshot;
 *   khuyến mãi và VAT chỉ tính lúc chốt (chưa có endpoint preview / VAT chưa cấu hình).
 * - CK% vượt trần bảng giá: canvas nói "cảnh báo, không chặn" nhưng API chặn 422 — hiện cảnh
 *   báo đỏ ngay khi gõ để không bất ngờ lúc chốt.
 * - KHÔNG có "Lưu nháp" (API không có endpoint nháp); "Ngày đơn"/"Kho xuất"/"Địa chỉ giao"
 *   chưa có trường API tương ứng.
 * - Nút chốt không đoán trước có cần duyệt (rule trong DB) — toast theo status trả về.
 * - ?from=<orderId>: tạo lại từ đơn cũ (sửa = hủy & tạo lại); ?customerId=<id>: vào từ nút
 *   "Tạo đơn" của hồ sơ khách — chọn sẵn khách. "+ Khách mới": tạo nhanh khách ngay tại form.
 */
export function OrderCreateScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const fromId = search.get('from') ?? '';
  const presetCustomerId = search.get('customerId') ?? '';
  const source = useOrder(fromId);
  const create = useCreateOrder();
  // Idempotency-Key sinh lúc bấm, GIỮ NGUYÊN khi retry lỗi mạng/5xx; đổi khi người dùng sửa form.
  const idemKey = useRef<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  /** Nhãn hiển thị cho khách vừa tạo nhanh / khách chọn sẵn — EntityPicker chưa tự tra được. */
  const [pickedCustomer, setPickedCustomer] = useState<{ id: string; name: string } | null>(null);
  const presetCustomer = useCustomerBrief(presetCustomerId);
  useEffect(() => {
    if (presetCustomer.data && !pickedCustomer) {
      setPickedCustomer({ id: presetCustomer.data.id, name: presetCustomer.data.name });
    }
  }, [presetCustomer.data, pickedCustomer]);
  /** Thành tiền từng dòng (key = field id) để cộng Tạm tính; null = dòng chưa có giá. */
  const [lineTotals, setLineTotals] = useState<Record<string, string | null>>({});
  const onLineTotal = useCallback((fieldId: string, total: string | null) => {
    setLineTotals((prev) => (prev[fieldId] === total ? prev : { ...prev, [fieldId]: total }));
  }, []);

  const form = useForm<CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: presetCustomerId,
      channel: 'DIRECT',
      shippingFee: '',
      lines: [EMPTY_LINE],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const channel = useWatch({ control: form.control, name: 'channel' });
  const shippingFee = useWatch({ control: form.control, name: 'shippingFee' });

  const subtotal = useMemo(() => {
    const ids = new Set(lines.fields.map((f) => f.id));
    const totals = Object.entries(lineTotals).filter(([k]) => ids.has(k));
    const known = totals.filter(([, v]) => v !== null);
    if (known.length === 0) return { value: null as string | null, missing: totals.length };
    const sum = known.reduce((acc, [, v]) => acc.plus(v as string), new Decimal(0));
    return { value: sum.toFixed(4), missing: totals.length - known.length };
  }, [lineTotals, lines.fields]);
  const shipValid = /^\d{1,14}(\.\d{1,4})?$/.test(shippingFee ?? '');
  const grandTotal =
    subtotal.value !== null
      ? new Decimal(subtotal.value).plus(shipValid ? (shippingFee as string) : '0').toFixed(4)
      : null;

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
                    <div className="flex items-center justify-between">
                      <FormLabel>Khách hàng</FormLabel>
                      <Can I="create" a="Customer">
                        <button
                          type="button"
                          onClick={() => setQuickOpen(true)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                          Khách mới
                        </button>
                      </Can>
                    </div>
                    <FormControl>
                      <EntityPicker
                        value={field.value}
                        onChange={field.onChange}
                        useSearch={useCustomerSearch}
                        selectedLabel={
                          pickedCustomer?.id === field.value
                            ? pickedCustomer.name
                            : fromId && source.data?.customer.id === field.value
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
            <header className="border-b px-3 py-2 text-sm font-semibold">Tổng quan</header>
            <dl className="flex flex-col gap-2 px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tạm tính</dt>
                <dd className="font-semibold tabular-nums">
                  {subtotal.value !== null ? formatMoney(subtotal.value, { unit: '' }) : '—'}
                </dd>
              </div>
              {subtotal.missing > 0 ? (
                <p className="text-xs text-warning-foreground text-muted-foreground">
                  {subtotal.missing} dòng chưa có giá — chọn khách/sản phẩm để xem đủ.
                </p>
              ) : null}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Khuyến mãi</dt>
                <dd className="text-xs text-muted-foreground">tính khi chốt</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Thuế (VAT)</dt>
                <dd className="text-xs text-muted-foreground">chưa cấu hình</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">Phí vận chuyển</dt>
                <dd className="w-32">
                  <FormField
                    control={form.control}
                    name="shippingFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Phí vận chuyển</FormLabel>
                        <FormControl>
                          <MoneyInput value={field.value ?? ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <dt className="font-semibold">Tổng tạm tính</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {grandTotal !== null ? formatMoney(grandTotal, { unit: '' }) : '—'}
                </dd>
              </div>
              <p className="text-xs text-muted-foreground">
                Giá xem trước theo bảng giá của khách; số CUỐI do hệ thống chốt khi bấm Chốt đơn
                (gồm khuyến mãi). Đơn vượt ngưỡng sẽ tự chuyển chờ duyệt.
              </p>
            </dl>
          </section>
        </div>

        {quickOpen ? (
          // Mount có điều kiện: đừng gọi GET /teams khi người dùng chưa mở dialog
          <QuickCustomerDialog
            open={quickOpen}
            onOpenChange={setQuickOpen}
            onCreated={(c) => {
              setPickedCustomer(c);
              form.setValue('customerId', c.id, { shouldValidate: true });
            }}
          />
        ) : null}

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
                fieldId={f.id}
                form={form}
                index={i}
                customerId={customerId}
                channel={channel}
                onTotal={onLineTotal}
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

const QTY_RE = /^\d{1,12}(\.\d{1,6})?$/;
const PCT_RE = /^\d{1,2}(\.\d{1,2})?$/;

/**
 * Một dòng hàng: # → SKU → ĐVT → SL (quy đổi cơ sở) → Giá niêm yết (xem trước) → CK% (cảnh báo
 * vượt trần) → Thành tiền (decimal.js, chỉ hiển thị) → khả dụng. Báo thành tiền lên form cha
 * để cộng Tạm tính.
 */
function LineRow({
  fieldId,
  form,
  index,
  customerId,
  channel,
  onTotal,
  onRemove,
}: {
  fieldId: string;
  form: UseFormReturn<CreateOrderValues>;
  index: number;
  customerId: string;
  channel: CreateOrderValues['channel'];
  onTotal: (fieldId: string, total: string | null) => void;
  onRemove?: () => void;
}) {
  const skuId = useWatch({ control: form.control, name: `lines.${index}.skuId` });
  const uomId = useWatch({ control: form.control, name: `lines.${index}.uomId` });
  const qty = useWatch({ control: form.control, name: `lines.${index}.qty` });
  const dp = useWatch({ control: form.control, name: `lines.${index}.discountPercent` }) ?? '';
  const sku = useSkuDetail(skuId);
  const stock = useSkuAvailability(sku.data?.code ?? '');
  const qtyValid = QTY_RE.test(qty ?? '');
  const price = useLinePrice({
    skuId,
    uomId,
    qty: qtyValid ? qty : '',
    customerId,
    channel,
  });

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

  // Thành tiền xem trước = niêm yết × (1 − CK%) × SL — đúng phép tính server (làm tròn 4 lẻ)
  const dpValid = dp === '' || PCT_RE.test(dp);
  const lineTotal =
    price.data && qtyValid && dpValid
      ? new Decimal(price.data.listPrice)
          .mul(new Decimal(1).minus(dp === '' ? 0 : new Decimal(dp).div(100)))
          .toDecimalPlaces(4)
          .mul(qty)
          .toDecimalPlaces(4)
          .toFixed(4)
      : null;
  useEffect(() => {
    onTotal(fieldId, lineTotal);
  }, [fieldId, lineTotal, onTotal]);

  // Trần CK của bảng giá (0..1) — server CHẶN 422 khi vượt, cảnh báo ngay lúc gõ
  const maxPct =
    price.data?.maxDiscount != null ? new Decimal(price.data.maxDiscount).mul(100) : null;
  const overCap =
    maxPct !== null && dp !== '' && dpValid ? new Decimal(dp).greaterThan(maxPct) : false;

  return (
    <div className="grid items-start gap-2 px-3 py-2 sm:grid-cols-[20px_minmax(190px,2fr)_120px_100px_100px_84px_110px_minmax(110px,1fr)_32px]">
      <div className="pt-2 text-xs text-muted-foreground">{index + 1}</div>
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
      <div className="pt-2 text-right text-sm tabular-nums text-muted-foreground">
        {price.data ? (
          formatMoney(price.data.listPrice, { unit: '' })
        ) : skuId && customerId ? (
          <span className="text-xs">{price.isPending && price.isFetching ? '…' : '—'}</span>
        ) : (
          <span className="text-xs">chọn khách</span>
        )}
      </div>
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
                className={
                  overCap ? 'border-destructive text-right tabular-nums' : 'text-right tabular-nums'
                }
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            {overCap && maxPct !== null ? (
              <p className="text-xs font-medium text-destructive">
                vượt trần {formatQuantity(maxPct.toString())}% — hệ thống sẽ chặn khi chốt
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="pt-2 text-right text-sm font-semibold tabular-nums">
        {lineTotal !== null ? formatMoney(lineTotal, { unit: '' }) : '—'}
      </div>
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
