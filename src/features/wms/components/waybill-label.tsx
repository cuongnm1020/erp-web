'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { cn } from '@/lib/cn';
import { MapPin, Phone, Store, User } from 'lucide-react';
import { formatDate, formatMoney, formatPhone, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES, type PrintController } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import { DEFAULT_PRINT_NOTE, hidePhone, maskedAddress, parseGhtkTracking } from '../ghtk-label';
import { f, labelInner, labelOuter, u } from '../label-scale';
import { GhtkWaybillLabel } from './ghtk-waybill-label';
import { GhtkWaybillLabelPortrait } from './ghtk-waybill-label-portrait';

export type WaybillOrientation = 'landscape' | 'portrait';

/** Số dòng hàng in ra; còn lại gom thành "+N sản phẩm khác" để chữ không bị thu nhỏ. */
const MAX_ITEMS = { landscape: 2, portrait: 2 } as const;

/** Khổ tem (mm) theo hướng. */
const SIZE = {
  landscape: {
    w: LABEL_SIZES.WAYBILL_100x75.labelWidthMm ?? 100,
    h: LABEL_SIZES.WAYBILL_100x75.labelHeightMm ?? 75,
  },
  portrait: {
    w: LABEL_SIZES.WAYBILL_75x100.labelWidthMm ?? 75,
    h: LABEL_SIZES.WAYBILL_75x100.labelHeightMm ?? 100,
  },
} as const;

/**
 * Mã dài hơn mức này (GHTK ~35 ký tự) cần CẢ chiều ngang tem để mỗi vạch còn ≥ ~2 chấm in
 * (203 dpi) → bỏ cột QR, mã vạch trải hết chiều ngang. Mã ngắn (VTP ~13 ký tự) giữ bố cục
 * nhãn Pancake: cột hãng + QR bên trái, mã vạch bên phải.
 */
const LONG_CODE = 16;

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const BORDER = `${u(0.3)} solid currentColor`;

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
 * Dọc (2026-10-15): thêm hàng người gửi trên ô người nhận, SĐT người nhận giữ 4 số cuối, ghi chú
 * xuống hàng cuối tem (đơn không ghi chú → câu mặc định). Ngang giữ nguyên.
 * Kích thước thiết kế tính bằng mm/pt qua `u()` / `f()` (dựng ×2 — xem `label-scale.ts`).
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
  const land = orientation === 'landscape';
  // Đơn GHTK đã có mã đúng dạng GHTK → bố cục tem GHTK (2026-10-14): dọc theo tem A6 của
  // GHTK, ngang là bản xếp gọn cho 100×75.
  const ghtk = data.carrierCode === 'GHTK' ? parseGhtkTracking(data.trackingNo) : null;
  if (ghtk && land) return <GhtkWaybillLabel data={data} ghtk={ghtk} printedAt={printedAt} />;
  if (ghtk) return <GhtkWaybillLabelPortrait data={data} ghtk={ghtk} printedAt={printedAt} />;
  const size = SIZE[orientation];
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const long = code.length > LONG_CODE;
  // Dọc + mã dài: khối mã chiếm thêm chỗ → bớt một dòng hàng.
  const max = MAX_ITEMS[orientation] - (long && !land ? 1 : 0);
  const shown = data.items.slice(0, max);
  const more = data.items.length - shown.length;
  const carrier = data.carrierName ?? data.carrierCode ?? 'Vận đơn';
  const printed = `${formatTime(printedAt)} ${formatDate(printedAt)}`;
  const note = data.note?.trim() || null;

  const barcode = (heightMm: number, textPt: number) => (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
      <div className="w-full" style={{ height: u(heightMm) }}>
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
      <div className="flex w-full items-end" style={{ marginTop: u(0.8), gap: u(1) }}>
        <span
          className={cn(
            'min-w-0 flex-1 text-center font-mono leading-none',
            long ? 'break-all font-bold' : 'tracking-wide',
          )}
          style={{ fontSize: f(textPt) }}
        >
          {code}
        </span>
        {long ? null : (
          <span className="shrink-0 font-bold leading-none" style={{ fontSize: f(11) }}>
            1/1
          </span>
        )}
      </div>
    </div>
  );

  // Trên: mã ngắn → [hãng / mã hãng / QR / giờ in] | [mã vạch]; mã dài → dòng hãng + giờ, mã
  // vạch hết chiều ngang.
  const top = long ? (
    <div className="flex flex-col" style={{ gap: u(1) }}>
      <div className="flex items-baseline justify-between" style={{ gap: u(1) }}>
        <span className="truncate font-bold uppercase" style={{ fontSize: f(11) }}>
          {carrier}
        </span>
        <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: f(8.5) }}>
          {printed}
          <span style={{ fontSize: f(11), marginLeft: u(2) }}>1/1</span>
        </span>
      </div>
      {barcode(land ? 12 : 14, land ? 8.5 : 7.5)}
    </div>
  ) : (
    <div className="flex items-stretch" style={{ gap: u(3) }}>
      <div className="flex shrink-0 flex-col" style={{ width: u(land ? 21 : 19), gap: u(0.4) }}>
        <div className="flex items-baseline" style={{ gap: u(1) }}>
          <span className="shrink-0 font-bold leading-none" style={{ fontSize: f(11) }}>
            {data.carrierCode ?? carrier}
          </span>
          {data.carrierCode && data.carrierName ? (
            <span className="truncate leading-none" style={{ fontSize: f(6.5) }}>
              {data.carrierName}
            </span>
          ) : null}
        </div>
        <div style={{ width: u(land ? 16 : 15), height: u(land ? 16 : 15) }}>
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
          style={{ fontSize: f(7) }}
        >
          {printed}
        </span>
      </div>
      {barcode(land ? 15 : 13, land ? 14 : 11)}
    </div>
  );

  const recipient = (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ border: BORDER, padding: `${u(1)} ${u(1.2)}`, gap: u(0.4) }}
    >
      {data.recipient ? (
        <>
          <div className="flex items-center" style={{ fontSize: f(8.5), gap: u(0.8) }}>
            <User style={ICON} aria-hidden />
            <span className="truncate">{data.recipient.name}</span>
          </div>
          <div
            className="flex items-center font-bold tabular-nums leading-none"
            style={{ fontSize: f(11), gap: u(0.8) }}
          >
            <Phone style={ICON} aria-hidden />
            <span>
              {land ? formatPhone(data.recipient.phone) : hidePhone(data.recipient.phone, 4)}
            </span>
          </div>
          <div className="font-bold leading-tight" style={{ fontSize: f(11), ...clamp(3) }}>
            <MapPin style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
            {data.recipient.address}
          </div>
        </>
      ) : (
        <div style={{ fontSize: f(10) }}>Đơn chưa có địa chỉ giao</div>
      )}
      {land && note ? (
        <div
          className="font-bold leading-tight"
          style={{
            fontSize: f(9.5),
            borderTop: BORDER,
            paddingTop: u(0.6),
            marginTop: 'auto',
            ...clamp(3),
          }}
        >
          <Store style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
          {note}
        </div>
      ) : null}
    </div>
  );

  // Dọc: người gửi giống tem GHTK (tên POS / SĐT đầy đủ · địa chỉ che số nhà), chữ nhỏ.
  const sender = data.sender ? (
    <div
      className="min-w-0"
      style={{ border: BORDER, padding: `${u(0.8)} ${u(1.2)}`, fontSize: f(7.5), ...clamp(2) }}
    >
      Người gửi: <b>{data.sender.name}</b> / {formatPhone(data.sender.phone)} · Đ/c:{' '}
      {maskedAddress(data.sender.street, data.sender.locality)}
    </div>
  ) : null;

  // Dọc: ghi chú ở hàng cuối tem.
  const bottomNote = (
    <div
      className="font-bold leading-tight"
      style={{ border: BORDER, padding: `${u(0.8)} ${u(1.2)}`, fontSize: f(7.5), ...clamp(2) }}
    >
      <Store style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
      {note ?? DEFAULT_PRINT_NOTE}
    </div>
  );

  const goods = (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ border: BORDER, padding: `${u(1)} ${u(1.2)}`, gap: u(0.6) }}
    >
      <div className="font-bold tabular-nums leading-none" style={{ fontSize: f(11) }}>
        COD: {formatMoney(data.codAmount, { unit: 'đ' })}
      </div>
      <table
        className="w-full border-collapse"
        style={{ fontSize: f(land ? 9.5 : 8.5), tableLayout: 'fixed' }}
      >
        <colgroup>
          <col />
          <col style={{ width: u(8) }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-center font-bold" style={{ border: BORDER, padding: u(0.4) }}>
              Sản phẩm
              {/* Ở tiêu đề để luôn thấy — dưới bảng thì bị cắt khi hàng dài */}
              {more > 0 ? (
                <>
                  {' · '}
                  <span className="italic" style={{ fontSize: f(8) }}>
                    +{more} sản phẩm khác
                  </span>
                </>
              ) : null}
            </th>
            <th className="text-center font-bold" style={{ border: BORDER, padding: u(0.4) }}>
              SL
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((it, i) => (
            <tr key={i}>
              <td
                className="font-bold leading-tight"
                style={{ border: BORDER, padding: `${u(0.4)} ${u(0.6)}` }}
              >
                <span style={clamp(land ? 3 : shown.length > 1 ? 1 : 2)}>{it.name}</span>
              </td>
              <td
                className="text-center font-bold tabular-nums"
                style={{ border: BORDER, padding: u(0.4), fontSize: f(11) }}
              >
                {formatQuantity(it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      data-waybill-label={code}
      className="overflow-hidden bg-card text-foreground"
      style={labelOuter(size.w, size.h)}
    >
      <div style={{ ...labelInner(size.w, size.h), padding: u(1.5) }}>
        <div
          className="flex h-full flex-col overflow-hidden"
          style={{ border: `${u(0.3)} dashed currentColor`, padding: u(1.5), gap: u(1.5) }}
        >
          {top}
          {land ? (
            <div
              className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden"
              style={{ gap: u(1.5) }}
            >
              {recipient}
              {goods}
            </div>
          ) : (
            <div
              className="grid min-h-0 flex-1 overflow-hidden"
              style={{
                gridTemplateRows: sender ? 'auto auto 1fr auto' : 'auto 1fr auto',
                gap: u(1.5),
              }}
            >
              {sender}
              {recipient}
              {goods}
              {bottomNote}
            </div>
          )}
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

/** Tờ in nhiều nhãn vận đơn 100×75 (in lại hàng loạt) — mỗi nhãn một trang. */
export function WaybillLabelBatchPrintSheet({
  labels,
  orientation,
  printedAt,
  printer,
}: {
  labels: ShipmentLabelData[];
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
      {labels.map((data) => (
        <div key={data.shipmentId} data-print-page>
          <WaybillLabel data={data} orientation={orientation} printedAt={printedAt} />
        </div>
      ))}
    </PrintSheet>
  );
}
