'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { LABEL_SIZES, type PrintController } from '@/lib/print';

const SIZE = LABEL_SIZES.SKU_50x30;
const LABEL_STYLE: CSSProperties = {
  width: `${SIZE.labelWidthMm}mm`,
  height: `${SIZE.labelHeightMm}mm`,
  padding: '1.5mm 2mm',
};
const TITLE_STYLE: CSSProperties = { fontSize: '8pt', lineHeight: 1.15 };
const CODE_STYLE: CSSProperties = { fontSize: '9pt', lineHeight: 1.15 };

export interface LpnLabelData {
  /** Mã cá thể container (LPN / mã NCC) — nội dung mã vạch. */
  barcode: string;
  /** PALLET / CARTON… */
  typeCode: string;
  /** Dòng phụ: SKU + số lượng trong thùng, hoặc "bọc N thùng". */
  line1: string;
  line2?: string;
}

/**
 * Tem thùng / kiện / pallet 50×30 mm (PLAN-packaging-hierarchy quyết định 5): CODE128 của mã
 * cá thể — quét tem này ở cất hàng / lấy hàng là nhận cả thùng. Cùng khổ tem SKU để dùng chung
 * cuộn tem 2 cột.
 */
export function LpnLabel({ data }: { data: LpnLabelData }) {
  return (
    <div
      className="flex flex-col justify-between overflow-hidden bg-card text-foreground"
      style={LABEL_STYLE}
      data-lpn-label={data.barcode}
    >
      <div className="flex items-baseline justify-between gap-1" style={TITLE_STYLE}>
        <span className="font-semibold uppercase">{data.typeCode}</span>
        <span className="truncate">{data.line1}</span>
      </div>
      {data.line2 ? (
        <div className="truncate" style={TITLE_STYLE}>
          {data.line2}
        </div>
      ) : null}
      <div className="flex justify-center">
        <Barcode value={data.barcode} symbology="code128" height={9} scale={2} showText={false} />
      </div>
      <div className="text-center font-mono font-semibold" style={CODE_STYLE}>
        {data.barcode}
      </div>
    </div>
  );
}

/** Tờ in tem LPN — 2 tem một hàng (khổ cuộn 2 cột). */
export function LpnPrintSheet({
  labels,
  printer,
}: {
  labels: LpnLabelData[];
  printer: PrintController;
}) {
  const pages: LpnLabelData[][] = [];
  for (let i = 0; i < labels.length; i += SIZE.columns)
    pages.push(labels.slice(i, i + SIZE.columns));
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size="SKU_50x30">
      {pages.map((page, i) => (
        <div key={i} data-print-page className="flex" style={{ gap: '4mm', padding: '1mm 2mm' }}>
          {page.map((l) => (
            <LpnLabel key={l.barcode} data={l} />
          ))}
        </div>
      ))}
    </PrintSheet>
  );
}
