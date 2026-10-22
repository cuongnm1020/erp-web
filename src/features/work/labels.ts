import type { StatusTone } from '@/components/data/status-badge';
import { formatDateTime, formatTime, toLocalDateKey } from '@/lib/format';
import type {
  WorkChannel,
  WorkDeadline,
  WorkEventType,
  WorkItemSummary,
  WorkKind,
  WorkPriority,
  WorkStatus,
} from './api/types';

/**
 * Nhãn tiếng Việt + tone chip cho module Công việc (docs/PLAN-ticket-sla.md §6, canvas
 * AX1fEXmhQ1oc74MU6BBC2B). Trạng thái: chữ đậm trên nền -weak qua StatusBadge, không dùng mod-*.
 */

export const KIND_LABEL: Record<WorkKind, string> = {
  CUSTOMER: 'Yêu cầu khách',
  INTERNAL: 'Yêu cầu nội bộ',
  TASK: 'Giao việc',
};

/** Nhãn trạng thái theo loại — giao việc nói "Đang làm / Chờ duyệt / Xong", yêu cầu nói "Đang xử lý…". */
export function statusLabel(kind: WorkKind, status: WorkStatus): string {
  if (kind === 'TASK') {
    switch (status) {
      case 'OPEN':
        return 'Chưa bắt đầu';
      case 'IN_PROGRESS':
        return 'Đang làm';
      case 'SUBMITTED':
        return 'Chờ duyệt';
      case 'DONE':
        return 'Xong';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status;
    }
  }
  switch (status) {
    case 'OPEN':
      return 'Mới';
    case 'IN_PROGRESS':
      return 'Đang xử lý';
    case 'WAITING_CUSTOMER':
      return 'Chờ khách';
    case 'RESOLVED':
      return 'Đã xử lý';
    case 'CLOSED':
      return 'Đã đóng';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

export function statusTone(kind: WorkKind, status: WorkStatus): StatusTone {
  switch (status) {
    case 'OPEN':
      return kind === 'TASK' ? 'neutral' : 'draft';
    case 'IN_PROGRESS':
      return 'brand';
    case 'WAITING_CUSTOMER':
    case 'SUBMITTED':
      return 'warn';
    case 'RESOLVED':
    case 'DONE':
      return 'ok';
    default:
      return 'neutral';
  }
}

export const PRIORITY_LABEL: Record<WorkPriority, string> = {
  LOW: 'Thấp',
  NORMAL: 'Thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn',
};

/** Lớp chữ ưu tiên — Khẩn đỏ đậm, Cao vàng đậm, Thấp mờ (luôn kèm chữ, không chỉ màu). */
export const PRIORITY_CLASS: Record<WorkPriority, string> = {
  LOW: 'text-muted-foreground',
  NORMAL: 'text-foreground',
  HIGH: 'font-semibold text-warning',
  URGENT: 'font-semibold text-destructive',
};

export const PRIORITIES: WorkPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const CHANNEL_LABEL: Record<WorkChannel, string> = {
  PHONE: 'Điện thoại',
  ZALO: 'Zalo',
  FACEBOOK: 'Facebook',
  WALK_IN: 'Tại cửa hàng',
  INTERNAL: 'Nội bộ',
};

export const CUSTOMER_CHANNELS: WorkChannel[] = ['PHONE', 'ZALO', 'FACEBOOK', 'WALK_IN'];

export const OUTCOME_LABEL: Record<string, string> = {
  SEND_REPLACEMENT: 'Gửi bù',
  EXCHANGE: 'Đổi hàng',
  REFUND: 'Hoàn tiền',
  ADVISED: 'Tư vấn xong',
  UNRESOLVABLE: 'Không xử lý được',
  OTHER: 'Khác',
};

export const OUTCOMES = Object.keys(OUTCOME_LABEL);

export const EVENT_LABEL: Partial<Record<WorkEventType, string>> = {
  CREATED: 'Tạo việc',
  ASSIGNED: 'Giao / nhận',
  UNASSIGNED: 'Trả về hàng chờ',
  DEPT_CHANGED: 'Chuyển phòng',
  STATUS_CHANGED: 'Đổi trạng thái',
  PRIORITY_CHANGED: 'Đổi ưu tiên',
  CATEGORY_CHANGED: 'Đổi loại',
  DUE_CHANGED: 'Đổi hạn',
  REPLY: 'Phản hồi khách',
  NOTE: 'Ghi chú',
  ATTACHMENT: 'Đính kèm',
  CHECKLIST: 'Checklist',
  WATCHER: 'Người theo dõi',
  SUBMITTED: 'Báo xong',
  APPROVED: 'Duyệt kết quả',
  REWORK: 'Yêu cầu làm lại',
  EXTENSION_REQUESTED: 'Xin gia hạn',
  EXTENSION_APPROVED: 'Đồng ý gia hạn',
  EXTENSION_REJECTED: 'Từ chối gia hạn',
  CHILD_CREATED: 'Nhờ phòng khác',
  CHILD_RESOLVED: 'Phòng khác đã xử lý',
  SLA_WARNING: 'Sắp quá hạn',
  SLA_BREACHED: 'Quá hạn SLA',
  DUE_WARNING: 'Sắp đến hạn',
  OVERDUE: 'Quá hạn',
  REOPENED: 'Mở lại',
  CONFIRMED: 'Người yêu cầu xác nhận xong',
  AUTO_CLOSED: 'Tự đóng',
};

/** "2h 20m", "1 ngày 3h", "45m" — `workday` = số phút một ngày làm việc (yêu cầu tính theo ngày làm việc). */
export function formatDuration(mins: number, workday = 1440): string {
  const m = Math.abs(Math.round(mins));
  const d = Math.floor(m / workday);
  const h = Math.floor((m % workday) / 60);
  const mm = m % 60;
  if (d > 0) return h > 0 ? `${d} ngày ${h}h` : `${d} ngày`;
  if (h > 0) return mm > 0 ? `${h}h ${String(mm).padStart(2, '0')}m` : `${h}h`;
  return `${mm}m`;
}

/** Mốc hạn ngắn: "12:00" nếu hôm nay, "T6 23/10 09:52" nếu ngày khác. */
export function formatDeadlineAt(iso: string | null): string {
  if (!iso) return '—';
  const same = toLocalDateKey(iso) === toLocalDateKey(new Date());
  return same ? formatTime(iso) : formatDateTime(iso);
}

export type DeadlineTone = 'over' | 'warn' | 'run' | 'pause' | 'met' | 'miss' | 'none';

const DEADLINE_TONE: Record<WorkDeadline['state'], DeadlineTone> = {
  OVERDUE: 'over',
  WARNING: 'warn',
  RUNNING: 'run',
  PAUSED: 'pause',
  MET: 'met',
  MISSED: 'miss',
  NONE: 'none',
};

export const DEADLINE_CLASS: Record<DeadlineTone, string> = {
  over: 'font-semibold text-destructive',
  warn: 'font-semibold text-warning',
  run: 'text-foreground',
  pause: 'text-muted-foreground',
  met: 'font-semibold text-success',
  miss: 'text-destructive',
  none: 'text-muted-foreground',
};

/** Nhãn cột Hạn / SLA: "Quá 1h 25m" · "Còn 18m" · "Tạm dừng" · "Đúng hạn" · "Trễ" · "—". */
export function deadlineText(w: Pick<WorkItemSummary, 'kind' | 'deadline'>): {
  label: string;
  tone: DeadlineTone;
} {
  const d = w.deadline;
  const tone = DEADLINE_TONE[d.state];
  const workday = w.kind === 'TASK' ? 1440 : 570;
  switch (d.state) {
    case 'OVERDUE':
      return { label: `Quá ${formatDuration(d.minutesLeft ?? 0, workday)}`, tone };
    case 'WARNING':
    case 'RUNNING':
      return { label: `Còn ${formatDuration(d.minutesLeft ?? 0, workday)}`, tone };
    case 'PAUSED':
      return { label: 'Tạm dừng', tone };
    case 'MET':
      return { label: 'Đúng hạn', tone };
    case 'MISSED':
      return { label: 'Trễ hạn', tone };
    default:
      return { label: '—', tone };
  }
}

/** Dòng phụ dưới hạn: "Phản hồi đầu · hạn 14:38" / "Xử lý · hạn T6 23/10 09:52" / "hạn 12:00". */
export function deadlineSub(w: Pick<WorkItemSummary, 'kind' | 'deadline'>): string {
  const d = w.deadline;
  if (!d.at || d.state === 'NONE') return '';
  const at = formatDeadlineAt(d.at);
  if (d.kind === 'FIRST_RESPONSE') return `Phản hồi đầu · hạn ${at}`;
  if (d.kind === 'RESOLVE') return `Xử lý · hạn ${at}`;
  return `hạn ${at}`;
}

export const WEEKDAY_LABEL = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Phút trong ngày → "08:00". */
export function minuteToHHmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "08:30" → 510; sai định dạng → null. */
export function hhmmToMinute(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59 || h * 60 + mm > 1440) return null;
  return h * 60 + mm;
}
