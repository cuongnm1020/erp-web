'use client';

import { AlertTriangle, ArrowLeftRight, Clock, ShoppingCart } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CopyButton } from '@/components/data/copy-button';
import { StatusBadge } from '@/components/data/status-badge';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatMoney, formatTime, toLocalDateKey } from '@/lib/format';
import { useShipmentStatusLog } from '@/features/wms/api/use-shipping';
import { shipmentStatusBadge } from '@/features/wms/labels';
import type { SalesOrderDetail } from '../api/use-orders';

type Shipment = NonNullable<SalesOrderDetail['shipment']>;

/** Màu nhận diện từng hãng (token `carrier-*`) — viền, tiêu đề, nền mã vận đơn. */
const CARRIER_TONE: Record<string, { border: string; text: string; bg: string; label: string }> = {
  VTP: {
    border: 'border-carrier-vtp',
    text: 'text-carrier-vtp',
    bg: 'bg-carrier-vtp',
    label: 'VTP',
  },
  GHTK: {
    border: 'border-carrier-ghtk',
    text: 'text-carrier-ghtk',
    bg: 'bg-carrier-ghtk',
    label: 'GHTK',
  },
  VNPOST: {
    border: 'border-carrier-vnpost',
    text: 'text-carrier-vnpost',
    bg: 'bg-carrier-vnpost',
    label: 'VNP',
  },
  GHN: {
    border: 'border-carrier-ghn',
    text: 'text-carrier-ghn',
    bg: 'bg-carrier-ghn',
    label: 'GHN',
  },
  JT: { border: 'border-carrier-jt', text: 'text-carrier-jt', bg: 'bg-carrier-jt', label: 'J&T' },
};
const OTHER_TONE = {
  border: 'border-carrier-other',
  text: 'text-carrier-other',
  bg: 'bg-carrier-other',
  label: '',
};

const CARRIER_PAYER: Record<string, string> = { VNPOST: 'VNPost', JT: 'J&T' };

/** Hãng báo giao không thành / tồn / hẹn lại — vẫn "Đang giao hàng" nhưng cần sale gọi khách. */
const DELIVERY_TROUBLE = /tồn|hẹn|không (giao|phát|liên lạc|nghe)|delay|hoãn|chuyển hoàn/i;

/**
 * Giờ hãng ghi theo kiểu Pancake: "18:59 hôm nay", "18:59 hôm qua", "14:56 25/10"; khác năm thì
 * kèm năm "11:07 16/06/2025".
 */
export function carrierTime(iso: string | null | undefined, now: Date = new Date()): string {
  const key = toLocalDateKey(iso);
  if (!iso || !key) return '—';
  const time = formatTime(iso);
  if (key === toLocalDateKey(now)) return `${time} hôm nay`;
  if (key === toLocalDateKey(now.getTime() - 86_400_000)) return `${time} hôm qua`;
  const [year, month, day] = key.split('-');
  return year === toLocalDateKey(now)?.slice(0, 4)
    ? `${time} ${day}/${month}`
    : `${time} ${formatDate(iso)}`;
}

function Section({
  icon,
  title,
  textClass,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  textClass: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className={cn('flex items-center gap-1.5 text-sm font-semibold', textClass)}>
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="shrink-0 font-semibold">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Hộp "Đối soát" — phí hãng đã đối soát chưa, ngày, COD, tổng phí. Chỉ xem. */
function ReconcileBox({ s, tone }: { s: Shipment; tone: typeof OTHER_TONE }) {
  return (
    <div
      className={cn('space-y-1.5 rounded-card border border-l-4 bg-card px-3 py-2.5', tone.border)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-sm font-semibold', tone.text)}>
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          Đối soát:
        </span>
        {s.feeReconciledAt ? (
          <StatusBadge tone="ok">Đã đối soát</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Chưa đối soát</StatusBadge>
        )}
      </div>
      {s.feeReconciledAt ? (
        <dl className="space-y-0.5">
          <Row label="Ngày:">{formatDate(s.feeReconciledAt)}</Row>
          <Row label="COD:">{formatMoney(s.codAmount ?? '0')}</Row>
          <Row label="Tổng phí:">{formatMoney(s.carrierFeeTotal)}</Row>
        </dl>
      ) : null}
    </div>
  );
}

/** "Xem hành trình" — các mốc đổi trạng thái (CarrierStatusLog APPLIED) với chữ + vị trí hãng. */
function Journey({ shipmentId, dotClass }: { shipmentId: string; dotClass: string }) {
  const q = useShipmentStatusLog(shipmentId);
  if (q.isPending) return <p className="text-xs text-muted-foreground">Đang tải hành trình…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{messageFor(q.error)}</p>;
  const items = q.data.items.filter((e) => e.outcome === 'APPLIED');
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Chưa có mốc đổi trạng thái nào — mốc mới sẽ hiện ở đây khi hãng báo.
      </p>
    );
  }
  return (
    <ol className="space-y-2" aria-label="Hành trình từ hãng">
      {items.map((e, i) => {
        const mapped = e.mappedStatus ? shipmentStatusBadge(e.mappedStatus) : null;
        return (
          <li key={e.id} className="flex gap-2 text-xs">
            <span
              aria-hidden
              className={cn(
                'mt-1 h-2 w-2 shrink-0 rounded-full',
                i === 0 ? dotClass : 'bg-border-strong',
              )}
            />
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="tabular-nums text-muted-foreground">
                  {carrierTime(e.occurredAt ?? e.createdAt)}
                </span>
                <span className="font-semibold">{e.statusText ?? `Mã ${e.carrierStatusCode}`}</span>
                {mapped ? <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge> : null}
              </div>
              {e.location ? <p className="text-muted-foreground">{e.location}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Thẻ hãng vận chuyển trên màn đơn (2026-10-28, mockup KDfmt8dqg3ztLcfbsGZ229 theo mẫu Pancake):
 * hộp Đối soát + hộp hãng (Dịch vụ vận chuyển, Cập nhật cuối = tín hiệu mới nhất hãng gửi kể cả
 * không đổi trạng thái) + "Xem hành trình" (mốc đổi trạng thái). Chưa có vận đơn → không vẽ.
 */
export function CarrierStatusCard({ order }: { order: SalesOrderDetail }) {
  const s = order.shipment;
  const [journey, setJourney] = useState(false);
  if (!s?.trackingNo) return null;
  const code = s.carrierCode ?? '';
  const tone = CARRIER_TONE[code] ?? { ...OTHER_TONE, label: code || 'Hãng' };
  const badge = shipmentStatusBadge(s.status);
  const last = s.lastCarrierEvent;
  const opt = order.shippingOptions;
  const payer = CARRIER_PAYER[code] ?? tone.label;
  const serviceLines = [
    opt?.shopPaysFee === false
      ? `Người nhận trả phí ship cho ${payer}`
      : `Shop trả phí ship cho ${payer}`,
    ...(s.serviceCode || s.serviceName
      ? code === 'GHTK'
        ? (s.serviceName ?? '').split('\n').filter(Boolean)
        : [`Dịch vụ: ${[s.serviceCode, s.serviceName].filter(Boolean).join(' - ')}`]
      : []),
    ...(s.declaredValue ? [`Khai giá: ${formatMoney(s.declaredValue)}`] : []),
  ];
  const alert =
    s.status === 'RETURNED'
      ? { tone: 'err' as const, text: 'Đơn đang hoàn về shop. Theo dõi hàng hoàn để nhập lại kho.' }
      : s.status === 'CARRIER_CANCELLED'
        ? { tone: 'err' as const, text: 'Vận đơn đã bị hủy. Gửi lại sang ĐVVC để cấp mã mới.' }
        : s.status === 'OUT_FOR_DELIVERY' &&
            last?.statusText &&
            DELIVERY_TROUBLE.test(`${last.statusText} ${last.remark ?? ''}`)
          ? {
              tone: 'warn' as const,
              text: 'Giao chưa thành công, hãng sẽ giao lại. Gọi khách trước lần giao tới.',
            }
          : null;

  return (
    <div className="space-y-3">
      <ReconcileBox s={s} tone={tone} />
      <section
        aria-label={`Hãng vận chuyển ${tone.label}`}
        className={cn('space-y-2.5 rounded-card border border-l-4 bg-card px-3 py-3', tone.border)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn('flex flex-wrap items-center gap-2 font-semibold', tone.text)}>
            {tone.label}
            {s.carrierAccountName ? (
              <span className="text-xs font-normal text-muted-foreground">
                · {s.carrierAccountName}
              </span>
            ) : null}
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </span>
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-control py-1 pl-2.5 pr-1 font-mono text-xs font-semibold text-primary-foreground',
              tone.bg,
            )}
          >
            <span className="truncate">{s.trackingNo}</span>
            <CopyButton
              value={s.trackingNo}
              label="mã vận đơn"
              className="text-primary-foreground"
            />
          </span>
        </div>

        <Section
          icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
          title="Dịch vụ vận chuyển:"
          textClass={tone.text}
        >
          {serviceLines.map((l) => (
            <p key={l} className="text-sm">
              {l}
            </p>
          ))}
        </Section>

        <Section
          icon={<Clock className="h-4 w-4" aria-hidden />}
          title="Cập nhật cuối:"
          textClass={tone.text}
        >
          {alert ? (
            <p
              role="status"
              className={cn(
                'flex items-start gap-1.5 rounded-control px-2 py-1.5 text-xs',
                alert.tone === 'err'
                  ? 'bg-destructive-weak text-destructive'
                  : 'bg-warning-weak text-warning',
              )}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {alert.text}
            </p>
          ) : null}
          {last ? (
            <dl className="space-y-0.5">
              <Row label="Trạng thái VC:">{last.statusText ?? `Mã ${last.carrierStatusCode}`}</Row>
              {last.location ? <Row label="Tại:">{last.location}</Row> : null}
              <Row label="Thời gian:">{carrierTime(last.occurredAt ?? last.receivedAt)}</Row>
              {last.remark ? <Row label="Với ghi chú:">{last.remark}</Row> : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa nhận cập nhật nào từ {tone.label}. Webhook hoặc lần đối soát kế tiếp sẽ hiện ở
              đây.
            </p>
          )}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2 text-xs text-muted-foreground">
          <span>
            {last
              ? `${last.source === 'POLL' ? 'Đối soát định kỳ' : 'Webhook'} · nhận ${carrierTime(last.receivedAt)}`
              : ''}
          </span>
          <button
            type="button"
            className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={journey}
            onClick={() => setJourney((v) => !v)}
          >
            {journey ? 'Thu gọn hành trình' : 'Xem hành trình'}
          </button>
        </div>
        {journey ? <Journey shipmentId={s.id} dotClass={tone.bg} /> : null}
      </section>
    </div>
  );
}
