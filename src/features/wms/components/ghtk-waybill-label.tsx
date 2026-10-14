'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import { type GhtkTracking, hidePhone, maskedAddress, maskPhone, printNote } from '../ghtk-label';
// Dựng ×2 rồi thu về — chống cài đặt "cỡ chữ tối thiểu" của Chrome (xem label-scale.ts).
import { f, labelInner, labelOuter, u } from '../label-scale';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = `${u(0.35)} solid currentColor`;

/**
 * Số dòng hàng in ra; còn lại báo "+N sản phẩm khác không in" ở tiêu đề. Đo trên bản xem trước
 * 2026-10-14 (người gửi / nhận tối đa, ghi chú 3 dòng): 6 dòng tên 1 dòng vừa khít 100×75.
 */
const MAX_ITEMS = 6;
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
 * Tem vận đơn ERP tự in cho đơn GHTK, khổ 100×75 ngang — theo tem GHTK, chỉnh 2026-10-14:
 * đầu tem GHTK + mã đơn KH + giờ in; mã vạch đoạn số cuối của mã GHTK | QR mã đầy đủ; người gửi
 * (kho, SĐT che giữa) / người nhận (SĐT che hết, che số nhà) | kho lấy, khối lượng, thu hộ; rồi
 * hai hàng hết bề ngang: danh sách sản phẩm / SL, ghi chú (mỗi ý một dòng).
 * Không in mã phân loại, tuyến, kho giao, biểu tượng hàng (người dùng bỏ / API GHTK không có).
 */
export function GhtkWaybillLabel({
  data,
  ghtk,
  printedAt,
}: {
  data: ShipmentLabelData;
  ghtk: GhtkTracking;
  printedAt: Date;
}) {
  const W = LABEL_SIZES.WAYBILL_100x75.labelWidthMm ?? 100;
  const H = LABEL_SIZES.WAYBILL_100x75.labelHeightMm ?? 75;
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const note = printNote(data);
  const shown = data.items.slice(0, MAX_ITEMS);
  const more = data.items.length - shown.length;
  // Nhiều hàng → mỗi tên 1 dòng, chữ nhỏ hơn một chút — đủ chỗ cho cả danh sách.
  const many = data.items.length > FULL_NAME_ITEMS;
  const printed = `${formatDate(printedAt)} ${formatTime(printedAt).replace(':', 'h')}`;

  return (
    <div
      data-waybill-label={code}
      className="overflow-hidden bg-card text-foreground"
      style={labelOuter(W, H)}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{ ...labelInner(W, H), padding: `${u(1.8)} ${u(2.5)} ${u(1.5)}` }}
      >
        {/* Đầu tem */}
        <div
          className="flex items-end justify-between"
          style={{ borderBottom: LINE, paddingBottom: u(0.6), gap: u(2) }}
        >
          <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: f(12) }}>
            GHTK
          </span>
          {/* Mã đơn KH (= mã phiếu giao gửi GHTK) */}
          <span
            className="flex items-baseline whitespace-nowrap leading-none"
            style={{ gap: u(1.2) }}
          >
            <span style={{ fontSize: f(7) }}>Mã đơn KH</span>
            <span className="font-extrabold" style={{ fontSize: f(10) }}>
              {data.shipmentDocNumber}
            </span>
          </span>
          <span className="whitespace-nowrap leading-none" style={{ fontSize: f(6.5) }}>
            In <span className="tabular-nums">{printed}</span>
          </span>
        </div>

        {/* Hai cột: mã vạch | QR, người gửi / nhận | kho lấy · khối lượng · thu hộ */}
        <div className="grid" style={{ gridTemplateColumns: '64fr 36fr' }}>
          <div
            className="flex flex-col items-center justify-center"
            style={{
              borderBottom: LINE,
              borderRight: LINE,
              padding: `${u(0.8)} ${u(2)} ${u(0.6)} 0`,
            }}
          >
            <div className="w-full" style={{ height: u(9.5) }}>
              {/* height thấp → SVG bè ngang, vạch trải gần hết cột như tem GHTK */}
              <Barcode
                value={ghtk.shortCode}
                symbology="code128"
                height={4.5}
                scale={2}
                showText={false}
                className={cn('block h-full w-full', FILL_SVG)}
                label={`Mã vận đơn ${code}`}
              />
            </div>
            <span
              className="font-mono font-bold leading-none tracking-wide"
              style={{ fontSize: f(10), marginTop: u(0.5) }}
            >
              {ghtk.shortCode}
            </span>
          </div>
          <div
            className="flex items-center justify-center"
            style={{ borderBottom: LINE, padding: `${u(0.6)} 0 ${u(0.6)} ${u(1.5)}` }}
          >
            <div style={{ width: u(13), height: u(13) }}>
              <Barcode
                value={code}
                symbology="qrcode"
                scale={2}
                className={cn('block h-full w-full', FILL_SVG)}
                label={`QR ${code}`}
              />
            </div>
          </div>

          <div
            className="flex min-w-0 flex-col"
            style={{
              borderBottom: LINE,
              borderRight: LINE,
              padding: `${u(0.5)} ${u(1.5)} ${u(0.6)} 0`,
              gap: u(0.3),
              fontSize: f(7),
            }}
          >
            <div className="min-w-0" style={clamp(2)}>
              <Caption>Người gửi / </Caption>
              <b>{ghtk.shopCode}</b>
              {data.sender ? (
                <b>
                  {' · '}
                  {data.sender.name} / {maskPhone(data.sender.phone)} · Đ/c:{' '}
                  {maskedAddress(data.sender.street, data.sender.locality)}
                </b>
              ) : null}
            </div>
            <div className="min-w-0">
              {data.recipient ? (
                <>
                  <div className="truncate" style={{ lineHeight: 1.3 }}>
                    <Caption>Người nhận: </Caption>
                    <b>
                      {data.recipient.name} / {hidePhone(data.recipient.phone)}
                    </b>
                  </div>
                  <div className="font-bold" style={clamp(2)}>
                    Đ/c: {maskedAddress(data.recipient.street, data.recipient.locality)}
                  </div>
                </>
              ) : (
                <div>Người nhận: đơn chưa có địa chỉ giao</div>
              )}
            </div>
          </div>
          <div
            className="flex min-w-0 flex-col justify-center"
            style={{ borderBottom: LINE, padding: `${u(0.5)} 0 ${u(0.6)} ${u(1.5)}`, gap: u(0.6) }}
          >
            {/* Nhãn và giá trị cùng một dòng — nhường chiều cao cho danh sách sản phẩm */}
            <div style={clamp(2)}>
              <Caption>Kho lấy: </Caption>
              <b style={{ fontSize: f(8) }}>{data.sender?.warehouseName ?? '—'}</b>
            </div>
            <div className="truncate" style={{ lineHeight: 1.3 }}>
              <Caption>Khối lượng: </Caption>
              <b style={{ fontSize: f(8.5) }}>
                {data.weightKg ? `${formatQuantity(data.weightKg)} KG` : '—'}
              </b>
            </div>
            <div className="whitespace-nowrap" style={{ lineHeight: 1.3 }}>
              <Caption>Thu hộ </Caption>
              <b className="tabular-nums" style={{ fontSize: f(11) }}>
                {formatMoney(data.codAmount, { unit: 'đ' })}
              </b>
            </div>
          </div>
        </div>

        {/* Sản phẩm / SL — một hàng dài hết bề ngang */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{
            padding: `${u(0.5)} 0 ${u(0.3)}`,
            fontSize: f(many ? 7.5 : 8),
            gap: u(many ? 0.2 : 0.5),
          }}
        >
          {/* Số loại + phần không in nằm ở dòng tiêu đề — luôn thấy dù danh sách bị cắt */}
          <div
            className="flex shrink-0 justify-between font-bold"
            style={{ fontSize: f(7), lineHeight: 1.3 }}
          >
            <span>
              Sản phẩm ({data.items.length})
              {more > 0 ? <span className="italic"> · +{more} sản phẩm khác không in</span> : null}
            </span>
            <span>SL</span>
          </div>
          {shown.map((it, i) => (
            <div key={i} className="flex shrink-0 items-start" style={{ gap: u(2) }}>
              <span className="min-w-0 flex-1 font-semibold" style={clamp(many ? 1 : 2)}>
                {it.name}
              </span>
              {/* SL cùng cỡ chữ + line-height với tên: chữ to hơn sẽ kéo cao từng dòng hàng */}
              <span className="shrink-0 font-bold tabular-nums" style={{ lineHeight: 1.3 }}>
                {formatQuantity(it.qty)}
              </span>
            </div>
          ))}
        </div>

        {/* Ghi chú — hàng riêng dưới danh sách sản phẩm, mỗi ý một dòng */}
        {note ? (
          <div
            className="shrink-0 whitespace-pre-line break-words"
            style={{
              borderTop: LINE,
              padding: `${u(0.5)} 0 0`,
              fontSize: f(7),
              ...clamp(3),
            }}
          >
            <span className="font-bold">Ghi chú: </span>
            {note}
          </div>
        ) : null}
      </div>
    </div>
  );
}
