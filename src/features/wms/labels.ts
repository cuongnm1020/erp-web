import type { StatusTone } from '@/components/data/status-badge';
import { toDecimal } from '@/lib/format';
import type { LocationType } from './api/use-stock';
import type { TaskStatus, TaskType } from './api/use-tasks';

/**
 * Nhãn tiếng Việt theo cái người dùng điều khiển, không theo enum của DB.
 * Khoá lấy từ union trong schema.d.ts — backend thêm giá trị thì TypeScript báo ở đây.
 */
const TASK_TYPE_LABEL: Record<TaskType, string> = {
  PICK: 'Lấy hàng',
  PUT_AWAY: 'Cất hàng',
  PACK: 'Đóng gói',
  SHIP: 'Giao đi',
  TRANSFER: 'Chuyển kho',
  RECEIVE: 'Nhận hàng',
  COUNT: 'Kiểm đếm',
  REPLENISH: 'Bù hàng',
};

const TASK_TYPE_TONE: Record<TaskType, StatusTone> = {
  PICK: 'brand',
  PUT_AWAY: 'warn',
  PACK: 'draft',
  SHIP: 'draft',
  TRANSFER: 'neutral',
  RECEIVE: 'ok',
  COUNT: 'neutral',
  REPLENISH: 'neutral',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Chưa gán',
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Xong',
  EXCEPTION: 'Ngoại lệ',
  CANCELLED: 'Đã hủy',
};

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  ZONE: 'Khu',
  AISLE: 'Dãy',
  RACK: 'Kệ',
  BIN: 'Ô kệ',
  STAGING: 'Khu tập kết',
  DOCK: 'Cửa xuất nhập',
  QUARANTINE: 'Khu cách ly',
};

export function taskTypeLabel(t: TaskType): string {
  return TASK_TYPE_LABEL[t];
}

export function taskTypeTone(t: TaskType): StatusTone {
  return TASK_TYPE_TONE[t];
}

export function taskStatusLabel(s: TaskStatus): string {
  return TASK_STATUS_LABEL[s];
}

export function locationTypeLabel(t: LocationType): string {
  return LOCATION_TYPE_LABEL[t];
}

export const TASK_TYPES = Object.keys(TASK_TYPE_LABEL) as TaskType[];

export const TASK_TYPE_OPTIONS: Array<{ value: string; label: string }> = TASK_TYPES.map((v) => ({
  value: v,
  label: TASK_TYPE_LABEL[v],
}));

/** Giá trị type trên URL do người dùng dán vào — chỉ nhận đúng union của API. */
export function parseTaskType(v: string | undefined): TaskType | undefined {
  return v !== undefined && (TASK_TYPES as string[]).includes(v) ? (v as TaskType) : undefined;
}

/**
 * Số lượng là string decimal (luật 10): so sánh dấu bằng decimal.js qua `toDecimal`,
 * KHÔNG parseFloat. `available` âm nghĩa là đang giữ nhiều hơn tồn thực — lệch sổ, phải đỏ.
 */
export function isNegativeQty(v: string): boolean {
  const d = toDecimal(v);
  return d !== null && d.isNegative() && !d.isZero();
}

/** "48 phút" / "2 giờ 5 phút" — API trả phút nguyên, không tự quy đổi ở nơi khác. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}
