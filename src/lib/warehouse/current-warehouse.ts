/**
 * Kho đang làm việc (PLAN-warehouse-context, 2026-10-16) — một giá trị cho cả ứng dụng:
 * - client API gắn header `X-Warehouse-Id` vào MỌI request (lib/api/client.ts), API lọc / chặn theo
 *   kho được phép của người dùng (quyền thật nằm ở server — luật 7);
 * - ô chọn kho ở sidebar đọc / đổi giá trị này qua `WarehouseProvider`.
 *
 * Giữ ở module (không phải React state) vì client API đọc nó ngoài cây React. Lưu localStorage theo
 * user để F5 giữ nguyên; đăng nhập / đăng xuất xoá → mỗi lần đăng nhập về kho mặc định (user chốt).
 */
export const ALL_WAREHOUSES = 'all';
export const WAREHOUSE_HEADER = 'X-Warehouse-Id';

const STORAGE_PREFIX = 'erp.warehouse.';

/** uuid kho, `ALL_WAREHOUSES`, hoặc null = chưa có (chưa tải phiên / chưa được cấp kho). */
let selected: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeWarehouse(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSelectedWarehouse(): string | null {
  return selected;
}

/** Header gắn vào request — rỗng khi chưa có kho (server hiểu = mọi kho được phép). */
export function warehouseHeaders(): Record<string, string> {
  return selected ? { [WAREHOUSE_HEADER]: selected } : {};
}

export interface WarehouseAccess {
  userId: string;
  /** Kho được phép, theo thứ tự hiển thị. */
  optionIds: string[];
  defaultWarehouseId: string | null;
}

/** "Tất cả kho" chỉ có nghĩa khi được phép nhiều hơn một kho. */
export function canSelectAll(access: Pick<WarehouseAccess, 'optionIds'>): boolean {
  return access.optionIds.length > 1;
}

function isValid(access: WarehouseAccess, value: string | null): value is string {
  if (!value) return false;
  if (value === ALL_WAREHOUSES) return canSelectAll(access);
  return access.optionIds.includes(value);
}

/**
 * Chốt kho khi phiên vừa tải: lựa chọn đã lưu (nếu còn được phép) → kho mặc định → kho đầu tiên.
 * Đồng bộ, KHÔNG phát sự kiện — gọi lúc render để query đầu tiên của màn đã mang đúng header.
 */
export function restoreWarehouse(access: WarehouseAccess): string | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_PREFIX + access.userId);
  } catch {
    // localStorage bị chặn — dùng kho mặc định
  }
  const fallback = isValid(access, access.defaultWarehouseId)
    ? access.defaultWarehouseId
    : (access.optionIds[0] ?? null);
  selected = isValid(access, stored) ? stored : fallback;
  return selected;
}

export function selectWarehouse(access: WarehouseAccess, value: string): void {
  if (!isValid(access, value) || value === selected) return;
  selected = value;
  try {
    localStorage.setItem(STORAGE_PREFIX + access.userId, value);
  } catch {
    // không lưu được thì F5 về kho mặc định
  }
  emit();
}

/** Đăng nhập / đăng xuất: quên lựa chọn cũ của mọi tài khoản trên máy này. */
export function forgetWarehouseSelection(): void {
  selected = null;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // localStorage bị chặn — không có gì để xoá
  }
  emit();
}
