'use client';

import type { CSSProperties } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { cn } from '@/lib/cn';
import { MapPin, Phone, Store, User } from 'lucide-react';
import { formatDate, formatMoney, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES, type PrintController } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import { DEFAULT_PRINT_NOTE, hidePhone, parseGhtkTracking, routeLabel } from '../ghtk-label';
import { f, labelInner, labelOuter, u, WAYBILL_EDGE } from '../label-scale';
import { sortLabelsForPrint } from '../waybill-sort';
import { GhtkWaybillLabel } from './ghtk-waybill-label';

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
 * Địa chỉ người nhận tem dọc (2026-10-16): che số nhà → xã/phường bằng `***`, in từ quận/huyện
 * trở đi — "Thị trấn Phú Long, Huyện Hàm Thuận Bắc, Bình Thuận" → "***, Huyện Hàm Thuận Bắc,
 * Bình Thuận".
 */
function fromDistrictAddress(r: { address: string; fromDistrict: string }): string {
  if (!r.fromDistrict) return r.address ? '***' : '';
  return r.address === r.fromDistrict ? r.fromDistrict : `***, ${r.fromDistrict}`;
}

/** Cỡ chữ hàng người gửi — tem dọc dùng chung cho địa chỉ người nhận và bảng sản phẩm. */
const SENDER_PT = 7.5;

/**
 * Nhãn vận đơn ERP tự in, khổ 100×75 mm (máy in nhiệt 3 inch) — ngang hoặc dọc. Bố cục theo
 * nhãn in từ Pancake (2026-10-14): viền đứt; trên = hãng + mã hãng + QR + giờ in | mã vạch + mã
 * vận đơn + số kiện; dưới = ô người nhận (tên, SĐT, địa chỉ chữ lớn, ghi chú in) | ô COD + bảng
 * Sản phẩm / SL. Hãng chưa cấp vận đơn → in mã phiếu giao thay thế để kho vẫn dán được kiện.
 * 2026-10-15 (ngang + dọc): thêm hàng người gửi trên ô người nhận, SĐT người nhận giữ 4 số cuối,
 * ghi chú xuống hàng cuối tem (đơn không ghi chú → câu mặc định).
 * 2026-10-16 (dọc): địa chỉ người nhận chỉ in từ xã/phường trở đi; địa chỉ + bảng sản phẩm cùng
 * cỡ chữ với hàng người gửi (`SENDER_PT`).
 * 2026-10-28: người gửi chỉ còn tên page Facebook; lề trên / phải bù `WAYBILL_EDGE`.
 * Kích thước thiết kế tính bằng mm/pt qua `u()` / `f()` (dựng ×2 — xem `label-scale.ts`).
 */
export function WaybillLabel({
  data,
  orientation,
  printedAt,
  seq,
}: {
  data: ShipmentLabelData;
  orientation: WaybillOrientation;
  printedAt: Date;
  /** Số thứ tự tem trong lô in (2026-10-31) — "3/50" cạnh giờ in; in lẻ thì bỏ. */
  seq?: { index: number; total: number };
}) {
  const land = orientation === 'landscape';
  // Đơn GHTK đã có mã đúng dạng GHTK: ngang → tem GHTK xếp gọn 100×75 (2026-10-14); dọc →
  // cùng khung tem dọc chung (2026-10-16), mã vạch mang đoạn số cuối + in mã phân loại.
  const ghtk = data.carrierCode === 'GHTK' ? parseGhtkTracking(data.trackingNo) : null;
  if (ghtk && land) {
    return <GhtkWaybillLabel data={data} ghtk={ghtk} printedAt={printedAt} seq={seq} />;
  }
  const seqText = seq ? `#${seq.index}/${seq.total}` : null;
  const size = SIZE[orientation];
  const code = data.trackingNo ?? data.shipmentDocNumber;
  /** Giá trị mã vạch: GHTK quét đoạn số cuối, hãng khác quét cả mã. */
  const barValue = ghtk?.shortCode ?? code;
  const long = barValue.length > LONG_CODE;
  // Tuyến GHTK (NỘI TỈNH / NỘI MIỀN / LIÊN MIỀN) in cạnh COD — ERP tự suy từ tỉnh.
  const route = ghtk ? routeLabel(data.sender?.province, data.recipient?.province) : null;
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
          value={barValue}
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
          style={{ fontSize: f(ghtk ? 9 : textPt) }}
        >
          {barValue}
        </span>
        {ghtk ? (
          // Mã phân loại GHTK: đoạn đầu nền đen
          <span
            className="shrink-0 whitespace-nowrap font-extrabold leading-none"
            style={{ fontSize: f(ghtk.sortCode.length > 9 ? 9 : 11) }}
          >
            <span
              className="bg-foreground text-background"
              style={{ padding: `${u(0.3)} ${u(0.6)}` }}
            >
              {ghtk.sortHead}
            </span>
            {ghtk.sortTail}
          </span>
        ) : long ? null : (
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
          <span style={{ fontSize: f(11), marginLeft: u(2) }}>{seqText ?? '1/1'}</span>
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
        <div style={{ width: u(land ? 12 : 15), height: u(land ? 12 : 15) }}>
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
        {seqText ? (
          <span className="font-extrabold tabular-nums leading-none" style={{ fontSize: f(10) }}>
            {seqText}
          </span>
        ) : null}
      </div>
      {barcode(land ? 11 : 13, land ? 12 : 11)}
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
            <span>{hidePhone(data.recipient.phone, 4)}</span>
          </div>
          <div
            className="font-bold leading-tight"
            style={{ fontSize: f(land ? 11 : SENDER_PT), ...clamp(3) }}
          >
            <MapPin style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
            {land ? data.recipient.address : fromDistrictAddress(data.recipient)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: f(10) }}>Đơn chưa có địa chỉ giao</div>
      )}
    </div>
  );

  // Người gửi (2026-10-28): chỉ in tên page Facebook của đơn — ẩn tên POS, SĐT, địa chỉ kho.
  // Đơn không có page → bỏ hẳn hàng người gửi.
  const sender = data.facebookPageName ? (
    <div
      className="min-w-0 shrink-0"
      style={{
        border: BORDER,
        padding: `${u(0.8)} ${u(1.2)}`,
        fontSize: f(SENDER_PT),
        ...clamp(1),
      }}
    >
      Người gửi: <b>{data.facebookPageName}</b>
    </div>
  ) : null;

  // Ghi chú ở hàng cuối tem.
  const bottomNote = (
    <div
      className="shrink-0 font-bold leading-tight"
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
      <div
        className="flex items-baseline justify-between font-bold leading-none"
        style={{ fontSize: f(11), gap: u(1) }}
      >
        <span className="tabular-nums">COD: {formatMoney(data.codAmount, { unit: 'đ' })}</span>
        {route ? <span className="shrink-0 font-extrabold">{route}</span> : null}
      </div>
      {data.carrierCode === 'VNPOST' ? (
        // Mã đơn hàng đã gửi VNPost (`saleOrderCode` = mã phiếu giao) — bưu cục tra theo mã này.
        <div className="truncate font-bold leading-none" style={{ fontSize: f(SENDER_PT) }}>
          Mã đơn hàng: {data.shipmentDocNumber}
        </div>
      ) : null}
      <table
        className="w-full border-collapse"
        style={{ fontSize: f(land ? 9.5 : SENDER_PT), tableLayout: 'fixed' }}
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
                  <span className="italic" style={{ fontSize: f(land ? 8 : SENDER_PT) }}>
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
                <span style={clamp(shown.length > 1 ? 1 : land ? 3 : 2)}>{it.name}</span>
              </td>
              <td
                className="text-center font-bold tabular-nums"
                style={{ border: BORDER, padding: u(0.4), fontSize: f(land ? 11 : SENDER_PT) }}
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
      <div
        style={{
          ...labelInner(size.w, size.h),
          padding: `${u(1.5 + WAYBILL_EDGE.top)} ${u(1.5 + WAYBILL_EDGE.right)} ${u(1.5)} ${u(1.5)}`,
        }}
      >
        <div
          className="flex h-full flex-col overflow-hidden"
          style={{ border: `${u(0.3)} dashed currentColor`, padding: u(1.5), gap: u(1.5) }}
        >
          {top}
          {sender}
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
              style={{ gridTemplateRows: 'auto 1fr', gap: u(1.5) }}
            >
              {recipient}
              {goods}
            </div>
          )}
          {bottomNote}
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

/**
 * Tờ in nhiều nhãn vận đơn 100×75 (in lại hàng loạt) — mỗi nhãn một trang, xếp theo
 * `sortLabelsForPrint` (abc tên sản phẩm, đơn ít sản phẩm trước — 2026-10-28).
 */
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
      {sortLabelsForPrint(labels).map((data, i, all) => (
        <div key={data.shipmentId} data-print-page>
          <WaybillLabel
            data={data}
            orientation={orientation}
            printedAt={printedAt}
            // Lô từ 2 tem: in số thứ tự "x/N" theo đúng thứ tự in (2026-10-31).
            seq={all.length > 1 ? { index: i + 1, total: all.length } : undefined}
          />
        </div>
      ))}
    </PrintSheet>
  );
}
