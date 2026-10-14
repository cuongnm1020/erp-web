'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { cn } from '@/lib/cn';
import { MapPin, Phone, Store, User } from 'lucide-react';
import { formatDate, formatMoney, formatPhone, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES, type PrintController } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';

export type WaybillOrientation = 'landscape' | 'portrait';

/** Số dòng hàng in ra; còn lại gom thành "+N sản phẩm khác" để chữ không bị thu nhỏ. */
const MAX_ITEMS = { landscape: 2, portrait: 3 } as const;

const sizeOf = (o: WaybillOrientation) =>
  LABEL_SIZES[o === 'landscape' ? 'WAYBILL_100x75' : 'WAYBILL_75x100'];

/**
 * Mã dài hơn mức này (GHTK ~35 ký tự) cần CẢ chiều ngang tem để mỗi vạch còn ≥ ~2 chấm in
 * (203 dpi) → bỏ cột QR, mã vạch trải hết chiều ngang. Mã ngắn (VTP ~13 ký tự) giữ bố cục
 * nhãn Pancake: cột hãng + QR bên trái, mã vạch bên phải.
 */
const LONG_CODE = 16;

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const BORDER = '0.3mm solid currentColor';

/** Cắt N dòng; line-height 1.3 để dấu tiếng Việt (ệ, ỹ…) không bị xén ở dòng cuối. */
const clamp = (lines: number): CSSProperties => ({
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const ICON = { width: '1em', height: '1em', flexShrink: 0 } as const;

/**
 * Nhãn vận đơn ERP tự in, khổ 100×75 mm (máy in nhiệt 3 inch) — ngang hoặc dọc. Bố cục theo
 * nhãn in từ Pancake (2026-10-14): viền đứt; trên = hãng + mã hãng + QR + giờ in | mã vạch + mã
 * vận đơn + số kiện; dưới = ô người nhận (tên, SĐT, địa chỉ chữ lớn, ghi chú in) | ô COD + bảng
 * Sản phẩm / SL. Hãng chưa cấp vận đơn → in mã phiếu giao thay thế để kho vẫn dán được kiện.
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
  // Dọc + mã dài: khối mã chiếm thêm chỗ → bớt một dòng hàng.
  const max = MAX_ITEMS[orientation] - (long && !land ? 1 : 0);
  const shown = data.items.slice(0, max);
  const more = data.items.length - shown.length;
  const carrier = data.carrierName ?? data.carrierCode ?? 'Vận đơn';
  const printed = `${formatTime(printedAt)} ${formatDate(printedAt)}`;

  const barcode = (height: string, textPt: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
      <div className="w-full" style={{ height }}>
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
      <div className="flex w-full items-end" style={{ marginTop: '0.8mm', gap: '1mm' }}>
        <span
          className={cn(
            'min-w-0 flex-1 text-center font-mono leading-none',
            long ? 'break-all font-bold' : 'tracking-wide',
          )}
          style={{ fontSize: textPt }}
        >
          {code}
        </span>
        {long ? null : (
          <span className="shrink-0 font-bold leading-none" style={{ fontSize: '11pt' }}>
            1/1
          </span>
        )}
      </div>
    </div>
  );

  // Trên: mã ngắn → [hãng / mã hãng / QR / giờ in] | [mã vạch]; mã dài → dòng hãng + giờ, mã
  // vạch hết chiều ngang.
  const top = long ? (
    <div className="flex flex-col" style={{ gap: '1mm' }}>
      <div className="flex items-baseline justify-between" style={{ gap: '1mm' }}>
        <span className="truncate font-bold uppercase" style={{ fontSize: '11pt' }}>
          {carrier}
        </span>
        <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: '8.5pt' }}>
          {printed}
          <span style={{ fontSize: '11pt', marginLeft: '2mm' }}>1/1</span>
        </span>
      </div>
      {barcode(land ? '12mm' : '14mm', land ? '8.5pt' : '7.5pt')}
    </div>
  ) : (
    <div className="flex items-stretch" style={{ gap: '3mm' }}>
      <div
        className="flex shrink-0 flex-col"
        style={{ width: land ? '21mm' : '19mm', gap: '0.4mm' }}
      >
        <div className="flex items-baseline" style={{ gap: '1mm' }}>
          <span className="shrink-0 font-bold leading-none" style={{ fontSize: '11pt' }}>
            {data.carrierCode ?? carrier}
          </span>
          {data.carrierCode && data.carrierName ? (
            <span className="truncate leading-none" style={{ fontSize: '6.5pt' }}>
              {data.carrierName}
            </span>
          ) : null}
        </div>
        <div style={{ width: land ? '16mm' : '15mm', height: land ? '16mm' : '15mm' }}>
          <Barcode
            value={code}
            symbology="qrcode"
            scale={2}
            className={cn('block h-full w-full', FILL_SVG)}
            label={`QR ${code}`}
          />
        </div>
        <span
          className="whitespace-nowrap font-bold tabular-nums leading-none"
          style={{ fontSize: '7pt' }}
        >
          {printed}
        </span>
      </div>
      {barcode(land ? '15mm' : '13mm', land ? '14pt' : '11pt')}
    </div>
  );

  const recipient = (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ border: BORDER, padding: '1mm 1.2mm', gap: '0.4mm' }}
    >
      {data.recipient ? (
        <>
          <div className="flex items-center" style={{ fontSize: '8.5pt', gap: '0.8mm' }}>
            <User style={ICON} aria-hidden />
            <span className="truncate">{data.recipient.name}</span>
          </div>
          <div
            className="flex items-center font-bold tabular-nums leading-none"
            style={{ fontSize: '11pt', gap: '0.8mm' }}
          >
            <Phone style={ICON} aria-hidden />
            <span>{formatPhone(data.recipient.phone)}</span>
          </div>
          <div className="font-bold leading-tight" style={{ fontSize: '11pt', ...clamp(3) }}>
            <MapPin style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
            {data.recipient.address}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '10pt' }}>Đơn chưa có địa chỉ giao</div>
      )}
      {data.note ? (
        <div
          className="font-bold leading-tight"
          style={{
            fontSize: '9.5pt',
            borderTop: BORDER,
            paddingTop: '0.6mm',
            marginTop: 'auto',
            ...clamp(3),
          }}
        >
          <Store style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
          {data.note}
        </div>
      ) : null}
    </div>
  );

  const goods = (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ border: BORDER, padding: '1mm 1.2mm', gap: '0.6mm' }}
    >
      <div className="font-bold tabular-nums leading-none" style={{ fontSize: '11pt' }}>
        COD: {formatMoney(data.codAmount, { unit: 'đ' })}
      </div>
      <table
        className="w-full border-collapse"
        style={{ fontSize: land ? '9.5pt' : '9pt', tableLayout: 'fixed' }}
      >
        <colgroup>
          <col />
          <col style={{ width: '8mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-center font-bold" style={{ border: BORDER, padding: '0.4mm' }}>
              Sản phẩm
            </th>
            <th className="text-center font-bold" style={{ border: BORDER, padding: '0.4mm' }}>
              SL
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((it, i) => (
            <tr key={i}>
              <td
                className="font-bold leading-tight"
                style={{ border: BORDER, padding: '0.4mm 0.6mm' }}
              >
                <span style={clamp(3)}>{it.name}</span>
              </td>
              <td
                className="text-center font-bold tabular-nums"
                style={{ border: BORDER, padding: '0.4mm', fontSize: '11pt' }}
              >
                {formatQuantity(it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 ? (
        <div className="italic" style={{ fontSize: '8.5pt' }}>
          +{more} sản phẩm khác
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-waybill-label={code}
      className="bg-card text-foreground"
      style={{
        width: `${size.labelWidthMm}mm`,
        height: `${size.labelHeightMm}mm`,
        padding: '1.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden"
        style={{ border: '0.3mm dashed currentColor', padding: '1.5mm', gap: '1.5mm' }}
      >
        {top}
        <div
          className={cn(
            'grid min-h-0 flex-1 overflow-hidden',
            land ? 'grid-cols-2' : 'grid-rows-[auto_1fr]',
          )}
          style={{ gap: '1.5mm' }}
        >
          {recipient}
          {goods}
        </div>
      </div>
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
