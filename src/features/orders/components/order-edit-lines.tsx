'use client';

import Decimal from 'decimal.js';
import { Lock } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { Form } from '@/components/data/form';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { SkuQuickRow } from '../api/use-order-create';
import type { ReplaceOrderLinesBody, SalesOrderDetail } from '../api/use-orders';
import { collapseComboLines } from '../combo-lines';
import { EMPTY_LINE, emptyOrderValues, type CreateOrderValues } from '../schema';
import { CART_GRID, CartLine, type LineMetrics } from './order-create/cart-line';
import { Card } from './order-create/order-side-cards';
import { ProductSearch } from './order-create/product-search';

type LinesForm = UseFormReturn<CreateOrderValues>;

/**
 * Dòng giỏ của màn Sửa đơn (2026-10-29): combo gộp về một dòng (SKU combo, số combo), ĐƠN GIÁ
 * đang có gửi kèm để server giữ giá (không định giá lại theo bảng giá hôm nay).
 */
function initialLines(order: SalesOrderDetail): CreateOrderValues['lines'] {
  return collapseComboLines(order.lines.filter((l) => !l.nonStock)).map((l) => ({
    ...EMPTY_LINE,
    skuId: l.skuId,
    uomId: l.uomId,
    qty: new Decimal(l.qty).toString(),
    unitPrice: new Decimal(l.unitPrice).toString(),
  }));
}

/**
 * Món gõ tay / ngoài hệ thống của đơn (dòng `nonStock` + `customItems` đơn Pancake cũ) — không vào
 * giỏ sửa: lưu giỏ là THAY toàn bộ dòng nên các món này bị bỏ (tab Cần sửa, 2026-11-02).
 */
export function customLeftovers(order: SalesOrderDetail): string[] {
  return [
    ...order.lines
      .filter((l) => l.nonStock)
      .map((l) => `${l.skuName} × ${new Decimal(l.qty).toString()}`),
    ...order.customItems.map((c) => `${c.name} × ${new Decimal(c.qty).toString()}`),
  ];
}

/** Form giỏ riêng của màn Sửa đơn — dùng lại CartLine của màn tạo đơn (cần CreateOrderValues). */
export function useOrderLinesForm(order: SalesOrderDetail): LinesForm {
  return useForm<CreateOrderValues>({
    defaultValues: {
      ...emptyOrderValues(order.warehouseId ?? ''),
      customerId: order.customer.id,
      channel: order.channel,
      lines: initialLines(order),
    },
  });
}

const same = (a: string, b: string) =>
  a === b || (a !== '' && b !== '' && /^\d/.test(a) && /^\d/.test(b) && new Decimal(a).eq(b));

/**
 * Body PUT /sales-orders/{id}/lines khi giỏ khác ban đầu; null = không đổi. ĐVT trống (dòng combo
 * trước khi tải SKU) không tính là đổi. Dòng SL sai → `invalid`.
 */
export function linesChange(
  order: SalesOrderDetail,
  current: CreateOrderValues['lines'],
): { body: ReplaceOrderLinesBody | null; invalid: boolean } {
  const before = initialLines(order);
  const invalid = current.some(
    (l) => !/^\d{1,12}(\.\d{1,6})?$/.test(l.qty) || new Decimal(l.qty).lte(0),
  );
  // Còn món gõ tay → lưu giỏ (kể cả giữ nguyên các dòng khác) là bỏ được các món đó.
  const changed =
    customLeftovers(order).length > 0 ||
    before.length !== current.length ||
    current.some((l, i) => {
      const b = before[i]!;
      return (
        l.skuId !== b.skuId ||
        (l.uomId !== '' && b.uomId !== '' && l.uomId !== b.uomId) ||
        !same(l.qty, b.qty) ||
        !same(l.unitPrice ?? '', b.unitPrice ?? '')
      );
    });
  if (!changed || current.length === 0)
    return { body: null, invalid: invalid || current.length === 0 };
  return {
    invalid,
    body: {
      lines: current.map((l) => ({
        skuId: l.skuId,
        ...(l.uomId ? { uomId: l.uomId } : {}),
        qty: l.qty,
        ...(l.unitPrice ? { unitPrice: l.unitPrice } : {}),
      })),
    },
  };
}

/**
 * Thẻ Sản phẩm sửa được: tìm thêm sản phẩm / combo, đổi SL, đơn giá, bỏ dòng — như giỏ màn tạo
 * đơn. `lockedReason` khác null → chỉ đọc kèm lý do (kho đã lấy hàng, có KM…). Đơn Pancake sửa
 * được (2026-11-02): server đẩy dòng mới lên Pancake; món gõ tay hiện thành ghi chú, lưu là bỏ.
 */
export function OrderEditLines({
  form,
  order,
  lockedReason,
  dirty,
  readOnly,
}: {
  form: LinesForm;
  order: SalesOrderDetail;
  lockedReason: string | null;
  dirty: boolean;
  /** Danh sách chỉ đọc (khi khóa) — màn cha vẽ bảng cũ. */
  readOnly: React.ReactNode;
}) {
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const searchRef = useRef<HTMLInputElement>(null);
  const warehouseId = order.warehouseId ?? '';
  const [metrics, setMetrics] = useState<Record<string, LineMetrics>>({});
  const onMetrics = useCallback((fieldId: string, m: LineMetrics) => {
    setMetrics((prev) =>
      prev[fieldId]?.total === m.total && prev[fieldId]?.weightKg === m.weightKg
        ? prev
        : { ...prev, [fieldId]: m },
    );
  }, []);
  useWatch({ control: form.control, name: 'lines' });
  const leftovers = customLeftovers(order);

  const addSku = useCallback(
    ({ skuId, baseUomId }: SkuQuickRow) => {
      const cur = form.getValues('lines');
      const idx = cur.findIndex((l) => l.skuId === skuId);
      if (idx >= 0) {
        const q = cur[idx]!.qty;
        const next = /^\d/.test(q) ? new Decimal(q).plus(1).toString() : '1';
        form.setValue(`lines.${idx}.qty`, next, { shouldDirty: true });
      } else {
        lines.append({ ...EMPTY_LINE, skuId, uomId: baseUomId });
      }
    },
    [form, lines],
  );

  const subtotal = useMemo(() => {
    const ids = new Set(lines.fields.map((f) => f.id));
    const priced = Object.entries(metrics).filter(([k, m]) => ids.has(k) && m.total !== null);
    if (priced.length !== lines.fields.length) return null;
    return priced.reduce((a, [, m]) => a.plus(m.total as string), new Decimal(0)).toFixed(4);
  }, [metrics, lines.fields]);

  if (lockedReason) {
    return (
      <Card
        title="Sản phẩm"
        actions={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {lockedReason}
          </span>
        }
      >
        {readOnly}
      </Card>
    );
  }

  return (
    <Card
      title="Sản phẩm"
      actions={<ProductSearch ref={searchRef} warehouseId={warehouseId} onPick={addSku} />}
    >
      <p className="text-xs text-muted-foreground">
        Sửa được tới khi kho bắt đầu lấy hàng. Lưu xong hệ thống giữ hàng lại theo dòng mới và lập
        lại việc lấy hàng; đơn giá dòng cũ giữ nguyên, dòng mới theo bảng giá.
        {order.pancakeOrderId
          ? ' Đơn Pancake: lưu là cập nhật luôn sản phẩm trên đơn Pancake.'
          : ''}
      </p>
      {leftovers.length > 0 ? (
        <p role="note" className="rounded-md bg-warning-weak px-3 py-2 text-xs text-warning">
          Món ngoài hệ thống: <b>{leftovers.join(', ')}</b>. Tìm sản phẩm tương ứng ở ô phía trên —
          lưu sẽ bỏ các món này khỏi đơn.
        </p>
      ) : null}
      <Form {...form}>
        <div className="overflow-x-auto rounded-md border">
          <div className="min-w-[680px]">
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
            {lines.fields.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-destructive">
                Đơn phải có ít nhất một sản phẩm — tìm và thêm sản phẩm ở ô phía trên.
              </p>
            ) : (
              <div className={cn('divide-y', dirty && 'bg-warning-weak')}>
                {lines.fields.map((f, i) => (
                  <CartLine
                    key={f.id}
                    fieldId={f.id}
                    form={form}
                    index={i}
                    customerId={order.customer.id}
                    channel={order.channel}
                    warehouseId={warehouseId}
                    onMetrics={onMetrics}
                    onRemove={() => lines.remove(i)}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
              <span>{lines.fields.length} dòng</span>
              <span>
                Tạm tính{' '}
                <b className="ml-1 text-base tabular-nums text-foreground">
                  {subtotal !== null ? formatMoney(subtotal) : '—'}
                </b>
                {dirty && subtotal !== null && !new Decimal(subtotal).eq(order.subtotal) ? (
                  <span className="ml-1 text-xs">(trước {formatMoney(order.subtotal)})</span>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </Form>
    </Card>
  );
}
