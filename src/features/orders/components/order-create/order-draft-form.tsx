'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Decimal from 'decimal.js';
import { FileText, Inbox, Plus, Warehouse, X } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type BaseSyntheticEvent,
  type ReactNode,
} from 'react';
import { useFieldArray, useForm, useWatch, type Path, type UseFormReturn } from 'react-hook-form';
import {
  applyServerErrors,
  DatePicker,
  EntityPicker,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
  type EntitySearchResult,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
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
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { formatMoney } from '@/lib/format';
import { useAbility } from '@/lib/permission';
import { useWarehouse } from '@/lib/warehouse';
import { useSameDayOrders, type SkuQuickRow } from '../../api/use-order-create';
import {
  useCareTeamOptions,
  useConfirmOrder,
  useCreateOrder,
  useFacebookPageSearch,
  usePancakeShops,
  usePosShopSearch,
} from '../../api/use-orders';
import {
  createOrderSchema,
  previewManualDiscount,
  toCreateOrderBody,
  type CreateOrderValues,
} from '../../schema';
import { CART_GRID, CartLine, type LineMetrics } from './cart-line';
import { CareCard } from './care-card';
import {
  Card,
  CustomerCard,
  InfoCard,
  ReceiverCard,
  ShippingCard,
  StaffField,
  TagPicker,
} from './order-side-cards';
import { addCartSku, GiftLines } from './gift-lines';
import { ProductSearch } from './product-search';
import { COD_LOW_RATIO, formatRatioPct, lowCodRatio } from './cod-check';
import { SameDayDialog } from './same-day-dialog';

const DEFAULT_WAREHOUSE = '__default__';
/**
 * Mật độ riêng màn tạo đơn: cả form nằm gọn một màn hình không phải cuộn. Ô nhập / ô chọn / nút mở
 * lịch cao 32px; dòng báo lỗi dưới ô chỉ chiếm chỗ khi có lỗi (trống thì ẩn).
 */
export const DENSE = cn(
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
/**
 * Nút đã bấm (2026-11-02): `draft` = "Lưu nháp" → đơn nằm Đơn mới (DRAFT); `confirm` = "Chốt đơn"
 * (F10) → tạo rồi xác nhận luôn (POST /:id/confirm) → Đã xác nhận.
 */
export type AfterCreate = 'draft' | 'confirm';

/** Lỗi 422 của API có `details.path` → ô tương ứng trên form + câu tiếng Việt (luật 6). */
const SERVER_PATHS: Record<string, { field: Path<CreateOrderValues>; message: string }> = {
  'customer.phone': { field: 'customerPhone', message: 'Số điện thoại khách không hợp lệ' },
  customerId: { field: 'customerName', message: 'Chọn khách hoặc nhập tên + SĐT khách' },
  'customer.birthday': { field: 'customerBirthday', message: 'Ngày sinh không hợp lệ' },
  'address.phone': { field: 'recipientPhone', message: 'Số điện thoại người nhận không hợp lệ' },
  addressId: { field: 'addressId', message: 'Địa chỉ không thuộc khách hàng này' },
  prepaidAmount: { field: 'prepaidAmount', message: 'Tiền chuyển khoản vượt tổng đơn' },
  surcharge: { field: 'surcharge', message: 'Phụ thu không hợp lệ' },
  orderDate: { field: 'orderDate', message: 'Ngày tạo đơn không được ở tương lai' },
  ownerId: { field: 'ownerId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  packerId: { field: 'packerId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  careStaffId: { field: 'careStaffId', message: 'Nhân viên không tồn tại hoặc đã nghỉ' },
  marketerId: { field: 'marketerId', message: 'Chỉ chọn nhân viên sale đang làm việc' },
  tagIds: { field: 'tagIds', message: 'Thẻ đã bị xóa — bỏ thẻ rồi chốt lại' },
  purposeTagIds: {
    field: 'purposeTagIds',
    message: 'Mục đích sử dụng đã bị xóa hoặc gộp — bỏ chọn rồi chốt lại',
  },
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
  const confirmOrder = useConfirmOrder();
  const { options: warehouseOptions } = useWarehouse();
  const searchRef = useRef<HTMLInputElement>(null);
  // Idempotency-Key sinh lúc bấm, GIỮ NGUYÊN khi retry lỗi mạng/5xx; đổi khi người dùng sửa form.
  const idemKey = useRef<string | null>(null);
  const afterCreate = useRef<AfterCreate>('confirm');

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
      prev[fieldId]?.total === m.total &&
      prev[fieldId]?.listTotal === m.listTotal &&
      prev[fieldId]?.weightKg === m.weightKg &&
      prev[fieldId]?.sellBlocked === m.sellBlocked
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
  // Dòng có sản phẩm "Chỉ bán từ kho" khác Kho xuất (2026-11-05) — chặn lưu / chốt.
  const sellBlockedCount = known.filter(([, m]) => m.sellBlocked).length;
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
  // Σ(giá niêm yết × SL) — chỉ tính khi MỌI dòng đã có giá, thiếu một dòng thì chưa kiểm COD.
  const listed = known.filter(([, m]) => m.listTotal != null);
  const goods =
    lines.fields.length > 0 && listed.length === lines.fields.length
      ? listed.reduce((a, [, m]) => a.plus(m.listTotal as string), new Decimal(0)).toFixed(4)
      : null;
  const codRatio = lowCodRatio(cod, goods);

  /**
   * Chọn sản phẩm từ ô tìm / máy quét: đã có trong giỏ (cùng loại bán / khuyến mãi) thì +1, chưa có
   * thì thêm dòng. ĐVT cơ sở có sẵn từ ô tìm — dòng hợp lệ ngay, quét rồi F10 liền không bị chặn.
   */
  const addSku = useCallback(
    (row: SkuQuickRow) => addCartSku(form, lines.append, row, false),
    [form, lines.append],
  );
  const addGift = useCallback(
    (row: SkuQuickRow) => addCartSku(form, lines.append, row, true),
    [form, lines.append],
  );
  const saleFields = lines.fields.flatMap((f, index) => (f.isGift ? [] : [{ id: f.id, index }]));
  const giftFields = lines.fields.flatMap((f, index) => (f.isGift ? [{ id: f.id, index }] : []));

  const onError = (err: unknown, values: CreateOrderValues) => {
    if (isApiError(err)) {
      // 409 thiếu tồn / 422 vượt trần CK: gắn lỗi vào đúng dòng theo skuId trong details.
      const skuId = (err.details as { skuId?: string } | undefined)?.skuId;
      const idx = skuId ? values.lines.findIndex((l) => l.skuId === skuId) : -1;
      if (idx >= 0) {
        const field = err.code === 'DISCOUNT_ABOVE_MAX' ? 'unitPrice' : 'qty';
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

  // Đơn trùng trong ngày (CSKH-5): cùng SĐT đã có đơn chưa hủy hôm nay → hỏi lại trước khi chốt.
  // Cảnh báo, không chặn — "Vẫn tạo đơn" gửi đúng đơn đang chờ. Đã đồng ý cho SĐT nào thì lần bấm
  // sau (lỗi mạng, sửa giỏ) không hỏi lại.
  const customerPhone = useWatch({ control: form.control, name: 'customerPhone' });
  const sameDay = useSameDayOrders(customerPhone);
  const ability = useAbility();
  const canSetOrderDate = ability.can('set_order_date', 'SalesOrder');
  const canChooseCarrier = ability.can('send_carrier', 'SalesOrder');
  const [pendingDup, setPendingDup] = useState<CreateOrderValues | null>(null);
  const acceptedDupPhone = useRef<string | null>(null);

  const send = (values: CreateOrderValues) => {
    idemKey.current ??= newIdempotencyKey();
    // Không có quyền chọn ngày (2026-11-04) → không gửi ngày (nháp cũ có thể còn giá trị).
    // Không có quyền chọn hãng → không gửi ĐVVC (nháp nhân bản cũ còn hãng đơn gốc → 403, 2026-11-09).
    const body = toCreateOrderBody({
      ...values,
      ...(canSetOrderDate ? {} : { orderDate: '' }),
      ...(canChooseCarrier ? {} : { carrierId: '', carrierAccountId: '' }),
    });
    create.mutate(
      { body, key: idemKey.current },
      {
        onSuccess: (r) => {
          setPendingDup(null);
          const mode = afterCreate.current;
          if (mode !== 'confirm' || r.status !== 'DRAFT') {
            onCreated(r, mode);
            return;
          }
          // Chốt đơn = tạo (Đơn mới) rồi xác nhận ngay. Xác nhận hỏng thì đơn VẪN đã lưu ở Đơn mới —
          // báo rõ, không tạo lại (idempotency key đã dùng); màn mở đơn để xác nhận lại.
          confirmOrder.mutate(r.orderId, {
            onSuccess: (c) => onCreated({ ...r, status: c.status }, mode),
            onError: (err) => {
              toast.error(`Đơn ${r.docNumber} đã lưu ở Đơn mới nhưng chưa xác nhận`, {
                description: messageFor(err),
              });
              onCreated(r, mode);
            },
          });
        },
        onError: (err) => {
          setPendingDup(null);
          onError(err, values);
        },
      },
    );
  };

  // COD thấp (2026-11-06, thay job cron cod-alert): COD < 30% tổng giá niêm yết → hỏi lại trước
  // khi lưu. Cảnh báo, không chặn. Đã đồng ý cho cặp (COD, tổng niêm yết) nào thì không hỏi lại.
  const [pendingCod, setPendingCod] = useState<CreateOrderValues | null>(null);
  const acceptedCod = useRef<string | null>(null);
  const codSig = codRatio && cod !== null && goods !== null ? `${cod}|${goods}` : null;

  const afterCodCheck = (values: CreateOrderValues) => {
    const dup = sameDay.data;
    if (dup && dup.total > 0 && acceptedDupPhone.current !== values.customerPhone) {
      setPendingDup(values);
      return;
    }
    send(values);
  };

  const submitForm = form.handleSubmit(
    (values) => {
      if (codSig && acceptedCod.current !== codSig) {
        setPendingCod(values);
        return;
      }
      afterCodCheck(values);
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
  /**
   * Chặn TRƯỚC kiểm tra form: dòng có sản phẩm "Chỉ bán từ kho" khác Kho xuất (2026-11-05) — lưu
   * nháp cũng không cho, vì server từ chối mọi đơn lệch kho bán.
   */
  const onSubmit = (e?: BaseSyntheticEvent) => {
    if (sellBlockedCount > 0) {
      e?.preventDefault();
      toast.error(
        `${sellBlockedCount} sản phẩm không bán từ kho xuất đang chọn — đổi Kho xuất hoặc bỏ dòng báo đỏ`,
      );
      return Promise.resolve();
    }
    return submitForm(e);
  };

  useImperativeHandle(ref, () => ({
    submit: (mode) => {
      afterCreate.current = mode;
      void onSubmit();
    },
    focusSearch: () => searchRef.current?.focus(),
  }));

  return (
    <Form {...form}>
      {pendingCod && codRatio && cod !== null && goods !== null ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setPendingCod(null))}
          title={`COD chỉ bằng ${formatRatioPct(codRatio)} tổng giá niêm yết`}
          description={
            `Thu hộ ${formatMoney(cod)} / hàng theo giá niêm yết ${formatMoney(goods)}` +
            (prepaid.greaterThan(0)
              ? ` (đã chuyển khoản ${formatMoney(prepaid.toFixed(4))})`
              : '') +
            `. Dưới ${formatRatioPct(COD_LOW_RATIO)} là chiết khấu bất thường — kiểm tra lại đơn giá, chiết khấu, đơn vị tính trước khi lưu.`
          }
          confirmLabel="Vẫn lưu đơn"
          destructive={false}
          onConfirm={() => {
            const values = pendingCod;
            acceptedCod.current = codSig;
            setPendingCod(null);
            afterCodCheck(values);
          }}
        />
      ) : null}
      {pendingDup && sameDay.data ? (
        <SameDayDialog
          data={sameDay.data}
          phone={pendingDup.customerPhone}
          customerName={pendingDup.customerName}
          pending={create.isPending}
          onCancel={() => setPendingDup(null)}
          onConfirm={() => {
            acceptedDupPhone.current = pendingDup.customerPhone;
            send(pendingDup);
          }}
        />
      ) : null}
      <form
        id="order-create"
        onSubmit={(e) => {
          afterCreate.current = 'confirm';
          void onSubmit(e);
        }}
        className={cn('flex flex-col gap-3', DENSE)}
      >
        <div className="flex flex-wrap items-start gap-3">
          {/* ── Cột trái ── */}
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
            <Card title="Thông tin đơn" className="py-2.5">
              <HeaderSelects form={form} warehouseOptions={warehouseOptions} />
            </Card>
            <Card
              title="Sản phẩm"
              actions={<ProductSearch ref={searchRef} warehouseId={warehouseId} onPick={addSku} />}
            >
              <div className="overflow-x-auto rounded-md border">
                <div className="min-w-[680px]">
                  {saleFields.length === 0 ? (
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
                        <span className="text-right">Thành tiền</span>
                        <span />
                      </div>
                      <div className="divide-y">
                        {saleFields.map((f, i) => (
                          <CartLine
                            key={f.id}
                            fieldId={f.id}
                            form={form}
                            index={f.index}
                            no={i + 1}
                            customerId={customerId}
                            channel={channel}
                            warehouseId={warehouseId}
                            onMetrics={onMetrics}
                            onRemove={() => lines.remove(f.index)}
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
              <GiftLines
                form={form}
                fields={giftFields}
                customerId={customerId}
                channel={channel}
                warehouseId={warehouseId}
                onMetrics={onMetrics}
                onRemove={(i) => lines.remove(i)}
                onPick={addGift}
              />
              {form.formState.errors.lines?.root?.message ||
              form.formState.errors.lines?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lines.root?.message ?? form.formState.errors.lines.message}
                </p>
              ) : null}
            </Card>

            <NotesCard form={form} files={files} onFilesChange={onFilesChange} />
          </div>

          {/* ── Cột phải ── */}
          <div className="flex min-w-0 max-w-full flex-[1_1_380px] flex-col gap-3 xl:max-w-md">
            <CustomerCard form={form} />
            <ReceiverCard form={form} />
            <CareCard form={form} />
            <ShippingCard form={form} estimatedWeightKg={estimatedWeightKg} codAmount={cod} />
            <InfoCard form={form} />
            {/* Khối chốt đơn dính đáy màn khi cuộn (thay thanh dưới cùng cũ — redesign 2026-10-22,
                design system Form chứng từ: tổng + nút chính ở cột phải). */}
            <section
              aria-label="Chốt đơn"
              className="sticky bottom-3 z-20 flex flex-col gap-1.5 rounded-lg border border-input-soft bg-card p-3 text-sm shadow-popover"
            >
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính</span>
                <span className="tabular-nums">
                  {subtotal !== null ? formatMoney(subtotal, { unit: '' }) : '—'}
                </span>
              </div>
              <PayRow label="Phí ship thu khách">
                <FormField
                  control={form.control}
                  name="shippingFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MoneyInput
                          value={freeShipping || shipFeeOnReturnOnly ? '' : (field.value ?? '')}
                          onChange={field.onChange}
                          disabled={freeShipping || shipFeeOnReturnOnly}
                          // Ô tích Miễn phí giao hàng / Chỉ thu phí nếu hoàn đã ẩn (user 2026-10-22);
                          // cờ vẫn đi theo đơn nhân bản nên nói rõ vì sao ô bị khóa.
                          placeholder={
                            freeShipping ? 'Miễn phí' : shipFeeOnReturnOnly ? 'Thu khi hoàn' : '0'
                          }
                          aria-label="Phí ship thu khách"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </PayRow>
              <PayRow label="Đã chuyển khoản">
                <FormField
                  control={form.control}
                  name="prepaidAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MoneyInput
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="0"
                          aria-label="Tiền chuyển khoản"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </PayRow>
              {prepaidTooBig || form.formState.errors.prepaidAmount ? (
                <p className="text-right text-xs text-destructive">
                  {form.formState.errors.prepaidAmount?.message ??
                    'Vượt tổng đơn — hệ thống sẽ từ chối khi chốt.'}
                </p>
              ) : null}
              <div className="mt-0.5 flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">Thu hộ (COD)</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">
                  {cod !== null ? formatMoney(cod) : '—'}
                </span>
              </div>
              {codRatio ? (
                <p className="text-right text-xs text-warning">
                  COD chỉ bằng {formatRatioPct(codRatio)} tổng giá niêm yết
                  {goods !== null ? ` (${formatMoney(goods)})` : ''} — kiểm tra chiết khấu.
                </p>
              ) : null}
              <div className="mt-1.5 flex gap-2">
                {/* Lưu nháp → Đơn mới (chưa giữ hàng); Chốt đơn → Đã xác nhận (2026-11-02). */}
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  shortcut="F8"
                  disabled={create.isPending || confirmOrder.isPending}
                  onClick={() => {
                    afterCreate.current = 'draft';
                    void onSubmit();
                  }}
                >
                  Lưu nháp
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  shortcut="F10"
                  loading={create.isPending || confirmOrder.isPending}
                  loadingText="Đang chốt…"
                >
                  Chốt đơn
                </Button>
              </div>
            </section>
          </div>
        </div>
      </form>
    </Form>
  );
});

/** Một hàng "nhãn ← → ô tiền" của khối Chốt đơn. */
function PayRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="w-32 [&_input]:h-7">{children}</div>
    </div>
  );
}

/** Nhãn `caption` trên một ô của dải "Thông tin đơn". */
/** Giá trị "Phòng gốc của bạn" của ô Phòng ghi doanh thu (Radix Select không nhận value rỗng). */
const HOME_CARE_TEAM = '__home__';

function HeaderField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Hook tìm page cho EntityPicker theo POS đang chọn — một hàm cố định cho mỗi POS (EntityPicker gọi
 * `useSearch` như hook, đổi hàm giữa các lần render là đổi hook).
 */
const pageSearchByPos = new Map<string, (q: string) => EntitySearchResult>();
function pageSearchFor(posShopId: string): (q: string) => EntitySearchResult {
  let fn = pageSearchByPos.get(posShopId);
  if (!fn) {
    fn = function usePageSearch(q: string) {
      return useFacebookPageSearch(q, posShopId);
    };
    pageSearchByPos.set(posShopId, fn);
  }
  return fn;
}

/**
 * Dải "Thông tin đơn" đầu màn (redesign 2026-10-22): Marketer (2026-11-11) · POS · Page · Kho xuất · NV xử lý ·
 * Thẻ trên một hàng, nhãn trên ô. POS và Page tách khỏi Nguồn (2026-10-26, mockup
 * 3r3H9T9rT1URgjzyQuuUwV màn 3): ba ô độc lập, đều không bắt buộc.
 */
function HeaderSelects({
  form,
  warehouseOptions,
}: {
  form: UseFormReturn<CreateOrderValues>;
  warehouseOptions: { id: string; name: string }[];
}) {
  const posShopId = useWatch({ control: form.control, name: 'posShopId' }) ?? '';
  // Ô Page: page của POS đang chọn lên trước.
  const usePageSearch = pageSearchFor(posShopId);
  // POS tự điền từ page (không qua ô chọn) vẫn hiện tên, không hiện mã trần.
  const shops = usePancakeShops();
  const posLabel = shops.data?.find((s) => s.shopId === posShopId)?.shopName ?? undefined;
  // Leader kiêm nhiệm (2026-10-29): thuộc từ 2 phòng CSKH → chọn phòng ghi doanh thu; mặc định
  // (để trống) = phòng gốc. Một phòng / không phải CSKH → ẩn ô.
  const careTeams = useCareTeamOptions();
  const myCareTeams = (careTeams.data ?? []).filter((t) => t.mine);
  const canSetOrderDate = useAbility().can('set_order_date', 'SalesOrder');
  return (
    // Kênh + Nguồn đơn ẩn khỏi màn tạo đơn (2026-11-07, user chốt) — gửi mặc định (Trực tiếp /
    // trống) theo giá trị sẵn của form; màn chi tiết / sửa đơn vẫn hiện để xem.
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
      {/* Marketer (2026-11-11, user chốt): nhân viên sale được gán đơn — thống kê doanh số theo sale
          (`marketerId`), độc lập với NV xử lý. Chỉ liệt kê nhân viên sale. */}
      <HeaderField label="Marketer">
        <StaffField
          form={form}
          name="marketerId"
          label="Marketer"
          placeholder="Chọn nhân viên sale"
          bare
        />
      </HeaderField>
      <HeaderField label="POS">
        <FormField
          control={form.control}
          name="posShopId"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <EntityPicker
                  value={field.value ?? ''}
                  onChange={(id) => field.onChange(id)}
                  useSearch={usePosShopSearch}
                  selectedLabel={posLabel}
                  placeholder="Không chọn POS"
                  searchPlaceholder="Tìm POS theo tên, mã…"
                  emptyText="Không có POS đã liên kết"
                  clearable
                  aria-label="POS"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </HeaderField>
      <HeaderField label="Page">
        <FormField
          control={form.control}
          name="facebookPageId"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <EntityPicker
                  value={field.value ?? ''}
                  onChange={(id, option) => {
                    field.onChange(id);
                    // Page chỉ thuộc một POS và ô POS đang trống → tự điền POS (bỏ được bằng ×).
                    const shops = option?.meta?.shopIds?.split(',').filter(Boolean) ?? [];
                    if (id && !form.getValues('posShopId') && shops.length === 1) {
                      form.setValue('posShopId', shops[0], { shouldDirty: true });
                    }
                  }}
                  useSearch={usePageSearch}
                  placeholder="Không chọn page"
                  searchPlaceholder="Tìm page…"
                  emptyText="Không có page khớp"
                  clearable
                  aria-label="Page Facebook"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </HeaderField>
      <HeaderField label="Kho xuất">
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
                  <SelectTrigger aria-label="Kho xuất">
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
      </HeaderField>
      {myCareTeams.length > 1 ? (
        <HeaderField label="Ghi doanh thu">
          <FormField
            control={form.control}
            name="careTeamId"
            render={({ field }) => (
              <FormItem>
                <Select
                  value={field.value || HOME_CARE_TEAM}
                  onValueChange={(v) => field.onChange(v === HOME_CARE_TEAM ? '' : v)}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Phòng ghi doanh thu">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={HOME_CARE_TEAM}>Phòng gốc của bạn</SelectItem>
                    {myCareTeams.map((t) => (
                      <SelectItem key={t.teamId} value={t.teamId}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </HeaderField>
      ) : null}
      {/* Ngày tạo đơn (2026-11-03): doanh số tính theo ngày này. Trống = hôm nay; chỉ chọn lùi.
          Chỉ người có quyền "Sửa ngày tạo đơn" (`sales_order.set_order_date`, mặc định Admin từ
          2026-11-07) chọn được — người khác luôn hôm nay (ô khóa). */}
      <HeaderField label="Ngày tạo đơn">
        <FormField
          control={form.control}
          name="orderDate"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DatePicker
                  value={canSetOrderDate ? field.value : ''}
                  onChange={field.onChange}
                  placeholder="Hôm nay"
                  toDate={new Date()}
                  disabled={!canSetOrderDate}
                  aria-label="Ngày tạo đơn"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </HeaderField>
      <HeaderField label="NV xử lý">
        <StaffField
          form={form}
          name="ownerId"
          label="NV xử lý"
          placeholder="Tôi (người tạo)"
          bare
        />
      </HeaderField>
      <HeaderField label="Thẻ">
        <TagPicker form={form} />
      </HeaderField>
    </div>
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
    <Card title="Ghi chú &amp; đính kèm">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {(
          [
            [
              'internalNote',
              'Nội bộ (kho, CSKH)',
              'Ghi chú nội bộ',
              'Ghi chú cho người trong công ty',
            ],
            [
              'printNote',
              'In lên vận đơn',
              'Ghi chú in lên vận đơn',
              'Cho shipper — vd: cho xem hàng, gọi trước khi giao',
            ],
          ] as const
        ).map(([name, label, aria, placeholder]) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground">
                  {label}
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} aria-label={aria} placeholder={placeholder} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => inputRef.current?.click()}
          >
            <Plus aria-hidden />
            Tải tệp lên
          </Button>
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
