'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatQuantity, formatTime } from '@/lib/format';
import { LABEL_SIZES } from '@/lib/print';
import type { ShipmentLabelData } from '../api/use-pda';
import {
  type GhtkTracking,
  hidePhone,
  maskedAddress,
  maskPhone,
  printNote,
  routeLabel,
} from '../ghtk-label';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = '0.35mm solid currentColor';

/** Số dòng hàng in ra; còn lại gom thành "+N sản phẩm khác". */
const MAX_ITEMS = 3;

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
 * Tem vận đơn ERP tự in cho đơn GHTK, khổ 100×75 ngang — bố cục theo tem GHTK (2026-10-14):
 * đầu tem GHTK + ngày in + tuyến; mã vạch đoạn số ngắn | mã phân loại (đoạn đầu nền đen);
 * người gửi (kho) / người nhận che SĐT + số nhà, khối lượng, thu hộ | kho lấy + mã đơn ERP;
 * mã đơn KH (= mã phiếu giao gửi GHTK) | QR mã vận đơn đầy đủ; sản phẩm / SL | ghi chú.
 * Kho giao (bưu cục GHTK) và biểu tượng hàng dễ vỡ… không có trong API GHTK → không in.
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
  const route = routeLabel(data.sender?.province, data.recipient?.province);
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
        <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: '13pt' }}>
          GHTK
        </span>
        <span className="leading-none" style={{ fontSize: '7pt' }}>
          Ngày in: <span className="tabular-nums">{printed}</span>
        </span>
        <span className="font-extrabold leading-none" style={{ fontSize: '11pt' }}>
          {route ?? ''}
        </span>
      </div>

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: '64fr 36fr',
          gridTemplateRows: '13.5mm auto 6mm minmax(0, 1fr)',
        }}
      >
        {/* Mã vạch đoạn số ngắn */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ borderBottom: LINE, borderRight: LINE, padding: '0.8mm 2mm 0.5mm 0' }}
        >
          <div className="w-full" style={{ height: '8.5mm' }}>
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

        {/* Mã phân loại */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ borderBottom: LINE, padding: '0.8mm 0 0.8mm 1.5mm', gap: '1.2mm' }}
        >
          <span
            className="whitespace-nowrap font-extrabold leading-none"
            style={{ fontSize: ghtk.sortCode.length > 11 ? '13pt' : '17pt' }}
          >
            <span className="bg-foreground text-card" style={{ padding: '0 0.6mm' }}>
              {ghtk.sortHead}
            </span>
            {ghtk.sortTail}
          </span>
          {/* Chỗ tem GHTK in biểu tượng hàng — ERP in mã đơn bán để kho đối chiếu */}
          {data.orderDocNumber ? (
            <span className="whitespace-nowrap font-bold leading-none" style={{ fontSize: '8pt' }}>
              Đơn {data.orderDocNumber}
            </span>
          ) : null}
        </div>

        {/* Người gửi / người nhận — cả bề ngang cột trái */}
        <div
          className="flex min-w-0 flex-col"
          style={{
            borderBottom: LINE,
            borderRight: LINE,
            padding: '0.5mm 1.5mm 0.5mm 0',
            gap: '0.3mm',
            fontSize: '7pt',
          }}
        >
          <div className="min-w-0">
            <Caption>
              Người gửi / <b style={{ fontSize: '7.5pt' }}>{ghtk.shopCode}</b>
            </Caption>
            {data.sender ? (
              <div className="font-bold" style={clamp(1)}>
                {data.sender.name} / {maskPhone(data.sender.phone)} · Đ/c:{' '}
                {maskedAddress(data.sender.street, data.sender.locality)}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <Caption>Người nhận</Caption>
            {data.recipient ? (
              <>
                <div className="truncate font-bold leading-tight">
                  {data.recipient.name} / {hidePhone(data.recipient.phone)}
                </div>
                <div className="font-bold" style={clamp(3)}>
                  Đ/c: {maskedAddress(data.recipient.street, data.recipient.locality)}
                </div>
              </>
            ) : (
              <div>Đơn chưa có địa chỉ giao</div>
            )}
          </div>
        </div>

        {/* Kho lấy / khối lượng / thu hộ */}
        <div
          className="flex min-w-0 flex-col justify-center"
          style={{ borderBottom: LINE, padding: '0.6mm 0 0.6mm 1.5mm', gap: '0.8mm' }}
        >
          <div>
            <Caption>Kho lấy</Caption>
            <div className="truncate font-extrabold leading-tight" style={{ fontSize: '8.5pt' }}>
              {data.sender?.warehouseName ?? '—'}
            </div>
          </div>
          <div>
            <Caption>Khối lượng</Caption>
            <div className="font-extrabold leading-tight" style={{ fontSize: '9pt' }}>
              {data.weightKg ? `${formatQuantity(data.weightKg)} KG` : '—'}
            </div>
          </div>
          <div>
            <Caption>Thu hộ</Caption>
            <div className="font-extrabold tabular-nums leading-tight" style={{ fontSize: '11pt' }}>
              {formatMoney(data.codAmount, { unit: 'đ' })}
            </div>
          </div>
        </div>

        {/* Mã đơn KH (= mã phiếu giao gửi GHTK) + mã đơn ERP */}
        <div
          className="flex items-end justify-between"
          style={{
            borderBottom: LINE,
            borderRight: LINE,
            padding: '0 1.5mm 0.8mm 0',
            gap: '1mm',
          }}
        >
          <div
            className="flex items-baseline whitespace-nowrap leading-none"
            style={{ gap: '1.5mm' }}
          >
            <span style={{ fontSize: '7pt' }}>Mã đơn KH</span>
            <span className="font-extrabold" style={{ fontSize: '11pt' }}>
              {data.shipmentDocNumber}
            </span>
          </div>
        </div>

        {/* QR mã vận đơn đầy đủ — trải hai hàng cuối */}
        <div
          className="flex items-center justify-center"
          style={{ gridRow: 'span 2', padding: '1mm 0 0 1.5mm' }}
        >
          <div style={{ width: '18mm', height: '18mm' }}>
            <Barcode
              value={code}
              symbology="qrcode"
              scale={2}
              className={cn('block h-full w-full', FILL_SVG)}
              label={`QR ${code}`}
            />
          </div>
        </div>

        {/* Sản phẩm / SL | ghi chú */}
        <div
          className="grid min-h-0 overflow-hidden"
          style={{ gridTemplateColumns: '1.35fr 1fr', borderRight: LINE }}
        >
          <div
            className="min-w-0 overflow-hidden"
            style={{ borderRight: LINE, padding: '0.6mm 1.2mm 0 0', fontSize: '7pt' }}
          >
            <div className="flex justify-between font-bold">
              <span>Sản phẩm</span>
              <span>SL</span>
            </div>
            {shown.map((it, i) => (
              <div key={i} className="flex" style={{ gap: '1mm' }}>
                <span className="min-w-0 flex-1" style={clamp(3)}>
                  {it.name}
                </span>
                <span className="shrink-0 tabular-nums">{formatQuantity(it.qty)}</span>
              </div>
            ))}
            {more > 0 ? <div className="italic">+{more} sản phẩm khác</div> : null}
          </div>
          <div
            className="min-w-0 overflow-hidden"
            style={{ padding: '0.6mm 1.2mm 0 1.2mm', fontSize: '7pt' }}
          >
            <div className="font-bold">Ghi chú</div>
            {note ? <div style={{ fontSize: '6.5pt', ...clamp(4) }}>{note}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
