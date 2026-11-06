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
import { StatusBadge } from '@/components/data/status-badge';
import { useUomName } from '@/lib/uom';
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
import { useWarehouse } from '@/lib/warehouse';
import {
  useComboAvailableIn,
  useLinePrice,
  useSkuAvailability,
  useSkuDetail,
} from '../../api/use-line-entry';
import { pancakeAmountFix } from '../../pancake-line-amount';
import type { CreateOrderValues } from '../../schema';

const QTY_RE = /^\d{1,12}(\.\d{1,6})?$/;

/**
 * Đơn giá dưới tỉ lệ này của giá niêm yết (cùng đơn vị) → nhiều khả năng chọn nhầm đơn vị tính
 * (sự cố SO2610-00255 2026-11-03: 40 THÙNG × 95.000 ₫ — giá một chai — nên giữ 1.600 chai, 720 kg).
 * Chỉ cảnh báo, không chặn; giá 0 (tặng) bỏ qua.
 */
const SUSPECT_PRICE_RATIO = new Decimal('0.1');

/** Cảnh báo đơn giá thấp bất thường so với niêm yết; null = không có gì đáng ngờ. */
export function suspiciousPriceRatio(
  unitPrice: string | null,
  listPrice: string | null,
): Decimal | null {
  if (!unitPrice || !listPrice) return null;
  const unit = new Decimal(unitPrice);
  const list = new Decimal(listPrice);
  if (unit.lte(0) || list.lte(0)) return null;
  const ratio = unit.div(list);
  return ratio.lessThan(SUSPECT_PRICE_RATIO) ? ratio : null;
}

export interface LineMetrics {
  /** Thành tiền xem trước, Decimal(18,4) chuỗi; null = chưa có giá. */
  total: string | null;
  /**
   * Giá niêm yết × SL, Decimal(18,4) chuỗi — mẫu số của kiểm tra COD thấp (2026-11-06). Dòng quà
   * = 0 như server (quà snapshot listPrice 0). null = chưa có giá.
   */
  listTotal?: string | null;
  /** Cân nặng dòng (kg) = SL cơ sở × cân nặng SKU; null = SKU chưa khai cân nặng. */
  weightKg: string | null;
  /**
   * Sản phẩm "Chỉ bán từ kho" khác Kho xuất đang chọn (2026-11-05) → form chặn lưu / chốt. Server
   * vẫn chặn (409 ORDER_SKU_SELL_WAREHOUSE) — đây chỉ báo sớm.
   */
  sellBlocked?: boolean;
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
  warehouseId,
  onMetrics,
  onRemove,
  wholeUnitPrice = false,
  no,
}: {
  /** Số thứ tự hiện trên dòng; mặc định index + 1 (khu SP khuyến mãi đánh số riêng). */
  no?: number;
  fieldId: string;
  form: UseFormReturn<CreateOrderValues>;
  index: number;
  customerId: string;
  channel: CreateOrderValues['channel'];
  /** Kho xuất của đơn — khả dụng tính trong kho này (2026-10-29); rỗng = mọi kho. */
  warehouseId: string;
  onMetrics: (fieldId: string, m: LineMetrics) => void;
  onRemove: () => void;
  /**
   * Đơn Pancake (màn Sửa đơn): Pancake chỉ lưu đơn giá NGUYÊN đồng × SL → thành tiền không chia
   * hết cho SL cơ sở thì báo con số Pancake sẽ ghi; ERP vẫn lưu thành tiền đã nhập (2026-11-03).
   * Combo bỏ qua ở đây (server phân bổ thành phần).
   */
  wholeUnitPrice?: boolean;
}) {
  const skuId = useWatch({ control: form.control, name: `lines.${index}.skuId` });
  const uomId = useWatch({ control: form.control, name: `lines.${index}.uomId` });
  const qty = useWatch({ control: form.control, name: `lines.${index}.qty` });
  const manualPrice = useWatch({ control: form.control, name: `lines.${index}.unitPrice` }) ?? '';
  // Sản phẩm khuyến mãi (2026-11-03): đơn giá / thành tiền khoá 0, chỉ sửa số lượng.
  const isGift = useWatch({ control: form.control, name: `lines.${index}.isGift` }) === true;
  const sku = useSkuDetail(skuId);
  const combo = sku.data?.isCombo ? (sku.data.combo ?? null) : null;
  // Combo không có tồn riêng — khả dụng lấy từ thành phần (GET /skus/{id}.combo), không hỏi /stock.
  // Đã chọn Kho xuất → chỉ tính tồn trong kho đó (2026-10-29).
  const stock = useSkuAvailability(combo ? '' : (sku.data?.code ?? ''), warehouseId);
  const comboIn = useComboAvailableIn(combo ? (sku.data?.code ?? '') : '', warehouseId);
  const comboAvailable = warehouseId ? (comboIn.data ?? null) : (combo?.available ?? null);
  // Chỉ bán từ kho (2026-11-05): Kho xuất chọn cụ thể mà sản phẩm khoá ở kho khác. "Kho mặc định
  // của bạn" ('') do server quyết kho — server chặn nếu lệch.
  const { options: warehouseOptions } = useWarehouse();
  const sellWarehouseId = sku.data?.product?.sellWarehouseId ?? null;
  const sellBlocked = !!sellWarehouseId && warehouseId !== '' && sellWarehouseId !== warehouseId;
  const sellWarehouseName =
    warehouseOptions.find((w) => w.id === sellWarehouseId)?.name ?? 'kho khác';
  /** Kho xuất không có dòng tồn nào của SKU — coi như 0. */
  const noStockHere = !combo && warehouseId !== '' && sku.data && stock.isSuccess && !stock.data;
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
    ? qtyValid && comboAvailable !== null && new Decimal(comboAvailable).lessThan(qty)
    : noStockHere
      ? qtyValid
      : stock.data && qtyBase
        ? new Decimal(stock.data.available).lessThan(qtyBase)
        : false;

  // Đơn giá hiệu lực = giá sửa tay, không thì giá niêm yết; thành tiền = đơn giá × SL (làm tròn 4
  // lẻ như server).
  const listPrice = price.data?.listPrice ?? null;
  const unitPrice = isGift ? '0' : manualPrice !== '' ? manualPrice : listPrice;
  const lineTotal =
    unitPrice !== null && qtyValid
      ? new Decimal(unitPrice).mul(qty).toDecimalPlaces(4).toFixed(4)
      : null;
  const listTotal = isGift
    ? '0.0000'
    : listPrice !== null && qtyValid
      ? new Decimal(listPrice).mul(qty).toDecimalPlaces(4).toFixed(4)
      : null;
  const weightKg = qtyBase && sku.data?.weightKg ? qtyBase.mul(sku.data.weightKg).toFixed(4) : null;
  const uomCode = sku.data
    ? uomId === sku.data.baseUomId
      ? sku.data.baseUom.code
      : (sku.data.uomConversions.find((c) => c.uomId === uomId)?.uom.code ?? null)
    : null;
  // Tên ĐVT ("Thùng") thay mã ("BOX") khi hiển thị (2026-11-06).
  const uomName = useUomName();
  const priceRatio = isGift ? null : suspiciousPriceRatio(unitPrice, listPrice);
  const amountFix =
    wholeUnitPrice && !isGift && !combo && lineTotal !== null && qtyBase
      ? pancakeAmountFix(lineTotal, qtyBase)
      : null;
  useEffect(() => {
    onMetrics(fieldId, { total: lineTotal, listTotal, weightKg, sellBlocked });
  }, [fieldId, lineTotal, listTotal, weightKg, sellBlocked, onMetrics]);

  // Giá sửa tay thấp (kể cả 0, dưới trần CK) không còn vào duyệt — 2026-10-29 tắt quy tắc
  // "Đơn giá dưới trần chiết khấu" phía server.

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
      <div className="pt-2 text-xs tabular-nums text-muted-foreground">{no ?? index + 1}</div>

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
          {isGift ? <StatusBadge tone="ok">Khuyến mãi</StatusBadge> : null}
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
                        <SelectItem value={sku.data.baseUomId}>
                          {uomName(sku.data.baseUom.code)}
                        </SelectItem>
                        {sku.data.uomConversions.map((c) => (
                          <SelectItem key={c.uomId} value={c.uomId}>
                            {uomName(c.uom.code)} (= {formatQuantity(c.factor)}{' '}
                            {uomName(sku.data!.baseUom.code)})
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
            comboAvailable !== null ? (
              <span className={low ? 'font-semibold text-destructive' : undefined}>
                Còn bán được {formatQuantity(comboAvailable)} combo
                {low ? ' — thiếu thành phần' : ''}
              </span>
            ) : null
          ) : noStockHere ? (
            <span className="font-semibold text-destructive">Kho xuất chưa có hàng</span>
          ) : stock.data ? (
            <span className={low ? 'font-semibold text-destructive' : undefined}>
              Khả dụng {formatQuantity(stock.data.available)} {uomName(stock.data.baseUomCode)}
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
        {sellBlocked ? (
          <p role="alert" className="mt-0.5 text-xs font-semibold text-destructive">
            Chỉ bán từ {sellWarehouseName} — đổi Kho xuất hoặc bỏ dòng này
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
                disabled={isGift}
              />
            </FormControl>
            <FormLabel className="sr-only">Đơn giá</FormLabel>
            {priceRatio && listPrice !== null ? (
              <p role="alert" className="text-right text-xs font-semibold text-warning">
                Chỉ bằng {priceRatio.mul(100).toDecimalPlaces(1).toString()}% giá niêm yết{' '}
                {formatMoney(listPrice, { unit: '' })}
                {uomCode ? `/${uomName(uomCode)}` : ''} — kiểm tra lại đơn vị tính
              </p>
            ) : !isGift && manualPrice !== '' && listPrice !== null ? (
              <p className="text-right text-xs text-muted-foreground">
                Niêm yết {formatMoney(listPrice, { unit: '' })}
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
          disabled={!qtyValid || isGift}
          className="font-semibold"
        />
        {amountFix ? (
          <p className="mt-1 text-right text-xs text-muted-foreground">
            Pancake chỉ nhận đơn giá nguyên đồng — Pancake ghi{' '}
            {formatMoney(amountFix.unit, { unit: '' })} × SL ={' '}
            {formatMoney(amountFix.pancakeTotal, { unit: '' })}, ERP giữ thành tiền đã nhập
          </p>
        ) : null}
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
