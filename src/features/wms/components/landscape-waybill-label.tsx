'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import {
  DEFAULT_PRINT_NOTE,
  type GhtkTracking,
  hidePhone,
  labelRecipientAddress,
  printNote,
  routeLabel,
} from '../ghtk-label';
// Dựng ×2 rồi thu về — chống cài đặt "cỡ chữ tối thiểu" của Chrome (xem label-scale.ts).
import { f, labelInner, labelOuter, u, WAYBILL_EDGE } from '../label-scale';
import { fitItems } from '../label-text';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = `${u(0.35)} solid currentColor`;

/**
 * Ô sản phẩm (sau hàng Mã đơn KH, trước hàng ghi chú) đo 16,5 mm trên Chrome 2026-11-04: đo
 * thực tế còn 12,78 mm cho các hàng sau tiêu đề 3,2 mm (padding dọc 0 — trước 0,5 mm làm 4
 * hàng 7 pt bị xén 1 mm). 4 hàng 7 pt = 4 × 3,21 = 12,84 → lấy 12,85 (lệch 0,06 mm không thấy).
 * Tên in ĐỦ không cắt (user chốt 2026-11-04): số món mỗi tờ tính theo số dòng mỗi tên
 * (`fitItems`); hết chỗ thì in tiếp sang tờ mới (`chunkItems`).
 */
const GOODS_MM = { rows: 12.85, nameWidth: 55 } as const;
/** Cả danh sách vừa MỘT tờ ở 8 pt (tên 2 dòng được) thì in 8 pt, cách hàng 0,5 mm; không thì 7 pt sát. */
const FONT = {
  large: { pt: 8, lineMm: 3.67, gapMm: 0.5 },
  small: { pt: 7, lineMm: 3.21, gapMm: 0 },
} as const;

/**
 * Tờ in tiếp tem ngang (2026-11-05): trong viền (75 − lề trên 3,5 − lề dưới 1,5 − viền 0,7 =
 * 69,3 mm) trừ dòng tiêu đề 6 mm, tiêu đề bảng 3,2 mm, dự phòng 1 mm; hàng ghi chú 4,6 mm.
 */
const CONT_MM = { rows: 59.1, note: 4.6 } as const;

/**
 * Chia món ra các tờ và chọn cỡ chữ cho ô sản phẩm tem ngang. Vừa một tờ → một tờ như cũ. Không
 * vừa (user chốt 2026-11-05): tờ 1 = tem đầy đủ không ghi chú, tờ sau = tờ in tiếp chỉ có danh
 * sách sản phẩm, ghi chú in một lần cuối tờ cuối (hết hàng ở tờ không còn chỗ → thêm tờ chỉ ghi chú).
 */
export function landscapePages<T extends { name: string }>(
  items: T[],
): { pages: T[][]; pt: 7 | 8 } {
  const large = fitItems(items, {
    availableMm: GOODS_MM.rows + FONT.large.gapMm,
    lineMm: FONT.large.lineMm,
    rowExtraMm: FONT.large.gapMm,
    pt: FONT.large.pt,
    widthMm: GOODS_MM.nameWidth,
  });
  if (large >= items.length) return { pages: [items], pt: 8 };
  const fit = (rest: T[], availableMm: number) =>
    Math.max(
      1,
      fitItems(rest, {
        availableMm,
        lineMm: FONT.small.lineMm,
        rowExtraMm: FONT.small.gapMm,
        pt: FONT.small.pt,
        widthMm: GOODS_MM.nameWidth,
      }),
    );
  const first = fit(items, GOODS_MM.rows);
  if (first >= items.length) return { pages: [items], pt: 7 };
  const pages: T[][] = [items.slice(0, first)];
  let rest = items.slice(first);
  while (rest.length > 0) {
    if (fit(rest, CONT_MM.rows - CONT_MM.note) >= rest.length) {
      pages.push(rest);
      return { pages, pt: 7 };
    }
    // Vừa hết hàng mà không còn chỗ ghi chú → chừa món cuối sang tờ sau (tờ cuối có hàng + ghi chú).
    const n = rest.length > 1 ? Math.min(fit(rest, CONT_MM.rows), rest.length - 1) : 1;
    pages.push(rest.slice(0, n));
    rest = rest.slice(n);
  }
  pages.push([]);
  return { pages, pt: 7 };
}

const clamp = (lines: number): CSSProperties => ({
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function Caption({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: f(6.5) }}>{children}</span>;
}

/**
 * Tem vận đơn ERP tự in khổ 100×75 NGANG, mọi hãng — bố cục theo tem GHTK (user chốt 2026-11-04):
 *
 *   hãng | giờ in | tuyến (GHTK) / số kiện
 *   mã vạch to + số                        | mã phân loại GHTK (đoạn đầu nền đen) / mã hãng; #x/N
 *   người gửi (page FB) / người nhận | thu hộ | kho lấy / giao tới
 *   Mã đơn KH                              | QR mã đầy đủ
 *   Sản phẩm / SL (hết bề ngang cột trái)  |
 *   Ghi chú một hàng (các ý nối " · ")     |
 *
 * GHTK: mã vạch mang đoạn số cuối của mã GHTK (app GHTK quét đoạn này), QR mã đầy đủ. Hãng khác:
 * mã vạch + QR cả mã; chưa có mã → mã phiếu giao để kho vẫn dán được kiện. Không in khối lượng,
 * kho giao của hãng (ERP không có), EXPRESS, biểu tượng hàng. Thu hộ che số tiền (2026-11-03),
 * SĐT người nhận giữ 4 số cuối, che số nhà; người gửi chỉ tên page Facebook (2026-10-28).
 */
export function LandscapeWaybillLabel({
  data,
  ghtk,
  printedAt,
  seq,
}: {
  data: ShipmentLabelData;
  /** Mã GHTK đã tách (đơn GHTK có mã đúng dạng); null = tem hãng khác / chưa có mã. */
  ghtk: GhtkTracking | null;
  printedAt: Date;
  /** Số thứ tự tem trong lô in (2026-10-31); in lẻ thì bỏ. */
  seq?: { index: number; total: number };
}) {
  const W = LABEL_SIZES.WAYBILL_100x75.labelWidthMm ?? 100;
  const H = LABEL_SIZES.WAYBILL_100x75.labelHeightMm ?? 75;
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const barValue = ghtk?.shortCode ?? code;
  const note = (printNote(data) ?? DEFAULT_PRINT_NOTE).split('\n').join(' · ');
  // Tên in đủ (xuống dòng); hết chỗ ô sản phẩm thì sang tờ mới — xem `landscapePages`.
  const { pages, pt } = landscapePages(data.items);
  const many = pt === 7;
  const route = ghtk ? routeLabel(data.sender?.province, data.recipient?.province) : null;
  const printed = `${formatDate(printedAt)} ${formatTime(printedAt).replace(':', 'h')}`;
  const carrier = ghtk ? 'GHTK' : (data.carrierName ?? data.carrierCode ?? 'Vận đơn');
  const destination = data.recipient?.fromDistrict || data.recipient?.province || null;

  const noteRow = (
    <div
      className="truncate whitespace-nowrap"
      style={{ borderTop: LINE, padding: `${u(0.6)} ${u(1.5)}`, fontSize: f(7) }}
    >
      <span className="font-bold">Ghi chú: </span>
      {note}
    </div>
  );

  const itemRows = (pageItems: ShipmentLabelData['items']) =>
    pageItems.map((it, i) => (
      <div key={i} className="flex shrink-0 items-start" style={{ gap: u(2) }}>
        <span className="min-w-0 flex-1 font-semibold" style={{ lineHeight: 1.3 }}>
          {it.name}
        </span>
        <span className="shrink-0 font-bold tabular-nums" style={{ lineHeight: 1.3 }}>
          {formatQuantity(it.qty)}
        </span>
      </div>
    ));

  /**
   * Tờ in tiếp (2026-11-05): KHÔNG phải tem thứ hai — chỉ "Tiếp theo · mã · Tờ x/N", danh sách
   * sản phẩm còn lại, ghi chú ở tờ cuối.
   */
  const continuation = (pageItems: ShipmentLabelData['items'], pageNo: number) => (
    <div
      data-print-page
      data-waybill-label={code}
      className="overflow-hidden bg-card text-foreground"
      style={labelOuter(W, H)}
    >
      <div
        style={{
          ...labelInner(W, H),
          padding: `${u(1.5 + WAYBILL_EDGE.top)} ${u(2 + WAYBILL_EDGE.right)} ${u(1.5)} ${u(2)}`,
        }}
      >
        <div
          className="grid h-full overflow-hidden"
          style={{
            border: LINE,
            gridTemplateRows: `${u(6)} minmax(0, 1fr) auto`,
            fontSize: f(7),
            lineHeight: 1.3,
          }}
        >
          <div
            className="flex items-center justify-between whitespace-nowrap font-bold"
            style={{ borderBottom: LINE, padding: `0 ${u(1.5)}`, gap: u(2), fontSize: f(9) }}
          >
            <span className="min-w-0 truncate">Tiếp theo · {code}</span>
            <span className="shrink-0">
              Tờ {pageNo}/{pages.length}
            </span>
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden" style={{ padding: `0 ${u(1.5)}` }}>
            {pageItems.length ? (
              <div className="flex shrink-0 justify-between font-bold" style={{ lineHeight: 1.3 }}>
                <span>Sản phẩm (tiếp)</span>
                <span>SL</span>
              </div>
            ) : null}
            {itemRows(pageItems)}
          </div>
          {pageNo === pages.length ? noteRow : <div />}
        </div>
      </div>
    </div>
  );

  // Mỗi tờ một [data-print-page] (ngắt trang khi in) — tờ in không bọc thêm.
  const page = (pageItems: ShipmentLabelData['items'], pageNo: number) => (
    <div
      data-print-page
      data-waybill-label={code}
      className="overflow-hidden bg-card text-foreground"
      style={labelOuter(W, H)}
    >
      <div
        style={{
          ...labelInner(W, H),
          padding: `${u(1.5 + WAYBILL_EDGE.top)} ${u(2 + WAYBILL_EDGE.right)} ${u(1.5)} ${u(2)}`,
        }}
      >
        <div
          className="grid h-full overflow-hidden"
          style={{
            border: LINE,
            gridTemplateColumns: '66fr 34fr',
            gridTemplateRows: `${u(6)} ${u(15)} ${u(21)} minmax(0, 1fr)`,
            fontSize: f(7),
            lineHeight: 1.3,
          }}
        >
          {/* Hàng 1: hãng | giờ in | tuyến (GHTK) hoặc số kiện */}
          <div
            className="col-span-2 flex items-center justify-between whitespace-nowrap"
            style={{ borderBottom: LINE, padding: `0 ${u(1.5)}`, gap: u(2) }}
          >
            <span
              className="truncate font-black uppercase leading-none"
              style={{ fontSize: f(12) }}
            >
              {carrier}
            </span>
            <span className="leading-none" style={{ fontSize: f(6.5) }}>
              In <span className="tabular-nums">{printed}</span>
            </span>
            <span className="font-black leading-none" style={{ fontSize: f(10) }}>
              {route ?? (ghtk ? '' : '1/1')}
            </span>
          </div>

          {/* Hàng 2: mã vạch to + số | mã phân loại GHTK (hoặc mã hãng) + #x/N */}
          <div
            className="flex flex-col items-center justify-center"
            style={{ borderBottom: LINE, padding: `${u(1)} ${u(1.5)} ${u(0.8)}`, gap: u(0.6) }}
          >
            <div className="w-full" style={{ height: u(9) }}>
              {/* height thấp → SVG bè ngang, vạch trải hết cột như tem GHTK */}
              <Barcode
                value={barValue}
                symbology="code128"
                height={4.5}
                scale={2}
                showText={false}
                className={cn('block h-full w-full', FILL_SVG)}
                label={`Mã vận đơn ${code}`}
              />
            </div>
            <span
              className={cn(
                'max-w-full font-mono font-bold leading-none tracking-wide',
                barValue.length > 16 && 'break-all text-center',
              )}
              style={{ fontSize: f(barValue.length > 16 ? 8 : 11) }}
            >
              {barValue}
            </span>
          </div>
          <div
            className="flex flex-col items-center justify-center"
            style={{ borderBottom: LINE, borderLeft: LINE, padding: `0 ${u(1)}`, gap: u(1.5) }}
          >
            <span
              className="whitespace-nowrap font-black leading-none"
              style={{ fontSize: f(ghtk && ghtk.sortCode.length > 9 ? 12 : 14) }}
            >
              <span
                className="bg-foreground text-background"
                style={{ padding: `${u(0.3)} ${u(0.8)}` }}
              >
                {ghtk ? ghtk.sortHead : (data.carrierCode ?? 'ERP')}
              </span>
              {ghtk?.sortTail}
            </span>
            {seq ? (
              <span className="font-black tabular-nums leading-none" style={{ fontSize: f(9) }}>
                #{seq.index}/{seq.total}
              </span>
            ) : null}
          </div>

          {/* Hàng 3: người gửi / người nhận + thu hộ | kho lấy / giao tới */}
          <div
            className="grid min-w-0"
            style={{
              borderBottom: LINE,
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              padding: `${u(0.6)} ${u(1.5)}`,
              gap: u(1.5),
            }}
          >
            <div
              className="flex min-w-0 flex-col justify-center"
              style={{ gap: u(0.6), lineHeight: 1.25 }}
            >
              {/* 2026-10-28: người gửi chỉ in tên page Facebook — ẩn mã shop, tên, SĐT, địa chỉ. */}
              {data.facebookPageName ? (
                <div className="min-w-0">
                  <div>
                    <Caption>Người gửi</Caption>
                  </div>
                  <div className="truncate font-bold">{data.facebookPageName}</div>
                </div>
              ) : null}
              <div className="min-w-0">
                <div>
                  <Caption>Người nhận</Caption>
                </div>
                {data.recipient ? (
                  <>
                    <div className="truncate font-bold">
                      {data.recipient.name} / {hidePhone(data.recipient.phone, 4)}
                    </div>
                    <div className="font-bold" style={clamp(data.facebookPageName ? 2 : 3)}>
                      Đ/c: {labelRecipientAddress(data.recipient)}
                    </div>
                  </>
                ) : (
                  <div>Đơn chưa có địa chỉ giao</div>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center whitespace-nowrap" style={{ gap: u(0.5) }}>
              <Caption>Thu hộ</Caption>
              {/* Che số tiền thu hộ trên tem (2026-11-03, user chốt). */}
              <b className="leading-none" style={{ fontSize: f(12) }}>
                *** đ
              </b>
            </div>
          </div>
          <div
            className="flex min-w-0 flex-col justify-center"
            style={{
              borderBottom: LINE,
              borderLeft: LINE,
              padding: `${u(1)} ${u(1.5)}`,
              gap: u(2),
            }}
          >
            <div className="min-w-0">
              <div>
                <Caption>Kho lấy</Caption>
              </div>
              <div className="font-bold" style={{ fontSize: f(9), ...clamp(2) }}>
                {data.sender?.warehouseName ?? '—'}
              </div>
            </div>
            {destination ? (
              <div className="min-w-0">
                <div>
                  <Caption>Giao tới</Caption>
                </div>
                <div className="font-bold" style={{ fontSize: f(9), ...clamp(2) }}>
                  {destination}
                </div>
              </div>
            ) : null}
          </div>

          {/* Hàng 4: Mã đơn KH / Sản phẩm / Ghi chú | QR */}
          <div
            className="grid min-h-0 min-w-0"
            style={{ gridTemplateRows: 'auto minmax(0, 1fr) auto' }}
          >
            <div
              className="truncate whitespace-nowrap"
              style={{ borderBottom: LINE, padding: `${u(0.6)} ${u(1.5)}` }}
            >
              <Caption>Mã đơn KH </Caption>
              <b className="tracking-wide" style={{ fontSize: f(10) }}>
                {data.shipmentDocNumber}
              </b>
            </div>
            <div
              className="flex min-h-0 flex-col overflow-hidden"
              style={{
                padding: `0 ${u(1.5)}`,
                fontSize: f(many ? 7 : 8),
                gap: u(many ? 0 : 0.5),
              }}
            >
              {/* Số loại cả đơn + số tờ ở dòng tiêu đề */}
              <div
                className="flex shrink-0 justify-between font-bold"
                style={{ fontSize: f(7), lineHeight: 1.3 }}
              >
                <span>
                  Sản phẩm ({data.items.length})
                  {pages.length > 1 ? ` · Tờ ${pageNo}/${pages.length}` : null}
                </span>
                <span>SL</span>
              </div>
              {itemRows(pageItems)}
            </div>
            {/* Ghi chú — một hàng dưới cùng, các ý nối " · ", quá dài thì cắt. Có tờ in tiếp →
                ghi chú xuống cuối tờ cuối (2026-11-05). */}
            {pages.length === 1 ? noteRow : null}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ borderLeft: LINE, padding: u(1) }}
          >
            <div style={{ width: u(22), height: u(22) }}>
              <Barcode
                value={code}
                symbology="qrcode"
                scale={2}
                className={cn('block h-full w-full', FILL_SVG)}
                label={`QR ${code}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {pages.map((pageItems, i) => (
        <Fragment key={i}>{i === 0 ? page(pageItems, 1) : continuation(pageItems, i + 1)}</Fragment>
      ))}
    </>
  );
}
