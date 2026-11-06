import { createMongoAbility, type MongoAbility } from '@casl/ability';
import type { components } from '@/lib/api/schema';

export type AuthMe = components['schemas']['AuthMeDto'];

/**
 * Quyền backend là chuỗi `<subject>.<action>` (customer.read, stock.adjust, role.update…).
 * CASL: action = phần sau dấu chấm, subject = phần trước, PascalCase (customer → Customer).
 * hasGlobalAccess → manage all. Luật 7: chỉ cặp action/subject, không kiểm tra role ở UI.
 */
export type AppAction = string;
export type AppSubject = string;
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

export function toSubject(prefix: string): AppSubject {
  return prefix
    .split(/[_-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function parsePermission(code: string): { action: AppAction; subject: AppSubject } | null {
  const i = code.indexOf('.');
  if (i <= 0 || i === code.length - 1) return null;
  return { subject: toSubject(code.slice(0, i)), action: code.slice(i + 1) };
}

export function buildAbility(
  me:
    | (Pick<AuthMe, 'permissions' | 'hasGlobalAccess'> &
        Partial<
          Pick<AuthMe, 'managesDepartments' | 'managesCareTeam' | 'warehouseOnly' | 'salesOnly'>
        >)
    | null,
): AppAbility {
  const rules: Array<{ action: AppAction; subject: AppSubject }> = [];
  if (me?.hasGlobalAccess) rules.push({ action: 'manage', subject: 'all' });
  for (const code of me?.permissions ?? []) {
    const p = parsePermission(code);
    if (p) rules.push(p);
  }
  // Sơ đồ nhân sự: user.read HOẶC đang là trưởng phòng (GET /org/tree cho phép cả hai).
  if (me?.managesDepartments || me?.permissions.includes('user.read'))
    rules.push({ action: 'view', subject: 'OrgChart' });
  // Nhân viên của team CSKH (2026-10-22): phụ trách phòng ban CSKH — API tự lọc phạm vi.
  if (me?.managesCareTeam) rules.push({ action: 'manage', subject: 'CareStaff' });
  // Việc của team (module Công việc, 2026-10-22): người phụ trách phòng ban — API lọc theo nhánh.
  if (me?.managesDepartments) rules.push({ action: 'view', subject: 'WorkTeam' });
  // Menu Bán hàng (2026-11-05): ẩn với nhân viên kho thuần (server tính `warehouseOnly` theo vai
  // trò) — chỉ menu; URL /crm/orders/* vẫn gate theo sales_order.read (kho mở Sửa đơn từ menu Kho).
  if (me && !me.warehouseOnly) rules.push({ action: 'view', subject: 'SalesMenu' });
  // Kho › Đơn hàng / Vận đơn / In đơn (2026-11-06): ẩn với sale + CSKH thuần (server tính
  // `salesOnly` theo vai trò) — chỉ menu; shipment.read giữ nguyên (thẻ Giao hàng, chi tiết đơn).
  if (me && !me.salesOnly) rules.push({ action: 'view', subject: 'WarehouseOpsMenu' });
  return createMongoAbility<[AppAction, AppSubject]>(rules);
}

/** Ability rỗng — dùng khi chưa có /auth/me (loading) để mọi <Can> ẩn. */
export const EMPTY_ABILITY: AppAbility = createMongoAbility<[AppAction, AppSubject]>([]);
