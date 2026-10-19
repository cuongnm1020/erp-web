import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { MeScreen } from './components/me-screen';

/** Tài khoản của tôi (2026-10-19): họ tên, số điện thoại, đổi mật khẩu của chính mình. */

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/me',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('MeScreen — hồ sơ + mật khẩu', () => {
  beforeEach(() => toastSuccess.mockClear());

  it('sửa họ tên + số điện thoại → PATCH /me/profile', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/me/profile', async ({ request }) => {
        const body = (await request.json()) as { fullName: string; phone: string };
        bodies.push(body);
        return HttpResponse.json({
          userId: 'u-admin',
          code: 'admin',
          email: 'admin@example.com',
          fullName: body.fullName,
          phone: '0394429147',
        });
      }),
    );
    renderApp(<MeScreen />);
    const name = await screen.findByLabelText('Họ tên');
    expect(name).toHaveValue('Quản trị');
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), {
      target: { value: '0394 429 147' },
    });
    // Nút đầu tiên = khối Thông tin cá nhân (khối Pancake bên dưới có nút cùng tên).
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu thay đổi' })[0]!);
    await waitFor(() =>
      expect(bodies).toEqual([{ fullName: 'Nguyễn Văn A', phone: '0394 429 147' }]),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Đã lưu thay đổi'));
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue('0394429147');
  });

  it('đổi mật khẩu: nhập lại không khớp chặn ở web; sai mật khẩu hiện tại → lỗi tại ô', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/me/password', async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          {
            code: 'CURRENT_PASSWORD_WRONG',
            message: 'Mật khẩu hiện tại không đúng',
            details: [{ path: 'currentPassword', message: 'Mật khẩu hiện tại không đúng' }],
            traceId: 't-1',
          },
          { status: 422 },
        );
      }),
    );
    renderApp(<MeScreen />);
    await screen.findByLabelText('Họ tên');
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'cu' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới (tối thiểu 8 ký tự)'), {
      target: { value: 'mat-khau-moi' },
    });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'khac-han' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
    expect(posts).toEqual([]);

    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'mat-khau-moi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeInTheDocument();
    expect(posts).toEqual([{ currentPassword: 'cu', newPassword: 'mat-khau-moi' }]);
  });
});
