import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meKeys } from '@/lib/auth/me-keys';
import { server } from '@/test/msw/server';
import { makeTestQueryClient, renderApp } from '@/test/render';
import { ChangePasswordScreen } from './components/change-password-screen';

/** Đổi mật khẩu lần đầu (2026-10-20): POST /me/password → làm mới /auth/me → về Tổng quan. */

const toastSuccess = vi.fn();
vi.mock('@/components/ui/toaster', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/change-password',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới (tối thiểu 8 ký tự)'), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
}

describe('<ChangePasswordScreen>', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    replace.mockClear();
  });

  it('đổi thành công → POST /me/password, làm mới phiên, về trang chủ', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/me/password', async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const qc = makeTestQueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    renderApp(<ChangePasswordScreen />, { queryClient: qc });
    expect(screen.getByText('Đổi mật khẩu trước khi bắt đầu')).toBeInTheDocument();
    fill('thiennong!', 'mat-khau-rieng');
    await waitFor(() =>
      expect(bodies).toEqual([{ currentPassword: 'thiennong!', newPassword: 'mat-khau-rieng' }]),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(toastSuccess).toHaveBeenCalledWith('Đã đổi mật khẩu');
    // Phiên được đánh dấu cũ → shell tải lại /auth/me, cờ tắt, gate mở.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys.me });
  });

  it('mật khẩu mới trùng mật khẩu cũ → 422 gắn vào ô mật khẩu mới, không chuyển trang', async () => {
    server.use(
      http.post('/api/me/password', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION',
            message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
            details: [{ path: 'newPassword', message: 'Mật khẩu mới phải khác mật khẩu hiện tại' }],
          },
          { status: 422 },
        ),
      ),
    );
    renderApp(<ChangePasswordScreen />);
    fill('thiennong!', 'thiennong!');
    expect(await screen.findByText('Mật khẩu mới phải khác mật khẩu hiện tại')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
