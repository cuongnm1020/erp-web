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
        Partial<Pick<AuthMe, 'managesDepartments'>>)
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
  return createMongoAbility<[AppAction, AppSubject]>(rules);
}

/** Ability rỗng — dùng khi chưa có /auth/me (loading) để mọi <Can> ẩn. */
export const EMPTY_ABILITY: AppAbility = createMongoAbility<[AppAction, AppSubject]>([]);
