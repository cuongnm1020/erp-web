import tokens from '../../design/tokens.json';

/**
 * Tên lớp Tailwind riêng của design system — MỘT nguồn cho cả `tailwind.config.ts` (sinh lớp) và
 * `cn()` (tailwind-merge phải biết lớp nào cùng nhóm để lớp sau đè lớp trước).
 *
 * Lỗi thật 2026-10-21: tailwind-merge không biết `max-w-dialog` là một `max-w-*` nên
 * `cn('max-w-dialog', 'max-w-6xl')` giữ CẢ HAI, CSS của token sinh sau nên luôn thắng → mọi hộp
 * thoại đặt `max-w-6xl` bị co về 440px. Thêm lớp mới vào tailwind.config thì thêm tên ở đây;
 * `cn.test.ts` duyệt toàn bộ theme mở rộng và fail nếu có lớp tailwind-merge chưa biết.
 */

/** Primitive (neutral-*, blue-*…) chỉ dùng qua token semantic — không sinh lớp. */
export const PRIMITIVE = /^(neutral|blue|red|amber|green|slate|violet)-\d+$/;

/** Tên shadcn cũ còn dùng trong code → token tương đương. Không thêm tên mới vào đây. */
export const COLOR_ALIAS: Record<string, string> = {
  accent: 'secondary',
  'accent-foreground': 'primary',
  popover: 'card',
  'popover-foreground': 'foreground',
  'card-foreground': 'foreground',
  'secondary-foreground': 'primary',
  'destructive-foreground': 'primary-foreground',
  'success-foreground': 'primary-foreground',
  'warning-foreground': 'primary-foreground',
  'info-foreground': 'primary-foreground',
};

/** Tên lớp kích thước → token (spacing / component). Dùng cho h- w- min-h- max-w- top-… */
export const SIZE: Record<string, string> = {
  control: 'control-height',
  row: 'row-height',
  'card-header': 'card-header-height',
  topbar: 'topbar-height',
  sidebar: 'sidebar-width',
  'sidebar-collapsed': 'sidebar-collapsed',
  'pda-touch': 'pda-touch-min',
  'pda-primary': 'pda-primary-height',
  button: 'button-height',
  'button-sm': 'button-sm-height',
  checkbox: 'checkbox-size',
  'checkbox-hit': 'checkbox-hit-width',
  chip: 'chip-height',
  drawer: 'drawer-width',
  'detail-label': 'detail-label-width',
  'detail-aside': 'detail-aside-width',
  search: 'search-width',
  'menu-item': 'menu-item-height',
  'menu-min': 'menu-min-width',
  'nav-item': 'nav-item-height',
  'sticky-topbar': 'sticky-topbar',
  'sticky-page-header': 'sticky-page-header',
};

/**
 * `max-w-*` của hộp thoại. `dialog-xl` (80% chiều ngang màn) không có trong design system — dành
 * cho hộp chọn nhiều cột (chọn sản phẩm bán theo shop POS) mà Drawer không hợp.
 */
export const DIALOG_MAX_WIDTH: Record<string, string> = {
  dialog: 'var(--dialog-max-width)',
  'dialog-wide': 'var(--dialog-wide-max-width)',
  'dialog-xl': '80vw',
};
export const DIALOG_MAX_HEIGHT: Record<string, string> = {
  dialog: 'var(--dialog-max-height)',
};

/** `radius-md` → `md` (bỏ tiền tố nhóm); token tên đúng bằng tiền tố thành khoá rỗng. */
export const suffixes = (group: { tokens: { name: string }[] }, prefix: string): string[] =>
  group.tokens.map((t) => t.name.slice(prefix.length));

type ColorToken = { name: string };

/** Tên lớp màu: `bg-<x>`, `text-<x>`, `border-<x>`… */
export const COLOR_NAMES: string[] = [
  ...(tokens.color.tokens as ColorToken[]).map((t) => t.name).filter((n) => !PRIMITIVE.test(n)),
  ...Object.keys(COLOR_ALIAS),
];
/** Tên kiểu chữ: `text-body`, `text-caption`… (cỡ + dòng + độ đậm). */
export const TEXT_STYLE_NAMES: string[] = tokens.type.groups.flatMap((g) =>
  g.styles.map((s) => s.name),
);
export const RADIUS_NAMES = suffixes(tokens.radius, 'radius-').filter(Boolean);
export const SHADOW_NAMES = suffixes(tokens.shadow, 'shadow-').filter(Boolean);
export const DURATION_NAMES = suffixes(tokens.duration, 'duration-').filter(Boolean);
