import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import tokens from './design/tokens.json';

/**
 * Tên lớp Tailwind sinh từ design system "Thiên Nông ERP" (`design/tokens.json`, bản chép của
 * https://claude.ai/artifact/RwsgPEwCz5QX9hWDjdyW9p). Giá trị nằm trong `src/app/tokens.css`
 * (sinh bằng `pnpm gen:tokens`); file này chỉ đặt TÊN lớp. Đổi giá trị → sửa tokens.json, sinh lại.
 *
 * - Màu: mọi token màu (trừ lớp primitive) thành lớp cùng tên: `bg-primary`, `text-flow-wait`,
 *   `bg-mod-wh-weak`, `border-input-soft`… Nền nhạt là `*-weak`, viền nhạt là `*-line` — không
 *   pha độ mờ (`bg-warning/10`), xem scripts/check-tokens.mjs.
 * - Chữ: 12 caption · 13 dense (bảng / form / nút) · 14 body · 16 section · 20 page-title · 24 kpi ·
 *   36 display-number. `text-xs…2xl` của Tailwind ghi đè sang thang này để code cũ không phải sửa.
 * - Chỉ hai độ đậm 400 / 600 — `font-medium` / `font-bold` đều về 600.
 * - Kích thước khung và component: `h-control` 32, `h-button-sm` 28, `h-chip` 18, `max-w-dialog`
 *   440, `max-w-dialog-wide` 672, `w-sidebar` 240… (bảng `SIZE` dưới).
 */

/** Primitive (neutral-*, blue-*…) chỉ dùng qua token semantic — không sinh lớp. */
const PRIMITIVE = /^(neutral|blue|red|amber|green|slate|violet)-\d+$/;

type ColorToken = { name: string; value: string | Record<string, string> };
const colorTokens = tokens.color.tokens as ColorToken[];
const theme = tokens.color.themes[0]!.id;
const byName = new Map(colorTokens.map((t) => [t.name, t]));

function resolveColor(name: string): string {
  const t = byName.get(name);
  if (!t) throw new Error(`tokens.json: alias trỏ tới token không có: ${name}`);
  const v = typeof t.value === 'string' ? t.value : t.value[theme]!;
  const m = /^\{([A-Za-z0-9_.-]+)\}$/.exec(v);
  return m ? resolveColor(m[1]!) : v;
}

const colors: Record<string, string> = {};
for (const t of colorTokens) {
  if (PRIMITIVE.test(t.name)) continue;
  colors[t.name] = resolveColor(t.name).startsWith('#')
    ? `rgb(var(--${t.name}) / <alpha-value>)`
    : `var(--${t.name})`;
}
/** Tên shadcn cũ còn dùng trong code → token tương đương. Không thêm tên mới vào đây. */
const ALIAS: Record<string, string> = {
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
for (const [alias, target] of Object.entries(ALIAS)) colors[alias] = colors[target]!;

/** Tên lớp kích thước → token (spacing / component). Dùng cho h- w- min-h- max-w- top-… */
const SIZE: Record<string, string> = {
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
const sizes = Object.fromEntries(Object.entries(SIZE).map(([k, v]) => [k, `var(--${v})`]));

/** `radius-md` → lớp `md` = var(--radius-md) (bỏ tiền tố nhóm). */
const byPrefix = (group: { tokens: { name: string }[] }, prefix: string) =>
  Object.fromEntries(group.tokens.map((t) => [t.name.slice(prefix.length), `var(--${t.name})`]));

type Style = { name: string; fontSize: string; lineHeight: string; fontWeight: number };
const textStyles = Object.fromEntries(
  tokens.type.groups.flatMap((g) =>
    (g.styles as Style[]).map((s) => [
      s.name,
      [s.fontSize, { lineHeight: s.lineHeight, fontWeight: String(s.fontWeight) }],
    ]),
  ),
);

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors,
      borderRadius: {
        ...byPrefix(tokens.radius, 'radius-'),
        DEFAULT: 'var(--radius-md)',
      },
      // Viền ô tick chưa chọn 1.5px
      borderWidth: {
        '1.5': '1.5px',
      },
      boxShadow: byPrefix(tokens.shadow, 'shadow-'),
      spacing: sizes,
      maxWidth: {
        dialog: 'var(--dialog-max-width)',
        'dialog-wide': 'var(--dialog-wide-max-width)',
      },
      maxHeight: {
        dialog: 'var(--dialog-max-height)',
      },
      // Danh sách nhãn–giá trị ở màn Chi tiết: cột nhãn `detail-label-width`
      gridTemplateColumns: {
        detail: 'var(--detail-label-width) minmax(0, 1fr)',
      },
      transitionDuration: byPrefix(tokens.duration, 'duration-'),
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        ...textStyles,
        // Thang Tailwind ghi đè sang thang hệ thống để 500+ chỗ `text-sm` tự về 13px.
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
      },
      fontWeight: {
        normal: '400',
        medium: '600',
        semibold: '600',
        bold: '600',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
