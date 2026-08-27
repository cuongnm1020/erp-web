import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Đăng nhập' };

/** Luật 12: page chỉ routing. Không dùng AppShell — chưa đăng nhập. */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <section className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold">Đăng nhập ERP</h1>
          <p className="text-sm text-muted-foreground">Portal nội bộ CRM / CSKH</p>
        </header>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
