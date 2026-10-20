import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design tokens — NGUỒN DUY NHẤT cho màu / spacing / radius trong apps/web.
 * Component chỉ dùng class theo token ở đây; cấm hex tự do, cấm p-[13px].
 *
 * Giá trị màu nằm trong globals.css (docs/DESIGN-BRIEF.md §3). Thang chữ, độ đậm và
 * kích thước khung (thanh trên, sidebar) chốt ở đây theo brief:
 * - Chữ: 12 chú thích · 13 mặc định bảng/form · 14 nội dung · 16 tiêu đề mục · 20 tiêu đề trang.
 * - Chỉ hai độ đậm 400 / 600 — `font-medium` và `font-bold` đều quy về 600 để component shadcn
 *   không kéo thêm weight 500/700.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
        },
        // Chữ mờ nhất (placeholder, số thứ tự, viền ô tick chưa chọn) — chỉ dùng trên card.
        'subtle-foreground': 'hsl(var(--subtle-foreground))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          weak: 'hsl(var(--destructive-weak))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Trạng thái nghiệp vụ (SLA, chứng từ) — dùng qua StatusBadge, không dùng trực tiếp.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          weak: 'hsl(var(--success-weak))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          weak: 'hsl(var(--warning-weak))',
          line: 'hsl(var(--warning-line))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          weak: 'hsl(var(--info-weak))',
        },
        // Trạng thái đơn (tab danh sách đơn) — mỗi trạng thái một màu (globals.css --flow-*).
        flow: Object.fromEntries(
          [
            'pending',
            'warehouse',
            'picking',
            'packed',
            'picked-up',
            'in-transit',
            'out-for-delivery',
            'delivered',
            'returned',
            'carrier-cancelled',
            'cancelled',
          ].map((k) => [k, `hsl(var(--flow-${k}))`]),
        ),
        // Màu module menu trái (globals.css --mod-*) — chỉ cho điều hướng, không cho trạng thái.
        mod: Object.fromEntries(
          ['sales', 'cust', 'prod', 'wh', 'rpt', 'adm'].map((k) => [
            k,
            {
              DEFAULT: `hsl(var(--mod-${k}))`,
              weak: `hsl(var(--mod-${k}-weak))`,
              line: `hsl(var(--mod-${k}-line))`,
            },
          ]),
        ),
        // Nhà mạng cạnh SĐT (globals.css --telco-*).
        telco: Object.fromEntries(
          ['viettel', 'vina', 'mobi', 'vnmb', 'gmobile', 'itel'].map((k) => [
            k,
            `hsl(var(--telco-${k}))`,
          ]),
        ),
        // Sơ đồ nhân sự — màu theo khối (globals.css --branch-N / --branch-N-weak)
        branch: Object.fromEntries(
          [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [
            n,
            { DEFAULT: `hsl(var(--branch-${n}))`, weak: `hsl(var(--branch-${n}-weak))` },
          ]),
        ),
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Chip trạng thái cao 18px (design system 2026-10-20)
        chip: '9px',
        tile: '7px',
      },
      // Viền ô tick chưa chọn 1.5px
      borderWidth: {
        '1.5': '1.5px',
      },
      // Hộp thoại cao tối đa màn − 32px, cuộn bên trong
      maxHeight: {
        dialog: 'calc(100vh - 2rem)',
      },
      // Hộp thoại rộng tối đa 440px (form 2 cột: sm:max-w-lg 512px)
      maxWidth: {
        dialog: '440px',
      },
      boxShadow: {
        popover: '0 4px 12px rgba(20, 30, 45, 0.12)',
        dialog: '0 8px 24px rgba(20, 30, 45, 0.16)',
        // Nút chính khi nhấn
        pressed: 'inset 0 1px 2px rgba(0, 0, 0, 0.25)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      // Thang chữ brief §3 — ghi đè xs/sm/base/lg/xl của Tailwind để 500+ chỗ dùng text-sm
      // tự về 13px mà không sửa từng file.
      fontSize: {
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
      // Khung trang (redesign 2026-10-17): sidebar 240px để "Theo dõi giao hàng", "Cảnh báo nhập
      // hàng" không bị cắt, thu gọn 60px. Thanh trên 48px = h-12 có sẵn.
      spacing: {
        sidebar: '240px',
        // control-height / row-height 32px = h-8 có sẵn; đầu thẻ 44px
        'card-header': '44px',
        // chip trạng thái 18px
        '4.5': '1.125rem',
        'sidebar-collapsed': '60px',
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
