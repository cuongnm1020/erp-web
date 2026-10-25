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

const SMALL = LABEL_SIZES.LPN_35x22;
/** Khe giữa 2 tem trên cuộn 35×22 (khổ cuộn 72 mm = 35 + 2 + 35). */
const SMALL_GAP_MM = 2;
const SMALL_STYLE: CSSProperties = {
  width: `${SMALL.labelWidthMm}mm`,
  height: `${SMALL.labelHeightMm}mm`,
  // Lề trắng hai bên mã vạch (quiet zone) — máy quét cần ≥ 10 lần module.
  padding: '3.5mm 2mm',
  boxSizing: 'border-box',
};

/**
 * Tem thùng 35×22 mm (2026-10-25, user chốt): CHỈ mã vạch CODE128 của mã thùng, không chữ, vạch
 * giãn kín vùng in (~31 × 15 mm). Quét tem này ở cất hàng / lấy hàng là nhận cả thùng.
 */
export function LpnBarcodeLabel({ barcode }: { barcode: string }) {
  return (
    <div className="overflow-hidden bg-card" style={SMALL_STYLE} data-lpn-label={barcode}>
      <Barcode value={barcode} symbology="code128" height={10} scale={3} showText={false} fill />
    </div>
  );
}

/**
 * Tờ in tem LPN — 2 tem một hàng (khổ cuộn 2 cột). `size`: `SKU_50x30` (mặc định — tem có loại
 * thùng, SKU, mã chữ) hoặc `LPN_35x22` (tem thùng phiếu nhập, chỉ mã vạch).
 */
export function LpnPrintSheet({
  labels,
  printer,
  size = 'SKU_50x30',
}: {
  labels: LpnLabelData[];
  printer: PrintController;
  size?: 'SKU_50x30' | 'LPN_35x22';
}) {
  const columns = LABEL_SIZES[size].columns;
  const pages: LpnLabelData[][] = [];
  for (let i = 0; i < labels.length; i += columns) pages.push(labels.slice(i, i + columns));
  return (
    <PrintSheet open={printer.open} onDone={printer.done} size={size}>
      {pages.map((page, i) =>
        size === 'LPN_35x22' ? (
          <div key={i} data-print-page className="flex" style={{ gap: `${SMALL_GAP_MM}mm` }}>
            {page.map((l) => (
              <LpnBarcodeLabel key={l.barcode} barcode={l.barcode} />
            ))}
          </div>
        ) : (
          <div key={i} data-print-page className="flex" style={{ gap: '4mm', padding: '1mm 2mm' }}>
            {page.map((l) => (
              <LpnLabel key={l.barcode} data={l} />
            ))}
          </div>
        ),
      )}
    </PrintSheet>
  );
}
