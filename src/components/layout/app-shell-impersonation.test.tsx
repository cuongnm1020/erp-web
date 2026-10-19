import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

/** Thanh báo "đăng nhập với tư cách" (2026-10-19) — chỉ hiện khi /auth/me có impersonator. */
describe('AppShell — đăng nhập với tư cách', () => {
  it('đang đăng nhập thay: thanh báo tên người + superadmin, nút quay lại gọi onStop', () => {
    const onStop = vi.fn();
    renderApp(
      <AppShell
        user={{ code: 'sale.hn.1', roles: ['SALES_MEMBER'], name: 'Sale HN 1' }}
        impersonation={{ by: 'Quản trị', stopping: false, onStop }}
      >
        <p>nội dung</p>
      </AppShell>,
    );
    const bar = screen.getByRole('status', { name: '' });
    expect(bar).toHaveTextContent('Đang đăng nhập với tư cách Sale HN 1');
    expect(bar).toHaveTextContent('Quản trị');
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại tài khoản của tôi' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('chính chủ: không có thanh báo', () => {
    renderApp(
      <AppShell user={{ code: 'admin', roles: ['ADMIN'] }}>
        <p>nội dung</p>
      </AppShell>,
    );
    expect(screen.queryByText(/Đang đăng nhập với tư cách/)).not.toBeInTheDocument();
  });
});
