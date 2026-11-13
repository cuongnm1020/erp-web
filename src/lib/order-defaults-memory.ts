/**
 * Tạo đơn mới lấy sẵn Marketer / POS / Page / Kho xuất của đơn vừa tạo trước đó (user chốt
 * 2026-11-13). Lưu localStorage của trình duyệt — chỉ là giá trị điền sẵn, người lên đơn vẫn đổi
 * được; xóa khi đăng xuất để người đăng nhập sau trên cùng máy không thừa hưởng.
 */
const KEY = 'erp.order-last-defaults.v1';

export interface RememberedOrderDefaults {
  marketerId: string;
  posShopId: string;
  facebookPageId: string;
  warehouseId: string;
}

export function readOrderDefaults(): RememberedOrderDefaults | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RememberedOrderDefaults>;
    const s = (x: unknown) => (typeof x === 'string' ? x : '');
    return {
      marketerId: s(v.marketerId),
      posShopId: s(v.posShopId),
      facebookPageId: s(v.facebookPageId),
      warehouseId: s(v.warehouseId),
    };
  } catch {
    return null;
  }
}

export function writeOrderDefaults(v: RememberedOrderDefaults): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Storage bị chặn / đầy — đơn sau không điền sẵn, không sao.
  }
}

export function forgetOrderDefaults(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
