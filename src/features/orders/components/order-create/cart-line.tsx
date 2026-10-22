'use client';

import Decimal from 'decimal.js';
import { Boxes, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  MoneyInput,
} from '@/components/data/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney, formatQuantity } from '@/lib/format';
import { useLinePrice, useSkuAvailability, useSkuDetail } from '../../api/use-line-entry';
import type { CreateOrderValues } from '../../schema';

const QTY_RE = /^\d{1,12}(\.\d{1,6})?$/;

export interface LineMetrics {
  /** Thành tiền xem trước, Decimal(18,4) chuỗi; null = chưa có giá. */
  total: string | null;
  /** Cân nặng dòng (kg) = SL cơ sở × cân nặng SKU; null = SKU chưa khai cân nặng. */
  weightKg: string | null;
}

/** Cột của giỏ hàng — header ở order-draft-form dùng chung để thẳng hàng. */
export const CART_GRID =
  'grid items-start gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[24px_minmax(0,1fr)_128px_136px_136px_32px]';

/**
 * Một dòng giỏ hàng: sản phẩm (mã · ĐVT · khả dụng) → SL −/+ → đơn giá → thành tiền. Báo thành
 * tiền + cân nặng lên form cha. Đơn giá mặc định = giá niêm yết XEM TRƯỚC qua GET /prices/resolve
 * (chưa chọn khách → giá bán trên sản phẩm); sale sửa được đơn giá, hoặc gõ thành tiền → đơn giá =
 * thành tiền ÷ SL (2026-10-21). Ô CK% đã bỏ khỏi màn. Giá cuối do POST /sales-orders snapshot.
 */
export function CartLine({
  fieldId,
  form,
  index,
  customerId,
  channel,
  onMetrics,
  onRemove,
}: {
  fieldId: string;
  form: UseFormReturn<CreateOrderValues>;
  index: number;
  customerId: string;
  channel: CreateOrderValues['channel'];
  onMetrics: (fieldId: string, m: LineMetrics) => void;
  onRemove: () => void;
}) {
  const skuId = useWatch({ control: form.control, name: `lines.${index}.skuId` });
  const uomId = useWatch({ control: form.control, name: `lines.${index}.uomId` });
  const qty = useWatch({ control: form.control, name: `lines.${index}.qty` });
  const manualPrice = useWatch({ control: form.control, name: `lines.${index}.unitPrice` }) ?? '';
  const sku = useSkuDetail(skuId);
  const combo = sku.data?.isCombo ? (sku.data.combo ?? null) : null;
  // Combo không có tồn riêng — khả dụng lấy từ thành phần (GET /skus/{id}.combo), không hỏi /stock.
  const stock = useSkuAvailability(combo ? '' : (sku.data?.code ?? ''));
  const qtyValid = QTY_RE.test(qty ?? '');
  const price = useLinePrice({ skuId, uomId, qty: qtyValid ? qty : '', customerId, channel });

  // SKU vừa chọn: mặc định ĐVT cơ sở; ĐVT cũ không thuộc SKU thì thay.
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
  const qtyBase = qtyValid ? (factor ? new Decimal(qty).mul(factor) : new Decimal(qty)) : null;
  const low = combo
    ? qtyValid && new Decimal(combo.available).lessThan(qty)
    : stock.data && qtyBase
      ? new Decimal(stock.data.available).lessThan(qtyBase)
      : false;

  // Đơn giá hiệu lực = giá sửa tay, không thì giá niêm yết; thành tiền = đơn giá × SL (làm tròn 4
  // lẻ như server).
  const listPrice = price.data?.listPrice ?? null;
  const unitPrice = manualPrice !== '' ? manualPrice : listPrice;
  const lineTotal =
    unitPrice !== null && qtyValid
      ? new Decimal(unitPrice).mul(qty).toDecimalPlaces(4).toFixed(4)
      : null;
  const weightKg = qtyBase && sku.data?.weightKg ? qtyBase.mul(sku.data.weightKg).toFixed(4) : null;
  useEffect(() => {
    onMetrics(fieldId, { total: lineTotal, weightKg });
  }, [fieldId, lineTotal, weightKg, onMetrics]);

  // Giá sửa tay dưới trần CK của bảng giá → server đưa đơn vào duyệt; báo ngay lúc gõ.
  const floor =
    listPrice !== null
      ? new Decimal(listPrice).mul(new Decimal(1).minus(price.data?.maxDiscount ?? 0))
      : null;
  const belowFloor =
    manualPrice !== '' && floor !== null ? new Decimal(manualPrice).lessThan(floor) : false;

  // Chưa chọn khách: giữ giá sản phẩm đang hiện để chốt đúng giá sale thấy (schema.linePriceBody).
  useEffect(() => {
    if (form.getValues(`lines.${index}.previewPrice`) !== (listPrice ?? '')) {
      form.setValue(`lines.${index}.previewPrice`, listPrice ?? '');
    }
  }, [listPrice, form, index]);

  /** Gõ thành tiền → đơn giá = thành tiền ÷ SL (4 lẻ); xoá trống → về giá niêm yết. */
  const setLineTotal = (v: string) => {
    if (v === '') {
      form.setValue(`lines.${index}.unitPrice`, '', { shouldDirty: true });
      return;
    }
    if (!qtyValid || new Decimal(qty).isZero()) return;
    form.setValue(
      `lines.${index}.unitPrice`,
      new Decimal(v).div(qty).toDecimalPlaces(4).toFixed(),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const step = (delta: number) => {
    const cur = qtyValid ? new Decimal(qty) : new Decimal(0);
    const next = Decimal.max(cur.plus(delta), 1);
    form.setValue(`lines.${index}.qty`, next.toString(), { shouldValidate: true });
  };

  return (
    <div className={CART_GRID}>
      <div className="pt-2 text-xs tabular-nums text-muted-foreground">{index + 1}</div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {sku.data?.name ?? (sku.isPending ? 'Đang tải…' : 'Không tìm thấy sản phẩm')}
          </p>
          {combo ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-secondary px-1 text-xs font-semibold text-primary">
              <Boxes className="h-3 w-3" aria-hidden />
              Combo
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{sku.data?.code}</span>
          <FormField
            control={form.control}
            name={`lines.${index}.uomId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Đơn vị tính</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!sku.data}>
                  <FormControl>
                    <SelectTrigger
                      aria-label="Đơn vị tính"
                      className="h-7 w-auto gap-1 px-2 text-xs"
                    >
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
          {combo ? (
            <span className={low ? 'font-semibold text-destructive' : undefined}>
              Còn bán được {formatQuantity(combo.available)} combo
              {low ? ' — thiếu thành phần' : ''}
            </span>
          ) : stock.data ? (
            <span className={low ? 'font-semibold text-destructive' : undefined}>
              Khả dụng {formatQuantity(stock.data.available)} {stock.data.baseUomCode}
              {low ? ' — thiếu hàng' : ''}
            </span>
          ) : sku.data && !stock.isPending ? (
            <span>Chưa có tồn</span>
          ) : null}
          {factor && qtyBase ? (
            <span>
              = {formatQuantity(qtyBase.toString())} {sku.data?.baseUom.code}
            </span>
          ) : null}
        </div>
        {combo ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            gồm {combo.components.map((c) => `${formatQuantity(c.qty)} × ${c.code}`).join(', ')}
          </p>
        ) : null}
      </div>

      <FormField
        control={form.control}
        name={`lines.${index}.qty`}
        render={({ field }) => (
          <FormItem>
            <div className="flex h-control items-stretch overflow-hidden rounded-md border border-control-border">
              <button
                type="button"
                aria-label="Giảm số lượng"
                className="w-8 shrink-0 bg-muted/50 text-muted-foreground hover:bg-muted"
                onClick={() => step(-1)}
              >
                <Minus className="mx-auto h-3.5 w-3.5" aria-hidden />
              </button>
              <FormControl>
                <Input
                  inputMode="decimal"
                  aria-label="Số lượng"
                  className="h-full min-w-0 rounded-none border-0 px-1 text-center tabular-nums focus-visible:ring-0"
                  {...field}
                />
              </FormControl>
              <button
                type="button"
                aria-label="Tăng số lượng"
                className="w-8 shrink-0 bg-muted/50 text-muted-foreground hover:bg-muted"
                onClick={() => step(1)}
              >
                <Plus className="mx-auto h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            {/* Nhãn ẩn đứng SAU ô: đứng trước thì space-y của FormItem đẩy ô xuống, lệch hàng. */}
            <FormLabel className="sr-only">Số lượng</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`lines.${index}.unitPrice`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <MoneyInput
                aria-label="Đơn giá"
                unit=""
                dp={2}
                value={unitPrice ?? ''}
                placeholder={price.isFetching ? '…' : 'Nhập giá'}
                onChange={(v) => field.onChange(v === listPrice ? '' : v)}
                className={belowFloor ? 'border-warning' : undefined}
              />
            </FormControl>
            <FormLabel className="sr-only">Đơn giá</FormLabel>
            {manualPrice !== '' && listPrice !== null ? (
              <p className="text-right text-xs text-muted-foreground">
                Niêm yết {formatMoney(listPrice, { unit: '' })}
              </p>
            ) : null}
            {belowFloor ? (
              <p className="text-right text-xs font-medium text-warning">
                Dưới trần chiết khấu — đơn cần duyệt
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <MoneyInput
          aria-label="Thành tiền"
          unit=""
          value={lineTotal ?? ''}
          placeholder="—"
          onChange={setLineTotal}
          disabled={!qtyValid}
          className="font-semibold"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        aria-label="Xóa dòng"
        title="Xóa dòng"
        onClick={onRemove}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}
