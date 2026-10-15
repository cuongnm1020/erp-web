'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Truck } from 'lucide-react';
import { Barcode } from '@/components/data/barcode';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatPhone, formatQuantity, formatTime } from '@/lib/format';
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
import { f, labelInner, labelOuter, u } from '../label-scale';

/** Ô mã vạch: SVG của bwip-js giãn theo ô (giữ tỉ lệ), không theo kích thước gốc. */
const FILL_SVG = '[&>svg]:!h-full [&>svg]:!w-full [&>svg]:!max-w-none';

const LINE = `${u(0.3)} solid currentColor`;

/**
 * Số dòng hàng in ra; còn lại báo "+N sản phẩm khác" ở tiêu đề. Khối sản phẩm hết bề ngang
 * chứa ~6 dòng chữ: tới FULL_NAME_ITEMS dòng hàng thì tên in 2 dòng, nhiều hơn thì 1 dòng.
 */
const MAX_ITEMS = 5;
const FULL_NAME_ITEMS = 2;

const clamp = (lines: number): CSSProperties => ({
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function Row({ label, children, pt = 8 }: { label: string; children: ReactNode; pt?: number }) {
  return (
    <div className="truncate" style={{ lineHeight: 1.3 }}>
      <span style={{ fontSize: f(6.5) }}>{label}: </span>
      <b style={{ fontSize: f(pt) }}>{children}</b>
    </div>
  );
}

/**
 * Tem vận đơn ERP tự in cho đơn GHTK, khổ 75×100 dọc. Bố cục 2026-10-15 (bản vẽ tay của kho):
 * đầu tem GHTK · EXPRESS · tuyến (NỘI TỈNH / NỘI MIỀN / LIÊN MIỀN, ERP tự suy từ tỉnh); người
 * gửi hết bề ngang; người nhận hết bề ngang (SĐT giữ 4 số cuối); mã vạch đoạn số cuối; mã đơn
 * KH · kho lấy · thu hộ | QR mã đầy đủ + mã phân loại (đoạn đầu nền đen); sản phẩm / SL; ghi chú
 * ở đáy. Lề trái 2 mm (user chốt 2026-10-15).
 */
export function GhtkWaybillLabelPortrait({
  data,
  ghtk,
  printedAt,
}: {
  data: ShipmentLabelData;
  ghtk: GhtkTracking;
  printedAt: Date;
}) {
  const W = LABEL_SIZES.WAYBILL_75x100.labelWidthMm ?? 75;
  const H = LABEL_SIZES.WAYBILL_75x100.labelHeightMm ?? 100;
  const code = data.trackingNo ?? data.shipmentDocNumber;
  const note = printNote(data)?.replace(/\n/g, ' · ') ?? DEFAULT_PRINT_NOTE;
  const shown = data.items.slice(0, MAX_ITEMS);
  const more = data.items.length - shown.length;
  const nameLines = data.items.length > FULL_NAME_ITEMS ? 1 : 2;
  const route = routeLabel(data.sender?.province, data.recipient?.province);
  const printed = `${formatDate(printedAt)} ${formatTime(printedAt).replace(':', 'h')}`;
  // Cột QR hẹp: mã phân loại dài (MN13-12-P52) → bớt cỡ chữ để không tràn.
  const sortPt = ghtk.sortCode.length > 9 ? 12 : 14;

  return (
    <div
      data-waybill-label={code}
      className="overflow-hidden bg-card text-foreground"
      style={labelOuter(W, H)}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{ ...labelInner(W, H), padding: `${u(1.5)} ${u(1.8)} ${u(1.5)} ${u(2)}` }}
      >
        {/* Đầu tem: GHTK | EXPRESS + ngày in | tuyến */}
        <div
          className="grid shrink-0 items-center"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            borderBottom: LINE,
            paddingBottom: u(0.8),
            gap: u(1),
          }}
        >
          <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: f(12) }}>
            GHTK
          </span>
          <div className="flex flex-col items-center" style={{ gap: u(0.4) }}>
            <span
              className="flex items-center font-extrabold leading-none"
              style={{ fontSize: f(10), gap: u(0.8) }}
            >
              <Truck style={{ width: '1.1em', height: '1.1em' }} aria-hidden />
              EXPRESS
            </span>
            <span className="whitespace-nowrap leading-none" style={{ fontSize: f(5.5) }}>
              Ngày in: <span className="tabular-nums">{printed}</span>
            </span>
          </div>
          <span
            className="whitespace-nowrap text-right font-extrabold leading-none"
            style={{ fontSize: f(10) }}
          >
            {route ?? ''}
          </span>
        </div>

        {/* Người gửi */}
        <div
          className="shrink-0"
          style={{ borderBottom: LINE, padding: `${u(0.8)} 0`, fontSize: f(6.5) }}
        >
          <div className="truncate" style={{ lineHeight: 1.3 }}>
            Người gửi: <b style={{ fontSize: f(8) }}>{ghtk.shopCode}</b>
            {data.sender?.phone ? <> / {formatPhone(data.sender.phone)}</> : null}
          </div>
          {data.sender ? (
            <div style={clamp(2)}>
              {data.sender.name} · Đ/c: {maskedAddress(data.sender.street, data.sender.locality)}
            </div>
          ) : null}
        </div>

        {/* Người nhận */}
        <div
          className="shrink-0"
          style={{ borderBottom: LINE, padding: `${u(0.8)} 0`, fontSize: f(6.5) }}
        >
          {data.recipient ? (
            <>
              <div className="truncate" style={{ lineHeight: 1.3 }}>
                Người nhận: <b style={{ fontSize: f(8) }}>{data.recipient.name}</b> /{' '}
                {hidePhone(data.recipient.phone, 4)}
              </div>
              <div style={clamp(2)}>
                Đ/c: {maskedAddress(data.recipient.street, data.recipient.locality)}
              </div>
            </>
          ) : (
            <div style={{ lineHeight: 1.3 }}>Người nhận: đơn chưa có địa chỉ giao</div>
          )}
        </div>

        {/* Mã vạch đoạn số cuối, hết bề ngang */}
        <div
          className="flex shrink-0 flex-col items-center"
          style={{ borderBottom: LINE, padding: `${u(1.2)} ${u(4)} ${u(0.8)}` }}
        >
          <div className="w-full" style={{ height: u(11) }}>
            <Barcode
              value={ghtk.shortCode}
              symbology="code128"
              height={6}
              scale={2}
              showText={false}
              className={cn('block h-full w-full', FILL_SVG)}
              label={`Mã vận đơn ${code}`}
            />
          </div>
          <span
            className="font-mono font-bold leading-none tracking-widest"
            style={{ fontSize: f(9), marginTop: u(0.8) }}
          >
            {ghtk.shortCode}
          </span>
        </div>

        {/* Mã đơn KH · kho lấy · thu hộ | QR + mã phân loại */}
        <div
          className="grid shrink-0"
          style={{ gridTemplateColumns: `1fr ${u(30)}`, borderBottom: LINE }}
        >
          <div
            className="flex min-w-0 flex-col justify-center"
            style={{ borderRight: LINE, padding: `${u(0.8)} ${u(1.2)} ${u(0.8)} 0`, gap: u(1) }}
          >
            <Row label="Mã đơn KH">{data.shipmentDocNumber}</Row>
            <Row label="Kho lấy">{data.sender?.warehouseName ?? '—'}</Row>
            <Row label="Thu hộ" pt={9}>
              <span className="tabular-nums">{formatMoney(data.codAmount, { unit: 'đ' })}</span>
            </Row>
          </div>
          <div
            className="flex min-w-0 flex-col items-center justify-center"
            style={{ padding: `${u(0.8)} 0 ${u(0.8)} ${u(1)}`, gap: u(1) }}
          >
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
              className="whitespace-nowrap font-extrabold leading-none"
              style={{ fontSize: f(sortPt) }}
            >
              <span
                className="bg-foreground text-background"
                style={{ padding: `${u(0.3)} ${u(0.6)}` }}
              >
                {ghtk.sortHead}
              </span>
              {ghtk.sortTail}
            </span>
          </div>
        </div>

        {/* Sản phẩm / SL */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ padding: `${u(0.8)} 0`, gap: u(0.5), fontSize: f(6.5) }}
        >
          <div className="flex shrink-0 justify-between" style={{ lineHeight: 1.3 }}>
            <span>
              Sản phẩm
              {more > 0 ? <span className="italic"> · +{more} sản phẩm khác</span> : null}
            </span>
            <span>SL</span>
          </div>
          {shown.map((it, i) => (
            <div key={i} className="flex shrink-0 items-start" style={{ gap: u(1.5) }}>
              <span className="min-w-0 flex-1" style={clamp(nameLines)}>
                {it.name}
              </span>
              <span className="shrink-0 font-bold tabular-nums" style={{ lineHeight: 1.3 }}>
                {formatQuantity(it.qty)}
              </span>
            </div>
          ))}
        </div>

        {/* Ghi chú ở đáy */}
        <div
          className="shrink-0 break-words"
          style={{ borderTop: LINE, paddingTop: u(0.8), fontSize: f(6.5), ...clamp(3) }}
        >
          Ghi chú: {note}
        </div>
      </div>
    </div>
  );
}
