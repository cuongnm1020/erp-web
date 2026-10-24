'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { LABEL_SIZES, type PrintController } from '@/lib/print';

export interface LocationLabelData {
  /** Nội dung mã vạch — `Location.barcode` (`LOC-<mã>`, LOC-1). */
  barcode: string;
  /** Mã vị trí đọc bằng mắt: A-01-1, DEFAULT… */
  code: string;
  /** "Ô kệ" / "Khu tập kết"… */
  typeLabel: string;
  warehouseCode: string;
  /** Tầng dự trữ (không lấy hàng) — in chữ nhỏ để người cất / chuyển biết. */
  reserve: boolean;
}

export type LocationLabelSize = 'WAYBILL_100x75' | 'SKU_50x30';

const BIG = LABEL_SIZES.WAYBILL_100x75;
const SMALL = LABEL_SIZES.SKU_50x30;

/**
 * Tem vị trí CODE128 (LOC-2, docs/PLAN-putaway-relocate.md): dán ở ô kệ / pallet sàn / DEFAULT —
 * máy PDA quét tem này khi cất hàng, tra vị trí, chuyển hàng. Khổ 100×75 (mã chữ to đọc từ xa)
 * hoặc 50×30 hai cột (dán mép thanh beam).
 */
export function LocationLabel({
  data,
  size,
}: {
  data: LocationLabelData;
  size: LocationLabelSize;
}) {
  const big = size === 'WAYBILL_100x75';
  const dims = big ? BIG : SMALL;
  const style: CSSProperties = {
    width: `${dims.labelWidthMm}mm`,
    height: `${dims.labelHeightMm}mm`,
    padding: big ? '4mm 5mm' : '1.5mm 2mm',
  };
  return (
    <div
      className="flex flex-col justify-between overflow-hidden bg-card text-foreground"
      style={style}
      data-location-label={data.barcode}
    >
      <div
        className="flex items-baseline justify-between gap-1"
        style={{ fontSize: big ? '11pt' : '7pt', lineHeight: 1.1 }}
      >
        <span className="font-semibold uppercase">{data.typeLabel}</span>
        <span>
          {data.warehouseCode}
          {data.reserve ? ' · DỰ TRỮ' : ''}
        </span>
      </div>
      <div
        className="text-center font-mono font-bold"
        style={{ fontSize: big ? '40pt' : '13pt', lineHeight: 1 }}
      >
        {data.code}
      </div>
      <div className="flex justify-center">
        <Barcode
          value={data.barcode}
          symbology="code128"
          height={big ? 16 : 8}
          scale={big ? 3 : 2}
          showText={false}
        />
      </div>
      <div
        className="text-center font-mono"
        style={{ fontSize: big ? '10pt' : '7pt', lineHeight: 1.1 }}
      >
        {data.barcode}
      </div>
    </div>
  );
}

/** Tờ in tem vị trí: 100×75 một tem / trang, 50×30 hai tem một hàng. */
export function LocationPrintSheet({
  labels,
  size,
  printer,
}: {
  labels: LocationLabelData[];
  size: LocationLabelSize;
  printer: PrintController;
}) {
  const columns = LABEL_SIZES[size].columns;
  const pages: LocationLabelData[][] = [];
  for (let i = 0; i < labels.length; i += columns) pages.push(labels.slice(i, i + columns));
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size={size}>
      {pages.map((page, i) => (
        <div
          key={i}
          data-print-page
          className="flex"
          style={{
            gap: size === 'SKU_50x30' ? '4mm' : 0,
            padding: size === 'SKU_50x30' ? '1mm 2mm' : 0,
          }}
        >
          {page.map((l) => (
            <LocationLabel key={l.barcode} data={l} size={size} />
          ))}
        </div>
      ))}
    </PrintSheet>
  );
}
