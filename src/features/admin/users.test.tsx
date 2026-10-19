import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ME_SALE, ROLES_FIXTURE, makeUsers, scenario } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { UsersScreen } from './components/users-screen';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const FIRST = makeUsers(1)[0]!;

describe('UsersScreen — GET /users (I-01)', () => {
  beforeEach(() => {
    search = '';
  });

  it('loading → bảng render, tổng hiện trên tiêu đề', async () => {
    renderApp(<UsersScreen />);
    expect(await screen.findByText('Nhân viên 1')).toBeInTheDocument();
    expect(screen.getByText('57 tài khoản')).toBeInTheDocument();
  });

  it('mã NV dẫn tới chi tiết theo id, không theo mã', async () => {
    renderApp(<UsersScreen />);
    const link = await screen.findByRole('link', { name: FIRST.code });
    expect(link).toHaveAttribute('href', `/admin/users/${FIRST.id}`);
  });

  it('không có user.create → nút thêm ẩn (luật 7)', async () => {
    renderApp(<UsersScreen />, { me: { ...ME_SALE, permissions: ['user.read'] } });
    await screen.findByText('Nhân viên 1');
    expect(screen.queryByRole('button', { name: /Thêm nhân viên/ })).not.toBeInTheDocument();
  });

  it('quản lý kho (không role.read): ô vai trò lấy từ /roles/assignable, không gọi /roles', async () => {
    let rolesCalled = false;
    server.use(
      http.get('/api/roles', () => {
        rolesCalled = true;
        return HttpResponse.json([], { status: 403 });
      }),
      http.get('/api/roles/assignable', () =>
        HttpResponse.json(ROLES_FIXTURE.filter((r) => r.code !== 'ADMIN')),
      ),
    );
    renderApp(<UsersScreen />, {
      me: { ...ME_SALE, permissions: ['user.read', 'user.create', 'user.update'] },
    });
    await screen.findByText('Nhân viên 1');
    fireEvent.click(screen.getByRole('button', { name: /Thêm nhân viên/ }));
    expect(await screen.findByLabelText('Nhân viên kinh doanh')).toBeInTheDocument();
    expect(screen.queryByLabelText('Quản trị')).not.toBeInTheDocument();
    expect(rolesCalled).toBe(false);
  });

  it('superadmin: nút đăng nhập với tư cách trên dòng (trừ superadmin / tài khoản khóa)', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post('/api/auth/impersonate', async ({ request }) => {
        posts.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderApp(<UsersScreen />);
    await screen.findByText('Nhân viên 1');
    const users = makeUsers(7);
    expect(
      screen.queryByRole('button', { name: `Đăng nhập với tư cách ${users[0]!.fullName}` }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: `Đăng nhập với tư cách ${users[6]!.fullName}` }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: `Đăng nhập với tư cách ${users[1]!.fullName}` }),
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(posts).toEqual([{ userId: users[1]!.id }]);
    vi.unstubAllGlobals();
  });

  it('không phải superadmin: không có nút đăng nhập với tư cách', async () => {
    renderApp(<UsersScreen />, { me: { ...ME_SALE, permissions: ['user.read', 'user.update'] } });
    await screen.findByText('Nhân viên 2');
    expect(screen.queryByRole('button', { name: /Đăng nhập với tư cách/ })).toBeNull();
  });

  it('empty: EmptyState kèm hành động', async () => {
    server.use(scenario.usersEmpty);
    renderApp(<UsersScreen />);
    expect(await screen.findByText('Chưa có nhân viên')).toBeInTheDocument();
  });

  it('error 500: ErrorState có traceId, thử lại thì refetch', async () => {
    server.use(scenario.usersError);
    renderApp(<UsersScreen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('trace-db_error')).toBeInTheDocument();
    server.resetHandlers();
    screen.getByRole('button', { name: 'Thử lại' }).click();
    await waitFor(() => expect(screen.getByText('Nhân viên 1')).toBeInTheDocument());
  });

  it('sắp xếp phía server: sort=code:desc đọc từ URL (luật 8)', async () => {
    search = 'sort=code:desc';
    renderApp(<UsersScreen />);
    expect(await screen.findByRole('link', { name: 'nv.057' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nv.001' })).not.toBeInTheDocument();
  });
});
