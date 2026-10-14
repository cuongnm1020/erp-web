'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import { type GhtkTracking, hidePhone, maskedAddress, maskPhone, printNote } from '../ghtk-label';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = '0.35mm solid currentColor';

/** Số dòng hàng in ra; còn lại gom thành "+N sản phẩm khác". */
const MAX_ITEMS = 4;

const clamp = (lines: number): CSSProperties => ({
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function Caption({ children }: { children: ReactNode }) {
  return (
    <div className="leading-tight" style={{ fontSize: '6.5pt' }}>
      {children}
    </div>
  );
}

/**
 * Tem vận đơn ERP tự in cho đơn GHTK, khổ 100×75 ngang — theo tem GHTK, chỉnh 2026-10-14:
 * đầu tem GHTK + ngày in; mã vạch đoạn số cuối của mã GHTK | QR mã đầy đủ; người gửi (kho, SĐT
 * che giữa) / người nhận (SĐT che hết, che số nhà) | kho lấy, khối lượng, thu hộ; rồi các hàng
 * hết bề ngang: mã đơn KH (= mã phiếu giao gửi GHTK), danh sách sản phẩm / SL, ghi chú.
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
  const size = LABEL_SIZES.WAYBILL_100x75;
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const note = printNote(data);
  const shown = data.items.slice(0, MAX_ITEMS);
  const more = data.items.length - shown.length;
  const printed = `${formatDate(printedAt)} ${formatTime(printedAt).replace(':', 'h')}`;

  return (
    <div
      data-waybill-label={code}
      className="flex flex-col overflow-hidden bg-card text-foreground"
      style={{
        width: `${size.labelWidthMm}mm`,
        height: `${size.labelHeightMm}mm`,
        padding: '1.8mm 2.5mm 1.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* Đầu tem */}
      <div
        className="flex items-end justify-between"
        style={{ borderBottom: LINE, paddingBottom: '0.6mm', gap: '2mm' }}
      >
        <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: '12pt' }}>
          GHTK
        </span>
        {/* Mã đơn KH (= mã phiếu giao gửi GHTK) */}
        <span
          className="flex items-baseline whitespace-nowrap leading-none"
          style={{ gap: '1.2mm' }}
        >
          <span style={{ fontSize: '7pt' }}>Mã đơn KH</span>
          <span className="font-extrabold" style={{ fontSize: '10pt' }}>
            {data.shipmentDocNumber}
          </span>
        </span>
        <span className="whitespace-nowrap leading-none" style={{ fontSize: '6.5pt' }}>
          In <span className="tabular-nums">{printed}</span>
        </span>
      </div>

      {/* Hai cột: mã vạch | QR, người gửi / nhận | kho lấy · khối lượng · thu hộ */}
      <div className="grid" style={{ gridTemplateColumns: '64fr 36fr' }}>
        <div
          className="flex flex-col items-center justify-center"
          style={{ borderBottom: LINE, borderRight: LINE, padding: '0.8mm 2mm 0.6mm 0' }}
        >
          <div className="w-full" style={{ height: '9.5mm' }}>
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
            style={{ fontSize: '10pt', marginTop: '0.5mm' }}
          >
            {ghtk.shortCode}
          </span>
        </div>
        <div
          className="flex items-center justify-center"
          style={{ borderBottom: LINE, padding: '0.6mm 0 0.6mm 1.5mm' }}
        >
          <div style={{ width: '13mm', height: '13mm' }}>
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
            padding: '0.5mm 1.5mm 0.6mm 0',
            gap: '0.3mm',
            fontSize: '7pt',
          }}
        >
          <div className="min-w-0" style={clamp(2)}>
            <span style={{ fontSize: '6.5pt' }}>Người gửi / </span>
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
                <div className="truncate leading-tight">
                  <span style={{ fontSize: '6.5pt' }}>Người nhận: </span>
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
          style={{ borderBottom: LINE, padding: '0.5mm 0 0.6mm 1.5mm', gap: '0.6mm' }}
        >
          {/* Nhãn và giá trị cùng một dòng — nhường chiều cao cho danh sách sản phẩm */}
          <div style={clamp(2)}>
            <span style={{ fontSize: '6.5pt' }}>Kho lấy: </span>
            <b style={{ fontSize: '8pt' }}>{data.sender?.warehouseName ?? '—'}</b>
          </div>
          <div className="truncate leading-tight">
            <span style={{ fontSize: '6.5pt' }}>Khối lượng: </span>
            <b style={{ fontSize: '8.5pt' }}>
              {data.weightKg ? `${formatQuantity(data.weightKg)} KG` : '—'}
            </b>
          </div>
          <div>
            <Caption>Thu hộ</Caption>
            <div className="font-extrabold tabular-nums leading-tight" style={{ fontSize: '11pt' }}>
              {formatMoney(data.codAmount, { unit: 'đ' })}
            </div>
          </div>
        </div>
      </div>

      {/* Sản phẩm / SL — một hàng dài hết bề ngang */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ padding: '0.6mm 0 0.4mm', fontSize: '7.5pt', gap: '0.4mm' }}
      >
        <div className="flex justify-between font-bold" style={{ fontSize: '7pt' }}>
          <span>Sản phẩm</span>
          <span>SL</span>
        </div>
        {shown.map((it, i) => (
          <div key={i} className="flex items-baseline" style={{ gap: '2mm' }}>
            <span className="min-w-0 flex-1 font-semibold" style={clamp(2)}>
              {it.name}
            </span>
            <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: '9pt' }}>
              {formatQuantity(it.qty)}
            </span>
          </div>
        ))}
        {more > 0 ? <div className="italic">+{more} sản phẩm khác</div> : null}
      </div>

      {/* Ghi chú — hàng riêng dưới danh sách sản phẩm, mỗi ý một dòng */}
      {note ? (
        <div
          className="shrink-0 overflow-hidden"
          style={{ borderTop: LINE, padding: '0.6mm 0 0', fontSize: '7pt', maxHeight: '12mm' }}
        >
          <span className="font-bold">Ghi chú: </span>
          <span className="whitespace-pre-line break-words" style={{ lineHeight: 1.3 }}>
            {note}
          </span>
        </div>
      ) : null}
    </div>
  );
}
