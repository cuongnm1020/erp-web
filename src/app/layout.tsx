import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'ERP', template: '%s · ERP' },
  description: 'Portal nội bộ CRM / CSKH',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      {/* suppressHydrationWarning: extension trình duyệt (ColorZilla…) chèn attribute vào
          <body> trước khi React hydrate (vd cz-shortcut-listen) → cảnh báo giả. Chỉ tắt
          cảnh báo cho attribute của CHÍNH thẻ body, mismatch bên trong vẫn báo bình thường. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
