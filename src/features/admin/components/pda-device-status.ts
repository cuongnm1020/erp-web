import type { StatusTone } from '@/components/data/status-badge';
import type { PdaDeviceStatus } from '../api/use-pda-devices';

/** Nhãn trạng thái thiết bị (enum DeviceStatus). Chỉ ACTIVE đăng nhập được. */
export const DEVICE_STATUS: Record<PdaDeviceStatus, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: 'Đang dùng', tone: 'ok' },
  MAINTENANCE: { label: 'Bảo trì', tone: 'warn' },
  LOST: { label: 'Báo mất', tone: 'err' },
  RETIRED: { label: 'Ngừng dùng', tone: 'neutral' },
};
