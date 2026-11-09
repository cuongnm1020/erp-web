'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { PrintSheet } from '@/components/data/print-sheet';
import { cn } from '@/lib/cn';
import { MapPin, Phone, Store, User } from 'lucide-react';
import { formatDate, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES, type PrintController } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import {
  DEFAULT_PRINT_NOTE,
  hidePhone,
  labelRecipientAddress,
  parseGhtkTracking,
  routeLabel,
} from '../ghtk-label';
import { f, labelInner, labelOuter, u, WAYBILL_EDGE } from '../label-scale';
import { estimateLines, fitItems } from '../label-text';
import { sortLabelsForPrint } from '../waybill-sort';
import { LandscapeWaybillLabel } from './landscape-waybill-label';

export type WaybillOrientation = 'landscape' | 'portrait';

/** Khổ tem dọc (mm). */
const SIZE = {
  w: LABEL_SIZES.WAYBILL_75x100.labelWidthMm ?? 75,
  h: LABEL_SIZES.WAYBILL_75x100.labelHeightMm ?? 100,
} as const;

/**
 * Chiều cao (mm thiết kế) các khối cố định trên tem dọc — để tính số dòng hàng vừa ô Sản phẩm.
 * Đo bằng getBoundingClientRect trên tem dựng ở Chrome 2026-11-04 (khớp kích thước khai trong
 * JSX bên dưới); đổi padding / gap / cỡ chữ ở JSX thì đo và sửa lại số ở đây. Tem in ẩn
 * (`display: none`) nên lúc in không đo DOM được — phải tính trước.
 */
const PORTRAIT_MM = {
  /** Trong viền đứt: tem − lề ngoài (trên bù WAYBILL_EDGE) − viền + padding khung. */
  content: SIZE.h - (1.5 + WAYBILL_EDGE.top) - 1.5 - 0.6 - 3,
  /** 3 khoảng cách 1,5 mm: trên–lưới, lưới–ghi chú, người nhận–sản phẩm. */
  gaps: 4.5,
  /** Khối trên mã ngắn: hãng + QR 15 mm + giờ in; mã dài: dòng hãng + mã vạch 14 mm + mã 2 dòng. */
  topShort: 22.2,
  topLong: 27,
  /** "#x/N" dưới giờ in (chỉ bố cục mã ngắn; mã dài in chung dòng hãng). */
  seq: 3.95,
  /** Hàng người gửi + khoảng cách. */
  sender: 5.6 + 1.5,
  /** Ô người nhận với địa chỉ 1 dòng; mỗi dòng địa chỉ thêm. */
  recipient: 13.7,
  addressLine: 3.45,
  /** Ô ghi chú cuối tem (2 dòng). */
  note: 9.05,
  /** Ô sản phẩm trừ các dòng hàng: viền + padding + "Thu *** đ" + tiêu đề bảng. */
  goodsHead: 9.5,
  /** Dòng "Mã đơn hàng" VNPost. */
  vnpost: 3.3,
  /** Một dòng chữ 7,5 pt × line-height 1,3 (tên sản phẩm, địa chỉ). */
  line: 3.45,
  /** Phần cố định mỗi hàng sản phẩm ngoài chữ: padding + viền (hàng 1 dòng = 4,5 mm). */
  rowExtra: 1.05,
  /** Bề ngang chữ cột tên sản phẩm (cột 55,3 mm trừ padding). */
  nameWidth: 54,
  /** Bề ngang chữ địa chỉ người nhận (ô 63,4 mm trừ padding + biểu tượng). */
  addressWidth: 59,
  /** Dự phòng làm tròn để viền dòng cuối không bị xén. */
  slack: 0.5,
} as const;

/**
 * Chỗ trống (mm) dành cho các dòng hàng trên tem dọc (2026-11-04). Trước đây khóa cứng 2 dòng →
 * đơn 4–5 món bị gom "+N sản phẩm khác" dù nửa dưới tem trống (kho báo lỗi nghiêm trọng: không
 * in hết danh sách). Ô Sản phẩm là phần co giãn (grid 1fr) nên chỗ trống = chiều cao trong
 * viền đứt − các khối cố định. Số món in được: `fitItems` (tên in đủ, mỗi tên có thể nhiều
 * dòng); vượt quá vẫn báo "+N sản phẩm khác" ở tiêu đề bảng.
 */
export function portraitGoodsMm(opts: {
  longCode: boolean;
  seq: boolean;
  sender: boolean;
  vnpost: boolean;
  addressLines: number;
}): number {
  const m = PORTRAIT_MM;
  let used = m.gaps + m.note + m.goodsHead + m.recipient + m.slack;
  used += opts.longCode ? m.topLong : m.topShort + (opts.seq ? m.seq : 0);
  if (opts.sender) used += m.sender;
  if (opts.vnpost) used += m.vnpost;
  used += Math.max(0, Math.min(3, opts.addressLines) - 1) * m.addressLine;
  return m.content - used;
}

/** Số món in được trên tem dọc với chỗ trống `availableMm` — tên in đủ, không cắt. */
export function portraitItemCount(items: { name: string }[], availableMm: number): number {
  const m = PORTRAIT_MM;
  return fitItems(items, {
    availableMm,
    lineMm: m.line,
    rowExtraMm: m.rowExtra,
    pt: SENDER_PT,
    widthMm: m.nameWidth,
  });
}

/**
 * Tờ in tiếp (2026-11-05): dòng "Tiếp theo · mã · Tờ x/N" + ô bảng sản phẩm (viền + padding +
 * tiêu đề bảng). Không mã vạch / người nhận / Thu — tờ tiếp không phải phiếu giao thứ hai.
 */
const CONT_MM = {
  /** Dòng tiêu đề tờ tiếp (9 pt, leading-none) + khoảng cách 1,5 mm. */
  head: 4.2 + 1.5,
  /** Ô sản phẩm trừ các dòng hàng: viền + padding + tiêu đề bảng. */
  goodsHead: 6.5,
} as const;

/**
 * Chia tờ tem dọc (user chốt 2026-11-05): vừa một tờ (kể cả ghi chú) → một tờ như cũ. Không vừa →
 * tờ 1 = phiếu đầy đủ KHÔNG ghi chú (thêm chỗ cho hàng), các tờ sau = tờ in tiếp chỉ có bảng sản
 * phẩm; ghi chú in MỘT lần cuối tờ cuối. Hàng cuối vừa tờ tiếp nhưng không còn chỗ cho ghi chú
 * → thêm một tờ chỉ có ghi chú.
 */
export function portraitPages<T extends { name: string }>(items: T[], goodsMm: number): T[][] {
  if (items.length === 0 || portraitItemCount(items, goodsMm) >= items.length) return [items];
  const m = PORTRAIT_MM;
  const noteMm = m.note + 1.5;
  const contMm = m.content - CONT_MM.head - CONT_MM.goodsHead - m.slack;
  // Tờ không còn chỗ ghi chú mà lại vừa hết hàng → chừa món cuối sang tờ sau để tờ cuối có hàng
  // + ghi chú (không in tờ chỉ có ghi chú). Chỉ còn 1 món mà không vừa cùng ghi chú → tờ ghi chú.
  const take = (count: number, total: number) =>
    Math.max(1, total > 1 ? Math.min(count, total - 1) : count);
  const first = take(portraitItemCount(items, goodsMm + noteMm), items.length);
  const pages: T[][] = [items.slice(0, first)];
  let rest = items.slice(first);
  while (rest.length > 0) {
    if (portraitItemCount(rest, contMm - noteMm) >= rest.length) {
      pages.push(rest);
      return pages;
    }
    const n = rest.length > 1 ? take(portraitItemCount(rest, contMm), rest.length) : 1;
    pages.push(rest.slice(0, n));
    rest = rest.slice(n);
  }
  pages.push([]);
  return pages;
}

/** Ước lượng số dòng địa chỉ người nhận (cắt 3 dòng ở JSX). */
export function estimateAddressLines(address: string): number {
  return estimateLines(address, SENDER_PT, PORTRAIT_MM.addressWidth);
}

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

/** Cỡ chữ hàng người gửi — tem dọc dùng chung cho địa chỉ người nhận và bảng sản phẩm. */
const SENDER_PT = 7.5;

/**
 * Nhãn vận đơn ERP tự in, khổ 100×75 mm (máy in nhiệt 3 inch). NGANG (mọi hãng) → bố cục tem
 * GHTK ở `LandscapeWaybillLabel` (2026-11-04). Phần dưới đây là tem DỌC 75×100: bố cục theo
 * nhãn in từ Pancake (2026-10-14): viền đứt; trên = hãng + mã hãng + QR + giờ in | mã vạch + mã
 * vận đơn + số kiện; dưới = ô người nhận (tên, SĐT, địa chỉ chữ lớn, ghi chú in) | ô COD + bảng
 * Sản phẩm / SL. Hãng chưa cấp vận đơn → in mã phiếu giao thay thế để kho vẫn dán được kiện.
 * 2026-10-15: thêm hàng người gửi trên ô người nhận, SĐT người nhận giữ 4 số cuối, ghi chú
 * xuống hàng cuối tem (đơn không ghi chú → câu mặc định).
 * 2026-10-16: địa chỉ người nhận chỉ in từ xã/phường trở đi; địa chỉ + bảng sản phẩm cùng cỡ
 * chữ với hàng người gửi (`SENDER_PT`). GHTK dọc cùng khung này: mã vạch đoạn số cuối + mã phân
 * loại + tuyến cạnh COD.
 * 2026-10-28: người gửi chỉ còn tên page Facebook; lề trên / phải bù `WAYBILL_EDGE`.
 * 2026-11-09: địa chỉ người nhận theo `labelRecipientAddress` — địa chỉ mới in thôn + xã + tỉnh,
 * địa chỉ cũ in xã + huyện + tỉnh; phần chi tiết hơn che `***` (cả tem ngang).
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
  // Đơn GHTK đã có mã đúng dạng GHTK: mã vạch mang đoạn số cuối + in mã phân loại.
  const ghtk = data.carrierCode === 'GHTK' ? parseGhtkTracking(data.trackingNo) : null;
  if (orientation === 'landscape') {
    return <LandscapeWaybillLabel data={data} ghtk={ghtk} printedAt={printedAt} seq={seq} />;
  }
  const seqText = seq ? `#${seq.index}/${seq.total}` : null;
  const size = SIZE;
  const code = data.trackingNo ?? data.shipmentDocNumber;
  /** Giá trị mã vạch: GHTK quét đoạn số cuối, hãng khác quét cả mã. */
  const barValue = ghtk?.shortCode ?? code;
  const long = barValue.length > LONG_CODE;
  // Tuyến GHTK (NỘI TỈNH / NỘI MIỀN / LIÊN MIỀN) in cạnh COD — ERP tự suy từ tỉnh.
  const route = ghtk ? routeLabel(data.sender?.province, data.recipient?.province) : null;
  // Tên in đủ không cắt; hết chỗ ô Sản phẩm thì in tiếp sang tờ mới (user chốt 2026-11-04).
  // 2026-11-05: tờ sau là TỜ IN TIẾP (chỉ bảng sản phẩm), ghi chú cuối tờ cuối — `portraitPages`.
  const goodsMm = portraitGoodsMm({
    longCode: long,
    seq: seq != null,
    sender: !!data.facebookPageName,
    vnpost: data.carrierCode === 'VNPOST',
    addressLines: data.recipient ? estimateAddressLines(labelRecipientAddress(data.recipient)) : 1,
  });
  const pages = portraitPages(data.items, goodsMm);
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
      {barcode(14, 7.5)}
    </div>
  ) : (
    <div className="flex items-stretch" style={{ gap: u(3) }}>
      <div className="flex shrink-0 flex-col" style={{ width: u(19), gap: u(0.4) }}>
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
        <div style={{ width: u(15), height: u(15) }}>
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
      {barcode(13, 11)}
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
          <div className="font-bold leading-tight" style={{ fontSize: f(SENDER_PT), ...clamp(3) }}>
            <MapPin style={{ ...ICON, display: 'inline', verticalAlign: '-0.1em' }} aria-hidden />{' '}
            {labelRecipientAddress(data.recipient)}
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

  const table = (pageItems: ShipmentLabelData['items'], pageNo: number) =>
    pageItems.length === 0 ? null : (
      <table
        className="w-full border-collapse"
        style={{ fontSize: f(SENDER_PT), tableLayout: 'fixed' }}
      >
        <colgroup>
          <col />
          <col style={{ width: u(8) }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-center font-bold" style={{ border: BORDER, padding: u(0.4) }}>
              {pageNo > 1
                ? 'Sản phẩm (tiếp)'
                : pages.length > 1
                  ? `Sản phẩm · Tờ 1/${pages.length}`
                  : 'Sản phẩm'}
            </th>
            <th className="text-center font-bold" style={{ border: BORDER, padding: u(0.4) }}>
              SL
            </th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((it, i) => (
            <tr key={i}>
              {/* Tên in đủ, xuống dòng (user chốt 2026-11-04) — số món đã tính theo số dòng */}
              <td
                className="font-bold"
                style={{ border: BORDER, padding: `${u(0.4)} ${u(0.6)}`, lineHeight: 1.3 }}
              >
                {it.name}
              </td>
              <td
                className="text-center font-bold tabular-nums"
                style={{ border: BORDER, padding: u(0.4), fontSize: f(SENDER_PT) }}
              >
                {formatQuantity(it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  const goods = (pageItems: ShipmentLabelData['items']) => (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ border: BORDER, padding: `${u(1)} ${u(1.2)}`, gap: u(0.6) }}
    >
      <div
        className="flex items-baseline justify-between font-bold leading-none"
        style={{ fontSize: f(11), gap: u(1) }}
      >
        {/* Che số tiền thu hộ trên tem (2026-11-03, user chốt) — shipper / hãng đã có COD trong
            vận đơn; tem dán ngoài kiện không lộ giá trị hàng. */}
        <span>Thu *** đ</span>
        {route ? <span className="shrink-0 font-extrabold">{route}</span> : null}
      </div>
      {data.carrierCode === 'VNPOST' ? (
        // Mã đơn hàng đã gửi VNPost (`saleOrderCode` = mã phiếu giao) — bưu cục tra theo mã này.
        <div className="truncate font-bold leading-none" style={{ fontSize: f(SENDER_PT) }}>
          Mã đơn hàng: {data.shipmentDocNumber}
        </div>
      ) : null}
      {table(pageItems, 1)}
    </div>
  );

  const last = pages.length;
  const frame = (key: number, children: ReactNode) => (
    <div
      key={key}
      data-print-page
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
          {children}
        </div>
      </div>
    </div>
  );

  // Mỗi tờ một [data-print-page] (ngắt trang khi in) — tờ in không bọc thêm. Tờ 1 = phiếu giao;
  // tờ sau = tờ in tiếp: chỉ mã vận đơn + "Tờ x/N" + bảng sản phẩm, ghi chú cuối tờ cuối.
  return (
    <>
      {frame(
        0,
        <>
          {top}
          {sender}
          <div
            className="grid min-h-0 flex-1 overflow-hidden"
            style={{ gridTemplateRows: 'auto 1fr', gap: u(1.5) }}
          >
            {recipient}
            {goods(pages[0]!)}
          </div>
          {last === 1 ? bottomNote : null}
        </>,
      )}
      {pages.slice(1).map((pageItems, i) =>
        frame(
          i + 1,
          <>
            <div
              className="flex shrink-0 items-baseline justify-between font-bold leading-none"
              style={{ fontSize: f(9), gap: u(1) }}
            >
              <span className="min-w-0 truncate">Tiếp theo · {code}</span>
              <span className="shrink-0">
                Tờ {i + 2}/{last}
              </span>
            </div>
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              style={{ border: BORDER, padding: `${u(1)} ${u(1.2)}` }}
            >
              {table(pageItems, i + 2)}
            </div>
            {i + 2 === last ? bottomNote : null}
          </>,
        ),
      )}
    </>
  );
}

/**
 * Tờ in một nhãn vận đơn 100×75 — `@page` theo hướng đã chọn. `WaybillLabel` tự đánh dấu
 * từng tờ `[data-print-page]` (đơn nhiều món in nhiều tờ — 2026-11-04).
 */
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
      <WaybillLabel data={data} orientation={orientation} printedAt={printedAt} />
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
        <WaybillLabel
          key={data.shipmentId}
          data={data}
          orientation={orientation}
          printedAt={printedAt}
          // Lô từ 2 tem: in số thứ tự "x/N" theo đúng thứ tự in (2026-10-31).
          seq={all.length > 1 ? { index: i + 1, total: all.length } : undefined}
        />
      ))}
    </PrintSheet>
  );
}
