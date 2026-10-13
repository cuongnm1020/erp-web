'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney, formatPhone, formatQuantity, toDecimal } from '@/lib/format';
import { LABEL_SIZES, type PrintController } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';

export type WaybillOrientation = 'landscape' | 'portrait';

/** Số dòng hàng in ra; còn lại gom thành "+N sản phẩm khác" để chữ không bị thu nhỏ. */
const MAX_ITEMS = { landscape: 2, portrait: 4 } as const;

const sizeOf = (o: WaybillOrientation) =>
  LABEL_SIZES[o === 'landscape' ? 'WAYBILL_100x75' : 'WAYBILL_75x100'];

/**
 * Mã dài hơn mức này (GHTK ~35 ký tự) cần CẢ chiều ngang tem để mỗi vạch còn ≥ ~2 chấm in
 * (203 dpi) → bỏ QR bên cạnh, chữ mã nhỏ lại. Mã ngắn (VTP ~13 ký tự) giữ QR như nhãn hãng.
 */
const LONG_CODE = 16;

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const clamp = (lines: number): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

/**
 * Nhãn vận đơn ERP tự in, khổ 100×75 mm (máy in nhiệt 3 inch) — ngang hoặc dọc (2026-10-13).
 * Chữ to, đen trắng: mã vận đơn (CODE128 + QR), người nhận + SĐT + địa chỉ, tiền thu hộ, hàng,
 * ghi chú. Hãng chưa cấp vận đơn → in mã phiếu giao thay thế để kho vẫn dán được kiện.
 * Kích thước tính bằng mm/pt để bản in khớp tem; xem trước dùng chính component này.
 */
export function WaybillLabel({
  data,
  orientation,
  printedAt,
}: {
  data: ShipmentLabelData;
  orientation: WaybillOrientation;
  printedAt: Date;
}) {
  const size = sizeOf(orientation);
  const land = orientation === 'landscape';
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const long = code.length > LONG_CODE;
  const cod = toDecimal(data.codAmount);
  const hasCod = cod !== null && cod.gt(0);
  const max = MAX_ITEMS[orientation];
  const shown = data.items.slice(0, max);
  const more = data.items.length - shown.length;

  const header = (
    <div className="flex items-baseline justify-between" style={{ fontSize: '9pt', gap: '1mm' }}>
      <span className="truncate font-bold uppercase" style={{ fontSize: '11pt' }}>
        {data.carrierName ?? data.carrierCode ?? 'Vận đơn'}
      </span>
      <span className="shrink-0 tabular-nums">{formatDateTime(printedAt)}</span>
    </div>
  );

  const codeBlock = (
    <div className="flex items-stretch" style={{ gap: '2mm' }}>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="w-full" style={{ height: long ? '11mm' : land ? '13mm' : '15mm' }}>
          <Barcode
            value={code}
            symbology="code128"
            height={14}
            scale={2}
            showText={false}
            className={cn('block h-full w-full', FILL_SVG)}
            label={`Mã vận đơn ${code}`}
          />
        </div>
        <div
          className={cn(
            'max-w-full text-center font-mono font-bold leading-none',
            long ? 'break-all' : 'tracking-wide',
          )}
          style={{ fontSize: long ? '8.5pt' : land ? '13pt' : '14pt', marginTop: '0.8mm' }}
        >
          {code}
        </div>
      </div>
      {long ? null : (
        <div
          className="shrink-0"
          style={{ width: land ? '17mm' : '18mm', height: land ? '17mm' : '18mm' }}
        >
          <Barcode
            value={code}
            symbology="qrcode"
            scale={2}
            className={cn('block h-full w-full', FILL_SVG)}
            label={`QR ${code}`}
          />
        </div>
      )}
    </div>
  );

  const recipient = (
    <div className="flex min-w-0 flex-col" style={{ gap: '0.5mm' }}>
      {data.recipient ? (
        <>
          <div className="truncate font-bold" style={{ fontSize: '12pt' }}>
            {data.recipient.name}
          </div>
          <div className="font-bold tabular-nums leading-none" style={{ fontSize: '15pt' }}>
            {formatPhone(data.recipient.phone)}
          </div>
          <div
            className="font-semibold leading-tight"
            style={{ fontSize: '11pt', ...clamp(land ? 4 : 3) }}
          >
            {data.recipient.address}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '10pt' }}>Đơn chưa có địa chỉ giao</div>
      )}
    </div>
  );

  const codBlock = (
    <div
      className="flex items-baseline justify-between border-b border-foreground"
      style={{ gap: '1mm', paddingBottom: '0.8mm' }}
    >
      <span className="font-bold" style={{ fontSize: '10pt' }}>
        {hasCod ? 'Thu hộ' : 'Không thu tiền'}
      </span>
      {hasCod ? (
        <span className="font-extrabold tabular-nums leading-none" style={{ fontSize: '16pt' }}>
          {formatMoney(data.codAmount, { unit: 'đ' })}
        </span>
      ) : null}
    </div>
  );

  const items = (
    <ul className="flex flex-col" style={{ fontSize: '9.5pt', gap: '0.5mm' }}>
      {shown.map((it, i) => (
        <li key={i} className="flex leading-tight" style={{ gap: '1mm' }}>
          <span className="min-w-0 flex-1 font-semibold" style={clamp(2)}>
            {it.name}
          </span>
          <span className="shrink-0 font-bold tabular-nums">×{formatQuantity(it.qty)}</span>
        </li>
      ))}
      {more > 0 ? <li className="italic">+{more} sản phẩm khác</li> : null}
    </ul>
  );

  const footer = (
    <div
      className="flex flex-col border-t border-foreground"
      style={{ fontSize: '8.5pt', gap: '0.3mm', paddingTop: '0.8mm' }}
    >
      {data.note ? (
        <div className="font-semibold leading-tight" style={clamp(2)}>
          {data.note}
        </div>
      ) : null}
      <div className="flex justify-between" style={{ gap: '1mm' }}>
        <span className="truncate">Đơn {data.orderDocNumber ?? '—'}</span>
        {data.weightKg ? (
          <span className="shrink-0">{formatQuantity(data.weightKg)} kg</span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      data-waybill-label={code}
      className="flex flex-col overflow-hidden bg-card text-foreground"
      style={{
        gap: '1.2mm',
        width: `${size.labelWidthMm}mm`,
        height: `${size.labelHeightMm}mm`,
        padding: '2.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {header}
      {codeBlock}
      {land ? (
        <div
          className="grid min-h-0 flex-1 overflow-hidden border-t border-foreground"
          style={{ gridTemplateColumns: '1.15fr 1fr', gap: '2mm', paddingTop: '1mm' }}
        >
          {recipient}
          <div
            className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-foreground"
            style={{ gap: '0.8mm', paddingLeft: '2mm' }}
          >
            {codBlock}
            {items}
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-foreground"
          style={{ gap: '1mm', paddingTop: '1mm' }}
        >
          {recipient}
          {codBlock}
          {items}
        </div>
      )}
      {footer}
    </div>
  );
}

/** Tờ in một nhãn vận đơn 100×75 — `@page` theo hướng đã chọn. */
export function WaybillLabelPrintSheet({
  data,
  orientation,
  printedAt,
  printer,
}: {
  data: ShipmentLabelData;
  orientation: WaybillOrientation;
  printedAt: Date;
  printer: PrintController;
}) {
  return (
    <PrintSheet
      open={printer.open}
      onDone={printer.done}
      size={orientation === 'landscape' ? 'WAYBILL_100x75' : 'WAYBILL_75x100'}
    >
      <div data-print-page>
        <WaybillLabel data={data} orientation={orientation} printedAt={printedAt} />
      </div>
    </PrintSheet>
  );
}
