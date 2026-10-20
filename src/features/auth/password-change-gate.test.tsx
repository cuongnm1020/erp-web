import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_ADMIN } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PasswordChangeGate } from './components/password-change-gate';
import { SessionProvider } from './components/session-provider';

/** Bắt đổi mật khẩu lần đầu (2026-10-20): /auth/me.mustChangePassword → chỉ còn /change-password. */

let pathname = '/crm/customers';
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}));

const gated = (
  <SessionProvider>
    <PasswordChangeGate>
      <div>NỘI DUNG TRANG</div>
    </PasswordChangeGate>
  </SessionProvider>
);

describe('<PasswordChangeGate>', () => {
  beforeEach(() => replace.mockClear());

  it('phải đổi mật khẩu → không render trang, chuyển về /change-password', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ...ME_ADMIN, mustChangePassword: true })),
    );
    pathname = '/crm/customers';
    renderApp(gated);
    expect(await screen.findByText(/Bạn cần đổi mật khẩu trước khi tiếp tục/)).toBeInTheDocument();
    expect(screen.queryByText('NỘI DUNG TRANG')).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/change-password'));
  });

  it('đang ở /change-password → render trang đổi mật khẩu', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ...ME_ADMIN, mustChangePassword: true })),
    );
    pathname = '/change-password';
    renderApp(gated);
    expect(await screen.findByText('NỘI DUNG TRANG')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('không bị bắt đổi → render bình thường', async () => {
    pathname = '/crm/customers'; // handler mặc định: ME_ADMIN không có cờ
    renderApp(gated);
    expect(await screen.findByText('NỘI DUNG TRANG')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
