'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import {
  DEFAULT_PRINT_NOTE,
  type GhtkTracking,
  hidePhone,
  maskedAddress,
  printNote,
  routeLabel,
} from '../ghtk-label';
// Dựng ×2 rồi thu về — chống cài đặt "cỡ chữ tối thiểu" của Chrome (xem label-scale.ts).
import { f, labelInner, labelOuter, u, WAYBILL_EDGE } from '../label-scale';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = `${u(0.35)} solid currentColor`;

/**
 * Số dòng hàng in ra; còn lại báo "+N sản phẩm khác không in" ở tiêu đề. Ô sản phẩm cao ~15 mm
 * (sau hàng Mã đơn KH và hàng ghi chú): 4 dòng tên 1 dòng vừa khít.
 */
const MAX_ITEMS = 4;
/** Tới chừng này dòng hàng thì tên được in 2 dòng. */
const FULL_NAME_ITEMS = 2;

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
  const shown = data.items.slice(0, MAX_ITEMS);
  const more = data.items.length - shown.length;
  // Nhiều hàng → mỗi tên 1 dòng, chữ nhỏ hơn một chút — đủ chỗ cho cả danh sách.
  const many = data.items.length > FULL_NAME_ITEMS;
  const route = ghtk ? routeLabel(data.sender?.province, data.recipient?.province) : null;
  const printed = `${formatDate(printedAt)} ${formatTime(printedAt).replace(':', 'h')}`;
  const carrier = ghtk ? 'GHTK' : (data.carrierName ?? data.carrierCode ?? 'Vận đơn');
  const destination = data.recipient?.fromDistrict || data.recipient?.province || null;

  return (
    <div
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
                      Đ/c: {maskedAddress(data.recipient.street, data.recipient.locality)}
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
                padding: `${u(0.5)} ${u(1.5)}`,
                fontSize: f(many ? 7 : 8),
                gap: u(many ? 0 : 0.5),
              }}
            >
              {/* Số loại + phần không in nằm ở dòng tiêu đề — luôn thấy dù danh sách bị cắt */}
              <div
                className="flex shrink-0 justify-between font-bold"
                style={{ fontSize: f(7), lineHeight: 1.3 }}
              >
                <span>
                  Sản phẩm ({data.items.length})
                  {more > 0 ? (
                    <span className="italic"> · +{more} sản phẩm khác không in</span>
                  ) : null}
                </span>
                <span>SL</span>
              </div>
              {shown.map((it, i) => (
                <div key={i} className="flex shrink-0 items-start" style={{ gap: u(2) }}>
                  <span className="min-w-0 flex-1 font-semibold" style={clamp(many ? 1 : 2)}>
                    {it.name}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums" style={{ lineHeight: 1.3 }}>
                    {formatQuantity(it.qty)}
                  </span>
                </div>
              ))}
            </div>
            {/* Ghi chú — một hàng dưới cùng, các ý nối " · ", quá dài thì cắt */}
            <div
              className="truncate whitespace-nowrap"
              style={{ borderTop: LINE, padding: `${u(0.6)} ${u(1.5)}`, fontSize: f(7) }}
            >
              <span className="font-bold">Ghi chú: </span>
              {note}
            </div>
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
}
