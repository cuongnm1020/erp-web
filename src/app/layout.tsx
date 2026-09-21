import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

/**
 * Inter theo DESIGN-BRIEF §3, subset tiếng Việt, self-host qua next/font (không gọi Google lúc chạy).
 * next/font đặt --font-inter trên <html>; globals.css đưa nó vào --font-sans với fallback hệ thống
 * để Storybook / test (không đi qua layout này) vẫn ra sans.
 */
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'ERP', template: '%s · ERP' },
  description: 'Portal nội bộ CRM / CSKH',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning: extension trình duyệt (ColorZilla…) chèn attribute vào
          <body> trước khi React hydrate (vd cz-shortcut-listen) → cảnh báo giả. Chỉ tắt
          cảnh báo cho attribute của CHÍNH thẻ body, mismatch bên trong vẫn báo bình thường. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
