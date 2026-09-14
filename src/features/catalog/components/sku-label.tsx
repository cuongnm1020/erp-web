'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { LABEL_SIZES, type ApiBarcodeType } from '@/lib/print';

export interface SkuLabelData {
  skuCode: string;
  name: string;
  barcode: string;
  barcodeType: ApiBarcodeType;
  uomCode: string;
  /** Decimal(18,4) chuỗi — null = không in giá. */
  price: string | null;
}

export interface SkuLabelOptions {
  showName: boolean;
  showSku: boolean;
  showPrice: boolean;
}

export const DEFAULT_LABEL_OPTIONS: SkuLabelOptions = {
  showName: true,
  showSku: true,
  showPrice: true,
};

const SIZE = LABEL_SIZES.SKU_50x30;

// Kích thước VẬT LÝ của tem (mm / pt) khai bằng inline style — đây là khổ giấy, không phải
// spacing giao diện, nên không đi qua token Tailwind.
const LABEL_STYLE: CSSProperties = {
  width: `${SIZE.labelWidthMm}mm`,
  height: `${SIZE.labelHeightMm}mm`,
  padding: '1.5mm 2mm',
};
const NAME_STYLE: CSSProperties = { fontSize: '9pt', lineHeight: 1.15 };
const META_STYLE: CSSProperties = { fontSize: '7pt', lineHeight: 1.15 };

/**
 * Một tem SKU 50×30 mm (quyết định PLAN-barcode-pick-pack 3). Dùng cả cho preview trên
 * màn hình và trong tờ in — cùng một component để cái nhìn thấy là cái in ra.
 */
export function SkuLabel({
  data,
  options = DEFAULT_LABEL_OPTIONS,
  className,
}: {
  data: SkuLabelData;
  options?: SkuLabelOptions;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between overflow-hidden bg-card text-foreground',
        className,
      )}
      style={LABEL_STYLE}
      data-sku-label={data.skuCode}
    >
      {options.showName ? (
        <div className="truncate font-semibold" style={NAME_STYLE}>
          {data.name}
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-1" style={META_STYLE}>
        {options.showSku ? <span className="font-mono">{data.skuCode}</span> : <span />}
        {options.showPrice && data.price ? (
          <span className="font-semibold">
            {formatMoney(data.price, { unit: '' })} / {data.uomCode}
          </span>
        ) : (
          <span>{data.uomCode}</span>
        )}
      </div>
      <div className="flex justify-center">
        <Barcode value={data.barcode} apiType={data.barcodeType} height={9} scale={2} />
      </div>
    </div>
  );
}
