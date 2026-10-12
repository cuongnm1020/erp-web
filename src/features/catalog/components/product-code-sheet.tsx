'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import type { ApiBarcodeType } from '@/lib/print';

export interface ProductCodeSheetData {
  /** Mã được mã hoá (barcode / QR của sản phẩm). */
  code: string;
  type: ApiBarcodeType;
  productName: string;
  skuCode: string;
  /** "Sản phẩm · CHAI", "Thùng · BOX = 30 CHAI"… */
  levelLabel: string;
}

// Kích thước VẬT LÝ trên A5 ngang (210×148 mm) khai bằng inline style — đây là khổ giấy, không
// phải spacing giao diện, nên không đi qua token Tailwind.
const PAGE_STYLE: CSSProperties = {
  width: '210mm',
  height: '148mm',
  padding: '10mm 12mm',
  boxSizing: 'border-box',
  breakAfter: 'page',
};
/** Ô mã QR vuông: 148 − 2×10 lề = 128 mm cao; chừa 3 mm cho chữ mã bên dưới. */
const QR_BOX_STYLE: CSSProperties = { width: '118mm', height: '118mm', flex: 'none' };
/** Mã vạch 1 chiều (CODE128 / EAN13) nằm ngang hết khổ. */
const LINEAR_BOX_STYLE: CSSProperties = { width: '186mm', height: '62mm' };
const NAME_STYLE: CSSProperties = { fontSize: '24pt', lineHeight: 1.2 };
const CODE_STYLE: CSSProperties = { fontSize: '20pt', lineHeight: 1.2 };
const META_STYLE: CSSProperties = { fontSize: '13pt', lineHeight: 1.3 };

const isQr = (type: ApiBarcodeType) => type === 'QR';

/**
 * Một trang A5 ngang: mã QR sản phẩm cỡ lớn (quét được từ xa ở kệ / thùng) + tên sản phẩm, mã
 * SKU, cấp đóng gói. Mã 1 chiều thì xếp dọc: chữ trên, vạch ngang hết khổ bên dưới. Dùng cả cho
 * preview trên màn hình lẫn tờ in — cái nhìn thấy là cái in ra.
 */
export function ProductCodeSheet({ data }: { data: ProductCodeSheetData }) {
  const qr = isQr(data.type);
  const text = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="font-bold" style={NAME_STYLE}>
        {data.productName}
      </div>
      <div className="font-mono font-semibold" style={CODE_STYLE}>
        {data.code}
      </div>
      <div style={META_STYLE}>
        SKU <span className="font-mono">{data.skuCode}</span> · {data.levelLabel}
      </div>
    </div>
  );
  return (
    <div
      data-print-page
      data-product-code-sheet={data.code}
      className={
        qr
          ? 'flex items-center gap-8 bg-card text-foreground'
          : 'flex flex-col justify-center gap-6 bg-card text-foreground'
      }
      style={PAGE_STYLE}
    >
      {qr ? (
        <>
          <div style={QR_BOX_STYLE}>
            <Barcode
              value={data.code}
              apiType={data.type}
              scale={8}
              showText={false}
              className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
            />
          </div>
          {text}
        </>
      ) : (
        <>
          {text}
          <div style={LINEAR_BOX_STYLE}>
            <Barcode
              value={data.code}
              apiType={data.type}
              height={20}
              scale={4}
              showText={false}
              className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
