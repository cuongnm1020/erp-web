'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatTime } from '@/lib/format';
import { useShipmentStatusLog, type CarrierStatusLog } from '@/features/wms/api/use-shipping';

export type JourneyStage = CarrierStatusLog['journeyStage'];

/**
 * Tên giai đoạn theo app Viettel Post, dùng chung mọi hãng (2026-11-11, mockup
 * 9z6duN29WY4rkcFpVkik8g). `tone` = màu chấm + tên khi là giai đoạn hiện tại.
 */
type Tone = 'neutral' | 'ship' | 'warn' | 'ok' | 'bad';
const STAGE: Record<JourneyStage, { label: string; tone: Tone }> = {
  CREATED: { label: 'Tạo đơn hàng', tone: 'neutral' },
  PICKUP_FAILED: { label: 'Lấy hàng không thành công', tone: 'warn' },
  PICKED_UP: { label: 'Đã nhận hàng', tone: 'ship' },
  IN_TRANSIT: { label: 'Vận chuyển', tone: 'ship' },
  DELIVERING: { label: 'Giao hàng', tone: 'ship' },
  DELIVERY_FAILED: { label: 'Tồn - Giao không thành công', tone: 'warn' },
  DELIVERED: { label: 'Giao thành công', tone: 'ok' },
  RETURNING: { label: 'Đang chuyển hoàn', tone: 'bad' },
  RETURNED: { label: 'Đã trả hàng về shop', tone: 'bad' },
  CANCELLED: { label: 'Hãng hủy', tone: 'bad' },
  INCIDENT: { label: 'Sự cố', tone: 'bad' },
  OTHER: { label: 'Cập nhật khác', tone: 'neutral' },
};

const DOT: Record<Tone, string> = {
  neutral: 'bg-subtle-foreground',
  ship: 'bg-primary',
  warn: 'bg-warning',
  ok: 'bg-success',
  bad: 'bg-destructive',
};
const TITLE: Record<Tone, string> = {
  neutral: 'text-foreground',
  ship: 'text-foreground',
  warn: 'text-warning',
  ok: 'text-success',
  bad: 'text-destructive',
};

export interface JourneyGroup {
  stage: JourneyStage;
  /** Mới nhất trước. */
  events: CarrierStatusLog[];
}

/**
 * Thuần — dòng hành trình (API đã sắp theo giờ hãng, mới nhất trước) → mục theo giai đoạn: các dòng
 * LIỀN NHAU cùng giai đoạn gộp một mục; giai đoạn lặp lại sau giai đoạn khác (giao → tồn → giao
 * lại) là mục riêng, như app hãng. Dòng NOT_FOUND không gắn phiếu nên không có ở đây.
 */
export function groupJourney(items: readonly CarrierStatusLog[]): JourneyGroup[] {
  const out: JourneyGroup[] = [];
  for (const e of items) {
    const last = out[out.length - 1];
    if (last && last.stage === e.journeyStage) last.events.push(e);
    else out.push({ stage: e.journeyStage, events: [e] });
  }
  return out;
}

/** Hành trình đầy đủ (mọi tín hiệu) có từ bản api 2026-11-11 — đơn cũ hơn chỉ có mốc đổi trạng thái. */
const FULL_JOURNEY_SINCE = Date.parse('2026-11-12T00:00:00+07:00');

/** "07:31:09 11/11/2026" — giờ hãng ghi, không có thì giờ ERP nhận. */
const eventTime = (e: CarrierStatusLog) => {
  const at = e.occurredAt ?? e.createdAt;
  return `${formatTime(at, { seconds: true })} ${formatDate(at)}`;
};

function EventLine({ e }: { e: CarrierStatusLog }) {
  const detail = [e.location, e.remark].filter(Boolean).join(' · ');
  return (
    <p className="text-xs">
      <span className="tabular-nums text-muted-foreground">{eventTime(e)}:</span>{' '}
      {e.statusText ?? `Mã ${e.carrierStatusCode}`}
      {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
    </p>
  );
}

function Group({ g, current, last }: { g: JourneyGroup; current: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  // API cũ (trước 2026-11-11) chưa trả journeyStage → "Cập nhật khác", không vỡ màn.
  const meta = STAGE[g.stage] ?? STAGE.OTHER;
  const [latest, ...older] = g.events;
  if (!latest) return null;
  return (
    <li className="relative pb-3 pl-6">
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 top-1 h-2.5 w-2.5 rounded-full',
          current ? cn(DOT[meta.tone], 'ring-2 ring-card ring-offset-1') : 'bg-border-strong',
        )}
      />
      {last ? null : (
        <span aria-hidden className="absolute bottom-0 left-1.5 top-4 w-px bg-border" />
      )}
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-sm font-semibold', TITLE[meta.tone])}>{meta.label}</span>
        {older.length > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-control text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-label={`${open ? 'Ẩn' : 'Xem'} ${older.length} lần quét trước của ${meta.label}`}
            onClick={() => setOpen((v) => !v)}
          >
            {g.events.length}
            <ChevronDown
              aria-hidden
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-fast motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            />
          </button>
        ) : null}
      </div>
      <EventLine e={latest} />
      {open && older.length > 0 ? (
        <div className="mt-1 space-y-1 border-l-2 border-muted pl-2.5">
          {older.map((e) => (
            <EventLine key={e.id} e={e} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * "Xem hành trình" kiểu app hãng (2026-11-11): mục theo giai đoạn, mới nhất ở trên, mỗi mục hiện
 * lần quét gần nhất; bấm số + mũi tên xem các lần trước trong cùng giai đoạn.
 */
export function CarrierJourney({ shipmentId }: { shipmentId: string }) {
  const q = useShipmentStatusLog(shipmentId);
  if (q.isPending) return <p className="text-xs text-muted-foreground">Đang tải hành trình…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{messageFor(q.error)}</p>;
  const groups = groupJourney(q.data.items);
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Chưa có cập nhật nào từ hãng — lần quét mới sẽ hiện ở đây khi hãng báo.
      </p>
    );
  }
  const legacy = q.data.items.some((e) => Date.parse(e.createdAt) < FULL_JOURNEY_SINCE);
  return (
    <div className="space-y-2">
      <ol aria-label="Hành trình từ hãng">
        {groups.map((g, i) => (
          <Group key={g.events[0]!.id} g={g} current={i === 0} last={i === groups.length - 1} />
        ))}
      </ol>
      {legacy ? (
        <p className="rounded-control bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          Đơn gửi hãng trước 12/11/2026 chỉ có các mốc đổi trạng thái. Các lần quét giữa chừng không
          được lưu.
        </p>
      ) : null}
    </div>
  );
}
