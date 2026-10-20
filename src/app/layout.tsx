import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

/**
 * Be Vietnam Pro (redesign 2026-10-17, thay Inter của DESIGN-BRIEF §3) — thiết kế cho dấu tiếng Việt,
 * chỉ hai độ đậm 400 / 700 như thang chữ (700 từ 2026-10-21, trước là 600). Self-host qua next/font (không gọi Google lúc chạy).
 * next/font đặt --font-be-vietnam trên <html>; globals.css đưa nó vào --font-sans với fallback hệ
 * thống để Storybook / test (không đi qua layout này) vẫn ra sans.
 */
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'ERP', template: '%s · ERP' },
  description: 'Portal nội bộ CRM / CSKH',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning: extension trình duyệt (ColorZilla…) chèn attribute vào
          <body> trước khi React hydrate (vd cz-shortcut-listen) → cảnh báo giả. Chỉ tắt
          cảnh báo cho attribute của CHÍNH thẻ body, mismatch bên trong vẫn báo bình thường. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
