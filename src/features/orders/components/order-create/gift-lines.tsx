'use client';

import Decimal from 'decimal.js';
import { Gift } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { SkuQuickRow } from '../../api/use-order-create';
import { EMPTY_LINE, type CreateOrderValues } from '../../schema';
import { CartLine, type LineMetrics } from './cart-line';
import { ProductSearch } from './product-search';

type Lines = CreateOrderValues['lines'];

/**
 * Thêm sản phẩm vào giỏ (2026-11-03): đã có dòng CÙNG SKU CÙNG LOẠI (bán / khuyến mãi) thì +1, chưa
 * có thì thêm dòng — bán và tặng cùng SKU là hai dòng riêng (in đơn mới cộng SL).
 */
export function addCartSku(
  form: UseFormReturn<CreateOrderValues>,
  append: (line: Lines[number]) => void,
  { skuId, baseUomId }: SkuQuickRow,
  isGift: boolean,
): void {
  const cur = form.getValues('lines');
  const idx = cur.findIndex((l) => l.skuId === skuId && (l.isGift === true) === isGift);
  if (idx >= 0) {
    const q = cur[idx]!.qty;
    const next = /^\d/.test(q) ? new Decimal(q).plus(1).toString() : '1';
    form.setValue(`lines.${idx}.qty`, next, { shouldDirty: true, shouldValidate: true });
  } else {
    append({ ...EMPTY_LINE, skuId, uomId: baseUomId, ...(isGift ? { isGift: true } : {}) });
  }
}

/**
 * Khu "Sản phẩm khuyến mãi" dưới giỏ (2026-11-03): ô tìm riêng, dòng tặng đơn giá / thành tiền 0,
 * sale chỉ chọn số lượng. Kho vẫn giữ tồn + xuất như hàng bán; in đơn cộng SL với dòng bán cùng SKU
 * (10 bán + 2 tặng → 12). Dòng nằm chung mảng `lines` của form, phân biệt bằng `isGift`.
 */
export function GiftLines({
  form,
  fields,
  customerId,
  channel,
  warehouseId,
  onMetrics,
  onRemove,
  onPick,
}: {
  form: UseFormReturn<CreateOrderValues>;
  /** Dòng khuyến mãi kèm vị trí trong mảng `lines`. */
  fields: { id: string; index: number }[];
  customerId: string;
  channel: CreateOrderValues['channel'];
  warehouseId: string;
  onMetrics: (fieldId: string, m: LineMetrics) => void;
  onRemove: (index: number) => void;
  onPick: (row: SkuQuickRow) => void;
}) {
  return (
    // Nằm NGOÀI khung cuộn ngang của giỏ: khung `overflow-x-auto` cũng cắt theo chiều dọc, danh sách
    // gợi ý của ô tìm bị che mất (lỗi 2026-11-03) — chỉ phần dòng hàng cuộn ngang.
    <section aria-label="Sản phẩm khuyến mãi" className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md bg-muted/40 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Gift className="h-4 w-4 text-primary" aria-hidden />
          Sản phẩm khuyến mãi
          <span className="font-normal text-muted-foreground">
            {fields.length > 0 ? `· ${fields.length} dòng · thành tiền 0 ₫` : '· tặng kèm, 0 ₫'}
          </span>
        </h3>
        <ProductSearch warehouseId={warehouseId} onPick={onPick} label="Tìm sản phẩm khuyến mãi" />
      </div>
      {fields.length > 0 ? (
        <div className="overflow-x-auto border-t">
          <div className="min-w-[680px] divide-y">
            {fields.map((f, i) => (
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
                onRemove={() => onRemove(f.index)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
