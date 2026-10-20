'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { FileText, Inbox, MoreVertical, Plus, Warehouse, X } from 'lucide-react';
import Link from 'next/link';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFieldArray, useForm, useWatch, type Path, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { newIdempotencyKey } from '@/lib/api/client';
import { isApiError, type ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatMoney } from '@/lib/format';
import { useWarehouse } from '@/lib/warehouse';
import type { SkuQuickRow } from '../../api/use-order-create';
import { useCreateOrder } from '../../api/use-orders';
import { orderChannelLabel, orderSourceLabel } from '../../labels';
import {
  createOrderSchema,
  EMPTY_LINE,
  ORDER_CHANNELS,
  ORDER_SOURCES,
  previewManualDiscount,
  toCreateOrderBody,
  type CreateOrderValues,
  type ManualDiscountType,
} from '../../schema';
import { CART_GRID, CartLine, type LineMetrics } from './cart-line';
import { Card, CustomerCard, InfoCard, ReceiverCard, ShippingCard } from './order-side-cards';
import { ProductSearch } from './product-search';

const NONE = '__none__';
const DEFAULT_WAREHOUSE = '__default__';
/**
 * Mật độ riêng màn tạo đơn: cả form nằm gọn một màn hình không phải cuộn. Ô nhập / ô chọn / nút mở
 * lịch cao 32px; dòng báo lỗi dưới ô chỉ chiếm chỗ khi có lỗi (trống thì ẩn).
 */
const DENSE = cn(
  '[&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:h-8',
  '[&_button[role=combobox]]:h-8 [&_button[aria-haspopup=dialog]]:h-8',
  '[&_p[id$=-form-item-message]:empty]:hidden',
);
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_COUNT = 20;
const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type CreateOrderResult = Awaited<
  ReturnType<ReturnType<typeof useCreateOrder>['mutateAsync']>
>;
export type AfterCreate = 'open' | 'next';

/** Lỗi 422 của API có `details.path` → ô tương ứng trên form + câu tiếng Việt (luật 6). */
const SERVER_PATHS: Record<string, { field: Path<CreateOrderValues>; message: string }> = {
  'customer.phone': { field: 'customerPhone', message: 'Số điện thoại khách không hợp lệ' },
  customerId: { field: 'customerName', message: 'Chọn khách hoặc nhập tên + SĐT khách' },
  'customer.birthday': { field: 'customerBirthday', message: 'Ngày sinh không hợp lệ' },
  'address.phone': { field: 'recipientPhone', message: 'Số điện thoại người nhận không hợp lệ' },
  addressId: { field: 'addressId', message: 'Địa chỉ không thuộc khách hàng này' },
  prepaidAmount: { field: 'prepaidAmount', message: 'Tiền chuyển khoản vượt tổng đơn' },
  surcharge: { field: 'surcharge', message: 'Phụ thu không hợp lệ' },
  orderDate: { field: 'orderDate', message: 'Giờ tạo đơn không được ở tương lai' },
  ownerId: { field: 'ownerId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  packerId: { field: 'packerId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  careStaffId: { field: 'careStaffId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  marketerId: { field: 'marketerId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  tagIds: { field: 'tagIds', message: 'Thẻ đã bị xóa — bỏ thẻ rồi chốt lại' },
  manualDiscountValue: {
    field: 'manualDiscountValue',
    message: 'Giảm giá vượt số tiền còn lại của đơn',
  },
  expectedDeliveryDate: { field: 'expectedDeliveryDate', message: 'Ngày không hợp lệ' },
  carrierAccountId: { field: 'carrierAccountId', message: 'Tài khoản hãng không dùng được' },
};

export interface OrderDraftFormHandle {
  submit: (mode: AfterCreate) => void;
  focusSearch: () => void;
}

/**
 * Form một tab đơn nháp — màn tạo đơn mới (2026-10-17, design đã duyệt). Bố cục: trái = Sản phẩm
 * (giỏ) + Giá trị đơn + Thanh toán + Ghi chú; phải = Thông tin + Khách hàng + Nhận hàng + Vận
 * chuyển; dưới = thanh chốt đơn. Giá / tổng là XEM TRƯỚC (decimal.js, luật 10); số cuối do
 * POST /sales-orders chốt (gồm khuyến mãi). Không optimistic (luật 5).
 */
export const OrderDraftForm = forwardRef<
  OrderDraftFormHandle,
  {
    initialValues: CreateOrderValues;
    files: File[];
    onFilesChange: (files: File[]) => void;
    onValuesChange: (values: CreateOrderValues) => void;
    onCreated: (result: CreateOrderResult, mode: AfterCreate) => void;
  }
>(function OrderDraftForm({ initialValues, files, onFilesChange, onValuesChange, onCreated }, ref) {
  const create = useCreateOrder();
  const { options: warehouseOptions } = useWarehouse();
  const searchRef = useRef<HTMLInputElement>(null);
  // Idempotency-Key sinh lúc bấm, GIỮ NGUYÊN khi retry lỗi mạng/5xx; đổi khi người dùng sửa form.
  const idemKey = useRef<string | null>(null);
  const afterCreate = useRef<AfterCreate>('open');

  const form = useForm<CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: initialValues,
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const sub = form.watch(() => {
      idemKey.current = null; // form đổi = đơn khác → key mới ở lần bấm sau
      clearTimeout(t);
      t = setTimeout(() => onValuesChange(form.getValues()), 300);
    });
    return () => {
      sub.unsubscribe();
      clearTimeout(t);
      onValuesChange(form.getValues()); // đổi tab / rời màn: lưu nốt
    };
  }, [form, onValuesChange]);

  const [metrics, setMetrics] = useState<Record<string, LineMetrics>>({});
  const onMetrics = useCallback((fieldId: string, m: LineMetrics) => {
    setMetrics((prev) =>
      prev[fieldId]?.total === m.total && prev[fieldId]?.weightKg === m.weightKg
        ? prev
        : { ...prev, [fieldId]: m },
    );
  }, []);

  const [
    customerId,
    channel,
    warehouseId,
    shippingFee,
    freeShipping,
    shipFeeOnReturnOnly,
    surcharge,
    prepaidAmount,
    manualType,
    manualValue,
  ] = useWatch({
    control: form.control,
    name: [
      'customerId',
      'channel',
      'warehouseId',
      'shippingFee',
      'freeShipping',
      'shipFeeOnReturnOnly',
      'surcharge',
      'prepaidAmount',
      'manualDiscountType',
      'manualDiscountValue',
    ],
  });

  const ids = new Set(lines.fields.map((f) => f.id));
  const known = Object.entries(metrics).filter(([k]) => ids.has(k));
  const priced = known.filter(([, m]) => m.total !== null);
  const subtotal =
    lines.fields.length === 0
      ? '0.0000'
      : priced.length === 0
        ? null
        : priced.reduce((a, [, m]) => a.plus(m.total as string), new Decimal(0)).toFixed(4);
  const missingPrice = lines.fields.length - priced.length;
  const weighed = known.filter(([, m]) => m.weightKg !== null);
  const estimatedWeightKg =
    weighed.length > 0
      ? weighed.reduce((a, [, m]) => a.plus(m.weightKg as string), new Decimal(0)).toFixed(4)
      : null;

  const money = (v: string | undefined) => (v && /^\d{1,14}(\.\d{1,4})?$/.test(v) ? v : '0');
  const ship = freeShipping || shipFeeOnReturnOnly ? '0' : money(shippingFee);
  const manual = previewManualDiscount(manualType, manualValue, subtotal);
  const gross = subtotal !== null ? new Decimal(subtotal).plus(ship).plus(money(surcharge)) : null;
  const total = gross !== null ? gross.minus(manual ?? '0') : null;
  const prepaid = new Decimal(money(prepaidAmount));
  const cod = total !== null ? Decimal.max(total.minus(prepaid), 0).toFixed(4) : null;
  const prepaidTooBig = total !== null && prepaid.greaterThan(total);

  /** Chọn sản phẩm từ ô tìm / máy quét: đã có trong giỏ (ĐVT cơ sở) thì +1, chưa có thì thêm dòng. */
  const addSku = useCallback(
    ({ skuId, baseUomId }: SkuQuickRow) => {
      const cur = form.getValues('lines');
      const idx = cur.findIndex((l) => l.skuId === skuId);
      if (idx >= 0) {
        const q = cur[idx]!.qty;
        const next = /^\d/.test(q) ? new Decimal(q).plus(1).toString() : '1';
        form.setValue(`lines.${idx}.qty`, next, { shouldDirty: true, shouldValidate: true });
      } else {
        // ĐVT cơ sở có sẵn từ ô tìm — dòng hợp lệ ngay, quét rồi F10 liền không bị chặn.
        lines.append({ ...EMPTY_LINE, skuId, uomId: baseUomId });
      }
    },
    [form, lines],
  );

  const onError = (err: unknown, values: CreateOrderValues) => {
    if (isApiError(err)) {
      // 409 thiếu tồn / 422 vượt trần CK: gắn lỗi vào đúng dòng theo skuId trong details.
      const skuId = (err.details as { skuId?: string } | undefined)?.skuId;
      const idx = skuId ? values.lines.findIndex((l) => l.skuId === skuId) : -1;
      if (idx >= 0) {
        const field = err.code === 'DISCOUNT_ABOVE_MAX' ? 'discountPercent' : 'qty';
        form.setError(`lines.${idx}.${field}`, { message: messageFor(err) });
        toast.error(messageFor(err));
        return;
      }
      const path = (err.details as { path?: string } | undefined)?.path;
      const mapped = path ? SERVER_PATHS[path] : undefined;
      if (err.code === 'VALIDATION' && mapped) {
        form.setError(mapped.field, { type: 'server', message: mapped.message });
        toast.error(mapped.message);
        return;
      }
    }
    applyServerErrors(form, err as ApiError, {
      knownFields: ['warehouseId', 'channel', 'shippingFee', 'lines'],
    });
    const root = form.formState.errors.root?.server?.message;
    if (root) toast.error(root);
  };

  const onSubmit = form.handleSubmit(
    (values) => {
      idemKey.current ??= newIdempotencyKey();
      create.mutate(
        { body: toCreateOrderBody(values), key: idemKey.current },
        {
          onSuccess: (r) => onCreated(r, afterCreate.current),
          onError: (err) => onError(err, values),
        },
      );
    },
    (errors) => {
      if (form.getValues('lines').length === 0) {
        toast.error('Giỏ hàng trống — thêm sản phẩm trước khi chốt đơn');
        searchRef.current?.focus();
      } else if (errors.lines) {
        toast.error('Giỏ hàng còn dòng chưa hợp lệ — xem các ô báo đỏ');
      } else {
        toast.error('Đơn còn ô chưa hợp lệ — xem các ô báo đỏ');
      }
    },
  );

  useImperativeHandle(ref, () => ({
    submit: (mode) => {
      afterCreate.current = mode;
      void onSubmit();
    },
    focusSearch: () => searchRef.current?.focus(),
  }));

  return (
    <Form {...form}>
      <form
        id="order-create"
        onSubmit={(e) => {
          afterCreate.current = 'open';
          void onSubmit(e);
        }}
        className={cn('flex flex-col gap-3 pb-24', DENSE)}
      >
        <div className="flex flex-wrap items-start gap-3">
          {/* ── Cột trái ── */}
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
            <Card
              title="Sản phẩm"
              actions={<HeaderSelects form={form} warehouseOptions={warehouseOptions} />}
            >
              <ProductSearch ref={searchRef} warehouseId={warehouseId} onPick={addSku} />
              <div className="overflow-x-auto rounded-md border">
                <div className="min-w-[680px]">
                  {lines.fields.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                      <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden />
                      <p className="text-sm text-muted-foreground">Chưa có sản phẩm trong giỏ</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => searchRef.current?.focus()}
                      >
                        Tìm sản phẩm (F9)
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          CART_GRID,
                          'hidden border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground sm:grid',
                        )}
                      >
                        <span>#</span>
                        <span>Sản phẩm</span>
                        <span className="text-center">SL</span>
                        <span className="text-right">Đơn giá</span>
                        <span className="text-right">CK %</span>
                        <span className="text-right">Thành tiền</span>
                        <span />
                      </div>
                      <div className="divide-y">
                        {lines.fields.map((f, i) => (
                          <CartLine
                            key={f.id}
                            fieldId={f.id}
                            form={form}
                            index={i}
                            customerId={customerId}
                            channel={channel}
                            onMetrics={onMetrics}
                            onRemove={() => lines.remove(i)}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
                        <span>
                          {lines.fields.length} dòng
                          {estimatedWeightKg
                            ? ` · KL ước tính ${new Decimal(estimatedWeightKg).toDecimalPlaces(2).toString()} kg`
                            : ''}
                          {missingPrice > 0 && customerId
                            ? ` · ${missingPrice} dòng chưa có giá`
                            : ''}
                        </span>
                        <span>
                          Tạm tính{' '}
                          <b className="ml-1 text-base tabular-nums text-foreground">
                            {subtotal !== null ? formatMoney(subtotal) : '—'}
                          </b>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {form.formState.errors.lines?.root?.message ||
              form.formState.errors.lines?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lines.root?.message ?? form.formState.errors.lines.message}
                </p>
              ) : null}
            </Card>

            <div className="flex flex-wrap items-start gap-3">
              <ValueCard
                form={form}
                subtotal={subtotal}
                gross={gross?.toFixed(4) ?? null}
                manual={manual}
                prepaid={prepaid.toFixed(4)}
                cod={cod}
              />
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
                <Card title="Thanh toán">
                  <FormField
                    control={form.control}
                    name="prepaidAmount"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <FormLabel className="font-normal">Tiền chuyển khoản</FormLabel>
                          <div className="w-full sm:w-56">
                            <FormControl>
                              <MoneyInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                aria-label="Tiền chuyển khoản"
                              />
                            </FormControl>
                          </div>
                        </div>
                        {prepaidTooBig ? (
                          <p className="text-right text-xs text-destructive">
                            Vượt tổng đơn — hệ thống sẽ từ chối khi chốt.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>
                <NotesCard form={form} files={files} onFilesChange={onFilesChange} />
              </div>
            </div>
          </div>

          {/* ── Cột phải ── */}
          <div className="flex min-w-0 max-w-full flex-[1_1_380px] flex-col gap-3 xl:max-w-[520px]">
            <InfoCard form={form} />
            <CustomerCard form={form} />
            <ReceiverCard form={form} />
            <ShippingCard form={form} estimatedWeightKg={estimatedWeightKg} codAmount={cod} />
          </div>
        </div>

        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-2.5 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              <Kbd>F6</Kbd> Đơn mới
            </span>
            <span>
              <Kbd>F9</Kbd> Quét mã
            </span>
            <span>
              <Kbd>F10</Kbd> Chốt đơn
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm text-muted-foreground">
              Tiền cần thu
              <b className="ml-2 text-lg tabular-nums text-success">
                {cod !== null ? formatMoney(cod) : '—'}
              </b>
            </span>
            <Button variant="ghost" asChild>
              <Link href="/crm/orders">Hủy bỏ</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => {
                afterCreate.current = 'next';
                void onSubmit();
              }}
            >
              Chốt &amp; tạo đơn mới
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang chốt…' : 'Chốt đơn (F10)'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
});

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-xs">{children}</kbd>;
}

/** Kênh bán · Nguồn đơn · Kho xuất — đầu card Sản phẩm. */
function HeaderSelects({
  form,
  warehouseOptions,
}: {
  form: UseFormReturn<CreateOrderValues>;
  warehouseOptions: { id: string; name: string }[];
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="channel"
        render={({ field }) => (
          <FormItem>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-label="Kênh bán" className="h-8 w-32">
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
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="source"
        render={({ field }) => (
          <FormItem>
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
            >
              <FormControl>
                <SelectTrigger aria-label="Nguồn đơn" className="h-8 w-44">
                  <SelectValue placeholder="Chọn nguồn đơn" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NONE}>Chọn nguồn đơn</SelectItem>
                {ORDER_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {orderSourceLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="warehouseId"
        render={({ field }) => (
          <FormItem>
            <Select
              value={field.value || DEFAULT_WAREHOUSE}
              onValueChange={(v) => field.onChange(v === DEFAULT_WAREHOUSE ? '' : v)}
            >
              <FormControl>
                <SelectTrigger aria-label="Kho xuất" className="h-8 w-56">
                  <div className="flex min-w-0 items-center gap-2">
                    <Warehouse className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      <SelectValue placeholder="Kho mặc định" />
                    </span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={DEFAULT_WAREHOUSE}>Kho mặc định của bạn</SelectItem>
                {warehouseOptions.map((w) => (
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
    </>
  );
}

/** Chọn giảm theo số tiền (₫) hay theo %. */
function DiscountTypeToggle({
  value,
  onChange,
}: {
  value: ManualDiscountType;
  onChange: (t: ManualDiscountType) => void;
}) {
  const options: { type: ManualDiscountType; label: string; title: string }[] = [
    { type: 'AMOUNT', label: '₫', title: 'Giảm theo số tiền' },
    { type: 'PERCENT', label: '%', title: 'Giảm theo phần trăm' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Kiểu giảm giá"
      className="flex h-9 shrink-0 rounded-md bg-muted p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.type}
          type="button"
          role="radio"
          aria-checked={value === o.type}
          title={o.title}
          onClick={() => onChange(o.type)}
          className={
            value === o.type
              ? 'w-8 rounded bg-card text-xs font-semibold text-primary shadow-sm'
              : 'w-8 rounded text-xs text-muted-foreground hover:text-foreground'
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SumRow({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'neg' | 'pos';
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={big ? 'text-base font-semibold' : 'text-sm'}>{label}</span>
      <b
        className={cn(
          'tabular-nums',
          big ? 'text-xl' : 'text-sm',
          tone === 'neg' && 'text-destructive',
          tone === 'pos' && 'text-success',
        )}
      >
        {value}
      </b>
    </div>
  );
}

function ValueCard({
  form,
  subtotal,
  gross,
  manual,
  prepaid,
  cod,
}: {
  form: UseFormReturn<CreateOrderValues>;
  subtotal: string | null;
  gross: string | null;
  manual: string | null;
  prepaid: string;
  cod: string | null;
}) {
  const [manualType, freeShipping, shipFeeOnReturnOnly, couponCode] = useWatch({
    control: form.control,
    name: ['manualDiscountType', 'freeShipping', 'shipFeeOnReturnOnly', 'couponCode'],
  });
  const [showCoupon, setShowCoupon] = useState(couponCode !== '');
  const manualTooBig =
    manual !== null && subtotal !== null && new Decimal(manual).greaterThan(subtotal);
  const noShipFee = freeShipping || shipFeeOnReturnOnly;
  const dash = (v: string | null) => (v !== null ? formatMoney(v) : '—');

  return (
    <Card
      className="min-w-0 flex-[1_1_320px]"
      title="Giá trị đơn hàng"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Tùy chọn giá trị đơn"
            >
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setShowCoupon((s) => !s)}>
              {showCoupon ? 'Ẩn mã khuyến mãi' : 'Nhập mã khuyến mãi'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3">
        {(
          [
            ['freeShipping', 'Miễn phí giao hàng'],
            ['shipFeeOnReturnOnly', 'Chỉ thu phí nếu hoàn'],
          ] as const
        ).map(([name, label]) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(c) => field.onChange(c === true)}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">{label}</FormLabel>
              </FormItem>
            )}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="pt-2 text-sm">Giảm giá</span>
        <div className="flex w-full flex-col items-end gap-1 sm:w-56">
          <div className="flex w-full gap-1">
            <DiscountTypeToggle
              value={manualType}
              onChange={(t) => {
                form.setValue('manualDiscountType', t);
                form.setValue('manualDiscountValue', '');
                form.clearErrors('manualDiscountValue');
              }}
            />
            <FormField
              control={form.control}
              name="manualDiscountValue"
              render={({ field }) => (
                <FormItem className="min-w-0 flex-1">
                  <FormLabel className="sr-only">
                    {manualType === 'PERCENT' ? 'Giảm giá (%)' : 'Giảm giá (số tiền)'}
                  </FormLabel>
                  <FormControl>
                    {manualType === 'PERCENT' ? (
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        className="text-right tabular-nums"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    ) : (
                      <MoneyInput value={field.value ?? ''} onChange={field.onChange} />
                    )}
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {form.formState.errors.manualDiscountValue ? (
            <p className="text-right text-xs text-destructive">
              {form.formState.errors.manualDiscountValue.message}
            </p>
          ) : manualTooBig ? (
            <p className="text-right text-xs text-destructive">
              Vượt tạm tính — hệ thống sẽ từ chối khi chốt.
            </p>
          ) : manual !== null && manualType === 'PERCENT' ? (
            <p className="text-xs tabular-nums text-muted-foreground">−{formatMoney(manual)}</p>
          ) : null}
        </div>
      </div>

      <FormField
        control={form.control}
        name="shippingFee"
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FormLabel className="font-normal">Phí vận chuyển</FormLabel>
              <div className="w-full sm:w-56">
                <FormControl>
                  <MoneyInput
                    value={noShipFee ? '' : (field.value ?? '')}
                    onChange={field.onChange}
                    disabled={noShipFee}
                    placeholder={noShipFee ? 'Khách không trả khi nhận' : '0'}
                  />
                </FormControl>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="surcharge"
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FormLabel className="font-normal">Phụ thu</FormLabel>
              <div className="w-full sm:w-56">
                <FormControl>
                  <MoneyInput value={field.value ?? ''} onChange={field.onChange} placeholder="0" />
                </FormControl>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {showCoupon ? (
        <FormField
          control={form.control}
          name="couponCode"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FormLabel className="font-normal">Mã khuyến mãi</FormLabel>
                <div className="w-full sm:w-56">
                  <FormControl>
                    <Input placeholder="Nhập mã" autoComplete="off" {...field} />
                  </FormControl>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      <div className="flex flex-col gap-2 border-t border-dashed pt-3">
        <SumRow label="Tổng số tiền" value={dash(gross)} />
        <SumRow
          label="Giảm giá"
          value={manual !== null ? `−${formatMoney(manual)}` : formatMoney('0')}
          tone="neg"
        />
        {!new Decimal(prepaid).isZero() ? (
          <SumRow label="Đã chuyển khoản" value={`−${formatMoney(prepaid)}`} tone="neg" />
        ) : null}
      </div>
      <div className="border-t border-dashed pt-3">
        <SumRow label="Tiền cần thu" value={dash(cod)} tone="pos" big />
      </div>
      <p className="text-xs text-muted-foreground">
        Giá xem trước theo bảng giá của khách; số cuối do hệ thống chốt (gồm khuyến mãi). Đơn vượt
        ngưỡng tự chuyển chờ duyệt.
      </p>
    </Card>
  );
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function NotesCard({
  form,
  files,
  onFilesChange,
}: {
  form: UseFormReturn<CreateOrderValues>;
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const [tab, setTab] = useState<'internal' | 'print'>('internal');
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const bad = picked.filter((f) => !ATTACHMENT_TYPES.includes(f.type));
    const big = picked.filter((f) => f.size > ATTACHMENT_MAX_BYTES);
    if (bad.length) toast.error('Chỉ nhận ảnh jpg / png / webp hoặc PDF');
    if (big.length) toast.error('Mỗi tệp tối đa 10MB');
    const ok = picked.filter(
      (f) => ATTACHMENT_TYPES.includes(f.type) && f.size <= ATTACHMENT_MAX_BYTES,
    );
    const next = [...files, ...ok].slice(0, ATTACHMENT_MAX_COUNT);
    if (files.length + ok.length > ATTACHMENT_MAX_COUNT) {
      toast.error(`Mỗi đơn tối đa ${ATTACHMENT_MAX_COUNT} tệp`);
    }
    onFilesChange(next);
  };

  return (
    <Card title="Ghi chú">
      <div
        role="tablist"
        aria-label="Loại ghi chú"
        className="grid grid-cols-2 rounded-md bg-muted p-0.5"
      >
        {(
          [
            ['internal', 'Nội bộ'],
            ['print', 'Để in (lên vận đơn)'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              'h-8 rounded text-sm',
              tab === v ? 'bg-card font-semibold text-primary shadow-sm' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <FormField
        key={tab}
        control={form.control}
        name={tab === 'internal' ? 'internalNote' : 'printNote'}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">
              {tab === 'internal' ? 'Ghi chú nội bộ' : 'Ghi chú in lên vận đơn'}
            </FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                placeholder={
                  tab === 'internal'
                    ? 'Ghi chú cho người trong công ty (kho, CSKH…)'
                    : 'In lên vận đơn cho shipper — vd: cho xem hàng, gọi trước khi giao'
                }
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div
            key={`${f.name}-${i}`}
            className="relative flex h-16 w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-md border bg-muted/30 p-1 text-center"
            title={`${f.name} · ${fileSize(f.size)}`}
          >
            {previews[i] ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ blob: cục bộ
              <img src={previews[i]!} alt={f.name} className="h-full w-full rounded object-cover" />
            ) : (
              <>
                <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                <span className="line-clamp-2 break-all text-xs leading-tight">{f.name}</span>
              </>
            )}
            <button
              type="button"
              aria-label={`Bỏ tệp ${f.name}`}
              onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded-full bg-card p-0.5 shadow"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ))}
        {files.length < ATTACHMENT_MAX_COUNT ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tải lên
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ATTACHMENT_TYPES.join(',')}
          multiple
          hidden
          aria-label="Chọn tệp đính kèm"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {files.length > 0 ? (
        <p className="text-xs text-muted-foreground">Tệp được tải lên ngay sau khi chốt đơn.</p>
      ) : null}
    </Card>
  );
}
