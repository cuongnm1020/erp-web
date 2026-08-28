import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { USER_DETAIL_FIXTURE, USER_PERMISSIONS_FIXTURE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UserPermissionMatrix } from './components/user-permission-matrix';

vi.mock('next/navigation', () => ({
  usePathname: () => `/admin/users/x`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ID = USER_DETAIL_FIXTURE.id;

describe('UserPermissionMatrix — GET/PUT /users/:id/permissions (I-05)', () => {
  it('quyền từ role hiện "Theo vai trò", quyền ngoài role hiện "—"', async () => {
    renderApp(<UserPermissionMatrix userId={ID} canEdit />);
    const inherited = await screen.findByRole('button', { name: /Khách hàng · Xem: Theo vai trò/ });
    expect(inherited).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tồn kho · Điều chỉnh: —/ })).toBeInTheDocument();
  });

  it('nhấn ô: chưa có → Cấp riêng; đang có từ role → Đã chặn; lưu gửi đúng {allow, deny}', async () => {
    let sent: { allow: string[]; deny: string[] } | null = null;
    server.use(
      http.put('/api/users/:id/permissions', async ({ request }) => {
        sent = (await request.json()) as { allow: string[]; deny: string[] };
        return HttpResponse.json(USER_PERMISSIONS_FIXTURE);
      }),
    );
    renderApp(<UserPermissionMatrix userId={ID} canEdit />);

    fireEvent.click(await screen.findByRole('button', { name: /Tồn kho · Điều chỉnh: —/ }));
    expect(
      screen.getByRole('button', { name: /Tồn kho · Điều chỉnh: Cấp riêng/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Khách hàng · Xem: Theo vai trò/ }));
    expect(screen.getByRole('button', { name: /Khách hàng · Xem: Đã chặn/ })).toBeInTheDocument();

    expect(screen.getByText('2 thay đổi chưa lưu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toEqual({ allow: ['stock.adjust'], deny: ['customer.read'] });
  });

  it('superadmin: banner toàn quyền, ô bị khóa', async () => {
    server.use(
      http.get('/api/users/:id/permissions', () =>
        HttpResponse.json({
          ...USER_PERMISSIONS_FIXTURE,
          isSuperAdmin: true,
          entries: USER_PERMISSIONS_FIXTURE.entries.map((e) => ({ ...e, effective: true })),
        }),
      ),
    );
    renderApp(<UserPermissionMatrix userId={ID} canEdit />);
    expect(await screen.findByText(/superadmin — toàn quyền/)).toBeInTheDocument();
    const cell = screen.getByRole('button', { name: /Khách hàng · Xem/ });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
  });

  it('canEdit=false → ô bị khóa, không có nút lưu', async () => {
    renderApp(<UserPermissionMatrix userId={ID} canEdit={false} />);
    const cell = await screen.findByRole('button', { name: /Khách hàng · Xem/ });
    expect(cell).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
  });
});
